import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { gerarJson } from './_lib/claude.js'
import { db, usuarioDaRequisicao } from './_lib/db.js'
import { comGasto } from './_lib/gastos.js'
import { rota } from './_lib/http.js'
import { PADRAO_TEXTO, type AgenteDeTexto } from './_lib/ias.js'

// O Financeiro: o código junta os números (sem gastar token) e um modelo lê e aponta onde dá para gastar menos.

const DIA = 86_400_000
const NOME_MODELO: Record<string, string> = { 'claude-opus-5-5': 'Opus', 'claude-sonnet-5-5': 'Sonnet', 'claude-haiku-5-5': 'Haiku' }
const padrao = (a: AgenteDeTexto) => NOME_MODELO[PADRAO_TEXTO[a]] ?? PADRAO_TEXTO[a]
// o que cada agente usa quando o post não escolhe outra IA (vem de PADRAO_TEXTO, para não mentir para o modelo)
const MODELO_DO_AGENTE: Record<string, string> = {
  chefe: `${padrao('chefe')} (esforço baixo)`,
  pesquisador: `${padrao('pesquisador')} + busca na web (até 3 buscas, US$ 0,01 cada)`,
  redator: padrao('redator'),
  designer: `${padrao('designer')} + render dos slides e imagens geradas (preço por imagem)`,
  criativos: `${padrao('criativos')} + render das artes 4:5 e 9:16 dos anúncios`,
  cinegrafista: 'Sonnet + vídeo na IA escolhida (Kling, fal.ai ou animação do Claude)',
  narrador: `${padrao('narrador')} + voz na ElevenLabs (cobrada por caractere no plano da ElevenLabs)`,
  revisor: padrao('revisor'),
  publicador: 'sem IA',
  curador: 'Sonnet',
}
const ORIGEM: Record<string, string> = {
  ideias: 'Ideias de posts',
  pedido_avulso: 'Pedidos avulsos',
  plano: 'Plano editorial',
  outra_ideia: 'Trocar ideia do plano',
  juntar_regras: 'Mural de regras',
  memoria: 'Memória da marca',
  financeiro: 'Análises do Financeiro',
}

const Analise = z.object({
  resumo: z.string().describe('2 ou 3 frases sobre como estão os gastos, com os números que importam'),
  saude: z.enum(['boa', 'atencao', 'critica']),
  alertas: z
    .array(
      z.object({
        titulo: z.string().describe('curto, até 8 palavras'),
        detalhe: z.string().describe('o que os números mostram, citando valores'),
        acao: z.string().describe('o que fazer, concreto e possível neste app'),
        economia_usd_mes: z.number().describe('estimativa de economia por mês em US$; 0 se não der para estimar'),
        gravidade: z.enum(['alta', 'media', 'baixa']),
      }),
    )
    .describe('de 0 a 5 pontos de melhoria, do mais importante para o menos; não invente problema se não houver'),
  elogios: z.array(z.string()).describe('até 2 coisas que estão boas'),
})

type Passo = { post_id: string; agente: string; status: string; custo_usd: number; tokens_entrada: number; tokens_saida: number; iniciado_em: string | null; terminado_em: string | null; criado_em: string; modelos?: string[] | null }
type PostLinha = { id: string; marca_id: string; briefing: string; status: string; formato: string; custo_usd: number; voltas_revisao: number; criado_em: string; preferencias?: { ias?: Record<string, string> } | null }
type Gasto = { marca_id: string | null; origem: string; descricao: string | null; custo_usd: number; criado_em: string; deu_erro: boolean }

const arred = (n: number) => Math.round(n * 10000) / 10000
/** quando o gasto aconteceu: o fim do passo (ou o começo, se ele ainda não terminou), não a data do post */
const quando = (p: Passo) => p.terminado_em ?? p.iniciado_em ?? p.criado_em

/** Passos dos posts, de 200 em 200; num banco sem a coluna `modelos`, lê sem ela. */
async function lerPassos(ids: string[]) {
  const campos = 'post_id, agente, status, custo_usd, tokens_entrada, tokens_saida, iniciado_em, terminado_em, criado_em'
  const passos: Passo[] = []
  let comModelos = true
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200)
    const ler = (c: string) => db.from('passos').select(c).in('post_id', lote)
    let r = await ler(comModelos ? `${campos}, modelos` : campos)
    if (r.error && comModelos && /modelos/.test(r.error.message)) {
      comModelos = false
      r = await ler(campos)
    }
    if (r.error) throw new Error(r.error.message)
    passos.push(...((r.data ?? []) as unknown as Passo[]))
  }
  return passos
}

/** Gastos fora dos posts (ideias, pedidos avulsos, plano, regras, memória, análises); sem a tabela no banco, fica vazio. */
async function lerGastos(usuario: string, desde: Date) {
  const { data, error } = await db
    .from('gastos')
    .select('marca_id, origem, descricao, custo_usd, criado_em, deu_erro')
    .eq('dono_id', usuario)
    .gte('criado_em', desde.toISOString())
    .order('criado_em', { ascending: false })
    .limit(2000)
  if (error) {
    console.warn('financeiro: sem a tabela de gastos avulsos', error.message)
    return []
  }
  return (data ?? []) as Gasto[]
}

/**
 * Números dos últimos 30 dias (e dos 30 anteriores, para comparar), de todas as marcas do dono.
 * Os totais contam o gasto no dia em que aconteceu (como a conta da Anthropic, em UTC), com tudo o que foi cobrado:
 * passos que terminaram, passos que falharam e o que foi gasto fora dos posts.
 */
export async function juntarNumeros(usuario: string, agora = Date.now()) {
  const de = new Date(agora - 30 * DIA)
  const anterior = new Date(agora - 60 * DIA)
  const inicioMes = new Date(Date.UTC(new Date(agora).getUTCFullYear(), new Date(agora).getUTCMonth(), 1))
  const desde = new Date(Math.min(anterior.getTime(), inicioMes.getTime()))
  const { data: marcas } = await db.from('marcas').select('id, nome').eq('dono_id', usuario)
  const ids = (marcas ?? []).map((m) => m.id as string)
  const nomeDa = new Map((marcas ?? []).map((m) => [m.id as string, m.nome as string]))
  if (!ids.length) return null
  // posts de até 90 dias: um post antigo pode ter passo rodando dentro da janela (uma correção, uma volta)
  const { data: postsTodos } = await db
    .from('posts')
    .select('id, marca_id, briefing, status, formato, custo_usd, voltas_revisao, criado_em, preferencias')
    .in('marca_id', ids)
    .gte('criado_em', new Date(desde.getTime() - 30 * DIA).toISOString())
    .order('criado_em', { ascending: false })
    .limit(1000)
  const todos = (postsTodos ?? []) as PostLinha[]
  const postDe = new Map(todos.map((p) => [p.id, p]))
  const posts = todos.filter((p) => new Date(p.criado_em) >= de)
  const todosPassos = await lerPassos(todos.map((p) => p.id))
  const gastos = await lerGastos(usuario, desde)

  const entre = (data: string, a: Date, b = new Date(agora + DIA)) => {
    const t = new Date(data).getTime()
    return t >= a.getTime() && t < b.getTime()
  }
  const passos = todosPassos.filter((p) => entre(quando(p), de))
  const avulsos = gastos.filter((g) => entre(g.criado_em, de))
  const somaPassos = (l: Passo[]) => l.reduce((s, x) => s + Number(x.custo_usd), 0)
  const somaGastos = (l: Gasto[]) => l.reduce((s, x) => s + Number(x.custo_usd), 0)
  const soma = (l: { custo_usd: number }[]) => l.reduce((s, x) => s + Number(x.custo_usd), 0)

  const custoPosts = somaPassos(passos)
  const custoAvulsos = somaGastos(avulsos)
  const total = custoPosts + custoAvulsos
  const totalAntes = somaPassos(todosPassos.filter((p) => entre(quando(p), anterior, de))) + somaGastos(gastos.filter((g) => entre(g.criado_em, anterior, de)))
  const publicados = posts.filter((p) => p.status === 'publicado' || p.status === 'agendado')
  const perdidos = posts.filter((p) => p.status === 'erro' || p.status === 'reprovado')

  const porAgente = new Map<string, { custo: number; execucoes: number; segundos: number; tokens_entrada: number; tokens_saida: number; erros: number }>()
  const vezes = new Map<string, number>()
  let custoRetrabalho = 0
  for (const p of [...passos].sort((a, b) => a.criado_em.localeCompare(b.criado_em))) {
    const a = porAgente.get(p.agente) ?? { custo: 0, execucoes: 0, segundos: 0, tokens_entrada: 0, tokens_saida: 0, erros: 0 }
    a.custo += Number(p.custo_usd)
    a.execucoes++
    a.tokens_entrada += p.tokens_entrada
    a.tokens_saida += p.tokens_saida
    if (p.status === 'falhou' || p.status === 'erro') a.erros++
    if (p.iniciado_em && p.terminado_em) a.segundos += (new Date(p.terminado_em).getTime() - new Date(p.iniciado_em).getTime()) / 1000
    porAgente.set(p.agente, a)
    // a partir da segunda vez que o mesmo agente roda no mesmo post, é retrabalho
    const k = `${p.post_id}:${p.agente}`
    const n = (vezes.get(k) ?? 0) + 1
    vezes.set(k, n)
    if (n > 1) custoRetrabalho += Number(p.custo_usd)
  }

  const porMarca = new Map<string, { custo: number; posts: number }>()
  for (const p of passos) {
    const id = postDe.get(p.post_id)?.marca_id
    if (!id) continue
    const m = porMarca.get(id) ?? { custo: 0, posts: 0 }
    m.custo += Number(p.custo_usd)
    porMarca.set(id, m)
  }
  for (const g of avulsos) {
    if (!g.marca_id) continue
    const m = porMarca.get(g.marca_id) ?? { custo: 0, posts: 0 }
    m.custo += Number(g.custo_usd)
    porMarca.set(g.marca_id, m)
  }
  for (const p of posts) {
    const m = porMarca.get(p.marca_id) ?? { custo: 0, posts: 0 }
    m.posts++
    porMarca.set(p.marca_id, m)
  }
  const porFormato = new Map<string, { custo: number; posts: number }>()
  for (const p of posts) {
    const f = porFormato.get(p.formato) ?? { custo: 0, posts: 0 }
    f.custo += Number(p.custo_usd)
    f.posts++
    porFormato.set(p.formato, f)
  }

  const porDia: { dia: string; custo: number }[] = []
  const diaDe = (d: string) => new Date(d).toISOString().slice(0, 10)
  for (let i = 29; i >= 0; i--) {
    const d = new Date(agora - i * DIA).toISOString().slice(0, 10)
    porDia.push({ dia: d, custo: arred(somaPassos(passos.filter((p) => diaDe(quando(p)) === d)) + somaGastos(avulsos.filter((g) => diaDe(g.criado_em) === d))) })
  }

  const doMes = somaPassos(todosPassos.filter((p) => entre(quando(p), inicioMes))) + somaGastos(gastos.filter((g) => entre(g.criado_em, inicioMes)))
  const hoje = new Date(agora)
  const diasNoMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0)).getUTCDate()
  const diasPassados = Math.max(1, (agora - inicioMes.getTime()) / DIA)

  // cada post é um teste da equipe: quanto custou, quantas vezes os agentes rodaram e com quais IAs
  const passosDoPost = new Map<string, Passo[]>()
  for (const p of todosPassos) passosDoPost.set(p.post_id, [...(passosDoPost.get(p.post_id) ?? []), p])
  const testes = posts.map((p) => {
    const ps = passosDoPost.get(p.id) ?? []
    const modelos = [...new Set(ps.flatMap((x) => x.modelos ?? []))]
    const escolhidas = Object.values(p.preferencias?.ias ?? {}).filter((v) => typeof v === 'string')
    return {
      id: p.id,
      criado_em: p.criado_em,
      briefing: p.briefing.replace(/\s+/g, ' ').slice(0, 120),
      marca: nomeDa.get(p.marca_id) ?? '',
      formato: p.formato,
      status: p.status,
      voltas: p.voltas_revisao ?? 0,
      execucoes: ps.length,
      falhas: ps.filter((x) => x.status === 'falhou' || x.status === 'erro').length,
      tokens: ps.reduce((s, x) => s + x.tokens_entrada + x.tokens_saida, 0),
      // as IAs medidas nos passos; nos posts antigos, as escolhidas no Novo post
      ias: modelos.length ? modelos : escolhidas,
      segundos: Math.round(ps.reduce((s, x) => s + (x.iniciado_em && x.terminado_em ? (new Date(x.terminado_em).getTime() - new Date(x.iniciado_em).getTime()) / 1000 : 0), 0)),
      custo: arred(Number(p.custo_usd)),
    }
  })

  const porOrigem = new Map<string, { custo: number; vezes: number }>()
  for (const g of avulsos) {
    const o = porOrigem.get(g.origem) ?? { custo: 0, vezes: 0 }
    o.custo += Number(g.custo_usd)
    o.vezes++
    porOrigem.set(g.origem, o)
  }

  return {
    periodo: { de: de.toISOString(), ate: new Date(agora).toISOString() },
    total_usd: arred(total),
    total_posts_usd: arred(custoPosts),
    total_fora_dos_posts_usd: arred(custoAvulsos),
    total_30_dias_antes_usd: arred(totalAntes),
    mes_atual_usd: arred(doMes),
    projecao_mes_usd: arred((doMes / diasPassados) * diasNoMes),
    posts: posts.length,
    publicados: publicados.length,
    perdidos: perdidos.length,
    custo_medio_post_usd: arred(posts.length ? soma(posts) / posts.length : 0),
    custo_por_publicado_usd: arred(publicados.length ? soma(posts) / publicados.length : 0),
    desperdicio_usd: arred(soma(perdidos)),
    retrabalho_usd: arred(custoRetrabalho),
    voltas_revisao_media: posts.length ? Math.round((posts.reduce((s, p) => s + (p.voltas_revisao ?? 0), 0) / posts.length) * 10) / 10 : 0,
    por_agente: [...porAgente]
      .map(([agente, v]) => ({ agente, modelo: MODELO_DO_AGENTE[agente] ?? '', ...v, custo: arred(v.custo), media: arred(v.custo / v.execucoes), segundos: Math.round(v.segundos) }))
      .sort((a, b) => b.custo - a.custo),
    por_marca: [...porMarca].map(([id, v]) => ({ marca: nomeDa.get(id) ?? id, custo: arred(v.custo), posts: v.posts })).sort((a, b) => b.custo - a.custo),
    por_formato: [...porFormato].map(([formato, v]) => ({ formato, custo: arred(v.custo), posts: v.posts, medio: arred(v.custo / v.posts) })),
    fora_dos_posts: [...porOrigem].map(([origem, v]) => ({ origem, nome: ORIGEM[origem] ?? origem, custo: arred(v.custo), vezes: v.vezes })).sort((a, b) => b.custo - a.custo),
    mais_caros: [...testes].sort((a, b) => b.custo - a.custo).slice(0, 5).map(({ id, briefing, marca, custo, status, formato, voltas }) => ({ id, briefing, marca, custo, status, formato, voltas })),
    testes: testes.slice(0, 100),
    por_dia: porDia,
  }
}

export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const usuario = await usuarioDaRequisicao(req.headers.authorization)
  if (!usuario) return res.status(401).json({ erro: 'Faça login de novo' })
  const { acao, indice, titulo } = (req.body ?? {}) as { acao?: string; indice?: number; titulo?: string }

  const numeros = await juntarNumeros(usuario)
  const { data: ultima } = await db
    .from('analises_financeiro')
    .select('id, analise, numeros, custo_usd, criado_em')
    .eq('dono_id', usuario)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (acao === 'dispensar' && ultima) {
    // o dono deu OK numa dica: ela sai da análise salva e não volta mais
    const analise = ultima.analise as z.infer<typeof Analise>
    if (analise.alertas[indice ?? -1]?.titulo === titulo) {
      const nova = { ...analise, alertas: analise.alertas.filter((_, i) => i !== indice) }
      await db.from('analises_financeiro').update({ analise: nova }).eq('id', ultima.id).eq('dono_id', usuario)
      ultima.analise = nova
    }
    return res.status(200).json({ numeros, ultima })
  }
  if (acao !== 'analisar') return res.status(200).json({ numeros, ultima })
  if (!numeros || numeros.posts === 0) return res.status(400).json({ erro: 'Ainda não há posts nos últimos 30 dias para analisar' })

  const { mais_caros, testes, ...resto } = numeros
  // o gasto por dia é só gráfico: não vai para o modelo
  delete (resto as Partial<typeof numeros>).por_dia
  const custoPorTeste = testes.map(({ briefing, formato, status, voltas, execucoes, falhas, ias, custo }) => ({ briefing: briefing.slice(0, 60), formato, status, voltas, execucoes, falhas, ias, custo }))
  const { dados, uso } = await comGasto({ dono_id: usuario, origem: 'financeiro', descricao: 'Análise dos gastos' }, () => gerarJson({
    modelo: 'claude-sonnet-5-5',
    effort: 'low',
    schema: Analise,
    sistema: `Você é o Financeiro de um app em que uma equipe de agentes de IA cria posts de Instagram para as marcas do dono. Você lê os gastos e diz, em português do Brasil, de forma direta e sem enrolar, o que está caro, o que é desperdício e o que dá para mudar.

Como o app funciona, para suas recomendações serem possíveis:
- Cada post passa por: chefe de pauta → pesquisador → copywriter → designer (nos Reels também cinegrafista e narrador) → revisor → aprovação do dono → publicador. Nos anúncios, o designer de criativos faz as artes 4:5 e 9:16 no lugar do designer e o copywriter escreve também o pacote de textos para o Meta. O curador transforma correções do dono em regras.
- Modelos e preços por milhão de tokens (entrada/saída): Opus US$ 4/20, Sonnet US$ 2/10, Haiku US$ 0,10/0,50. Busca na web: US$ 0,01 cada.
- O revisor pode devolver o post para um agente refazer; cada volta custa de novo. Pedidos de ajuste pequenos do dono vão direto ao designer.
- Post com erro ou reprovado é gasto sem resultado. Reels gastam com vídeo na Kling por segundo.
- Os totais contam tudo o que foi cobrado, no dia em que foi cobrado: passos que deram certo, passos que falharam e o que foi gasto fora dos posts (fora_dos_posts: ideias, pedidos avulsos, plano editorial, mural de regras, memória e estas análises).
- O dono testa a equipe: cada post é um teste. Compare o custo por teste entre formatos e IAs escolhidas e aponte o teste que saiu caro sem motivo.
- O dono pode: escrever pedidos mais claros, mandar referências, escolher formato e estilo no Novo post, editar o tom e o checklist da marca, aceitar regras do curador e pedir ajustes pontuais em vez de reprovar.
- O dono escolhe a IA de cada funcionário por post em "IAs da equipe", no Novo post (Claude Opus, Sonnet ou Haiku, GPT, Gemini, DeepSeek; vídeo na Kling, no fal.ai ou animação do Claude, que só custa texto). Sugira trocar quando o ganho for claro, dizendo a economia.

Não invente números: use só os que vierem. Valores em dólar com duas casas, separador decimal vírgula.`,
    conteudo: `Números dos últimos 30 dias:\n${JSON.stringify(resto, null, 1)}\n\nPosts mais caros:\n${JSON.stringify(mais_caros, null, 1)}\n\nCusto por teste (cada post, do mais novo ao mais antigo):\n${JSON.stringify(custoPorTeste.slice(0, 40))}\n\nFaça a análise.`,
  }))
  const { data: salva } = await db
    .from('analises_financeiro')
    .insert({ dono_id: usuario, numeros, analise: dados, custo_usd: uso.custo_usd })
    .select('id, analise, numeros, custo_usd, criado_em')
    .single()
  return res.status(200).json({ numeros, ultima: salva })
})
