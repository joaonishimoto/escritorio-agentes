import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { gerarJson } from './_lib/claude.js'
import { db, usuarioDaRequisicao } from './_lib/db.js'
import { rota } from './_lib/http.js'

// O Financeiro: o código junta os números (sem gastar token) e um modelo lê e aponta onde dá para gastar menos.

const DIA = 86_400_000
const MODELO_DO_AGENTE: Record<string, string> = {
  chefe: 'Sonnet (esforço baixo)',
  pesquisador: 'Sonnet + busca na web (até 3 buscas, US$ 0,01 cada)',
  redator: 'Opus',
  designer: 'Sonnet + render dos slides',
  criativos: 'Opus + render das artes 4:5 e 9:16 dos anúncios',
  cinegrafista: 'Sonnet + vídeo na IA escolhida (Kling, fal.ai ou animação do Claude)',
  narrador: 'Sonnet + voz na ElevenLabs (cobrada por caractere no plano da ElevenLabs)',
  revisor: 'Sonnet',
  publicador: 'sem IA',
  curador: 'Sonnet',
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

type Passo = { post_id: string; agente: string; status: string; custo_usd: number; tokens_entrada: number; tokens_saida: number; iniciado_em: string | null; terminado_em: string | null; criado_em: string }
type PostLinha = { id: string; marca_id: string; briefing: string; status: string; formato: string; custo_usd: number; voltas_revisao: number; criado_em: string }

const arred = (n: number) => Math.round(n * 10000) / 10000

/** Números dos últimos 30 dias (e dos 30 anteriores, para comparar), de todas as marcas do dono. */
async function juntarNumeros(usuario: string) {
  const agora = Date.now()
  const de = new Date(agora - 30 * DIA)
  const anterior = new Date(agora - 60 * DIA)
  const { data: marcas } = await db.from('marcas').select('id, nome').eq('dono_id', usuario)
  const ids = (marcas ?? []).map((m) => m.id as string)
  const nomeDa = new Map((marcas ?? []).map((m) => [m.id as string, m.nome as string]))
  if (!ids.length) return null
  const { data: postsTodos } = await db
    .from('posts')
    .select('id, marca_id, briefing, status, formato, custo_usd, voltas_revisao, criado_em')
    .in('marca_id', ids)
    .gte('criado_em', anterior.toISOString())
    .order('criado_em', { ascending: false })
    .limit(1000)
  const todos = (postsTodos ?? []) as PostLinha[]
  const posts = todos.filter((p) => new Date(p.criado_em) >= de)
  const antes = todos.filter((p) => new Date(p.criado_em) < de)
  const passos: Passo[] = []
  const lotes = posts.map((p) => p.id)
  for (let i = 0; i < lotes.length; i += 200) {
    const { data } = await db
      .from('passos')
      .select('post_id, agente, status, custo_usd, tokens_entrada, tokens_saida, iniciado_em, terminado_em, criado_em')
      .in('post_id', lotes.slice(i, i + 200))
    passos.push(...((data ?? []) as Passo[]))
  }

  const soma = (l: { custo_usd: number }[]) => l.reduce((s, x) => s + Number(x.custo_usd), 0)
  const total = soma(posts)
  const totalAntes = soma(antes)
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
    if (p.status === 'erro') a.erros++
    if (p.iniciado_em && p.terminado_em) a.segundos += (new Date(p.terminado_em).getTime() - new Date(p.iniciado_em).getTime()) / 1000
    porAgente.set(p.agente, a)
    // a partir da segunda vez que o mesmo agente roda no mesmo post, é retrabalho
    const k = `${p.post_id}:${p.agente}`
    const n = (vezes.get(k) ?? 0) + 1
    vezes.set(k, n)
    if (n > 1) custoRetrabalho += Number(p.custo_usd)
  }

  const porMarca = new Map<string, { custo: number; posts: number }>()
  const porFormato = new Map<string, { custo: number; posts: number }>()
  for (const p of posts) {
    const m = porMarca.get(p.marca_id) ?? { custo: 0, posts: 0 }
    m.custo += Number(p.custo_usd)
    m.posts++
    porMarca.set(p.marca_id, m)
    const f = porFormato.get(p.formato) ?? { custo: 0, posts: 0 }
    f.custo += Number(p.custo_usd)
    f.posts++
    porFormato.set(p.formato, f)
  }

  const porDia: { dia: string; custo: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(agora - i * DIA).toISOString().slice(0, 10)
    porDia.push({ dia: d, custo: arred(soma(posts.filter((p) => p.criado_em.slice(0, 10) === d))) })
  }

  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)
  const doMes = soma(todos.filter((p) => new Date(p.criado_em) >= inicioMes))
  const diasNoMes = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 0).getDate()
  const diaHoje = new Date().getDate()

  return {
    periodo: { de: de.toISOString(), ate: new Date(agora).toISOString() },
    total_usd: arred(total),
    total_30_dias_antes_usd: arred(totalAntes),
    mes_atual_usd: arred(doMes),
    projecao_mes_usd: arred((doMes / Math.max(1, diaHoje)) * diasNoMes),
    posts: posts.length,
    publicados: publicados.length,
    perdidos: perdidos.length,
    custo_medio_post_usd: arred(posts.length ? total / posts.length : 0),
    custo_por_publicado_usd: arred(publicados.length ? total / publicados.length : 0),
    desperdicio_usd: arred(soma(perdidos)),
    retrabalho_usd: arred(custoRetrabalho),
    voltas_revisao_media: posts.length ? Math.round((posts.reduce((s, p) => s + (p.voltas_revisao ?? 0), 0) / posts.length) * 10) / 10 : 0,
    por_agente: [...porAgente]
      .map(([agente, v]) => ({ agente, modelo: MODELO_DO_AGENTE[agente] ?? '', ...v, custo: arred(v.custo), media: arred(v.custo / v.execucoes), segundos: Math.round(v.segundos) }))
      .sort((a, b) => b.custo - a.custo),
    por_marca: [...porMarca].map(([id, v]) => ({ marca: nomeDa.get(id) ?? id, custo: arred(v.custo), posts: v.posts })).sort((a, b) => b.custo - a.custo),
    por_formato: [...porFormato].map(([formato, v]) => ({ formato, custo: arred(v.custo), posts: v.posts, medio: arred(v.custo / v.posts) })),
    mais_caros: [...posts]
      .sort((a, b) => Number(b.custo_usd) - Number(a.custo_usd))
      .slice(0, 5)
      .map((p) => ({ id: p.id, briefing: p.briefing.slice(0, 120), marca: nomeDa.get(p.marca_id) ?? '', custo: arred(Number(p.custo_usd)), status: p.status, formato: p.formato, voltas: p.voltas_revisao })),
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

  const { mais_caros, ...resto } = numeros
  // o gasto por dia é só gráfico: não vai para o modelo
  delete (resto as Partial<typeof numeros>).por_dia
  const { dados, uso } = await gerarJson({
    modelo: 'claude-sonnet-5-5',
    effort: 'low',
    schema: Analise,
    sistema: `Você é o Financeiro de um app em que uma equipe de agentes de IA cria posts de Instagram para as marcas do dono. Você lê os gastos e diz, em português do Brasil, de forma direta e sem enrolar, o que está caro, o que é desperdício e o que dá para mudar.

Como o app funciona, para suas recomendações serem possíveis:
- Cada post passa por: chefe de pauta → pesquisador → copywriter → designer (nos Reels também cinegrafista e narrador) → revisor → aprovação do dono → publicador. Nos anúncios, o designer de criativos faz as artes 4:5 e 9:16 no lugar do designer e o copywriter escreve também o pacote de textos para o Meta. O curador transforma correções do dono em regras.
- Modelos e preços por milhão de tokens (entrada/saída): Opus US$ 4/20, Sonnet US$ 2/10, Haiku US$ 0,10/0,50. Busca na web: US$ 0,01 cada.
- O revisor pode devolver o post para um agente refazer; cada volta custa de novo. Pedidos de ajuste pequenos do dono vão direto ao designer.
- Post com erro ou reprovado é gasto sem resultado. Reels gastam com vídeo na Kling por segundo.
- O dono pode: escrever pedidos mais claros, mandar referências, escolher formato e estilo no Novo post, editar o tom e o checklist da marca, aceitar regras do curador e pedir ajustes pontuais em vez de reprovar.
- O dono escolhe a IA de cada funcionário por post em "IAs da equipe", no Novo post (Claude Opus, Sonnet ou Haiku, GPT, Gemini, DeepSeek; vídeo na Kling, no fal.ai ou animação do Claude, que só custa texto). Sugira trocar quando o ganho for claro, dizendo a economia.

Não invente números: use só os que vierem. Valores em dólar com duas casas, separador decimal vírgula.`,
    conteudo: `Números dos últimos 30 dias:\n${JSON.stringify(resto, null, 1)}\n\nPosts mais caros:\n${JSON.stringify(mais_caros, null, 1)}\n\nFaça a análise.`,
  })
  const { data: salva } = await db
    .from('analises_financeiro')
    .insert({ dono_id: usuario, numeros, analise: dados, custo_usd: uso.custo_usd })
    .select('id, analise, numeros, custo_usd, criado_em')
    .single()
  return res.status(200).json({ numeros, ultima: salva })
})
