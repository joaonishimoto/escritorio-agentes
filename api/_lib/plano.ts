// Social Media: preenche as vagas do plano editorial com temas que a marca ainda não publicou.
// As vagas (dia, hora, formato, linha) vêm prontas do app (src/lib/plano.ts, no fuso do dono); aqui entra o tema de cada uma.
import { z } from 'zod'
import { gerarJson } from './claude.js'
import type { Marca } from './contexto.js'
import { db } from './db.js'
import { completarMarca } from './marcas/index.js'
import { memoriaDaMarca } from './memoria.js'

const MAX_VAGAS = 93
const FORMATOS = ['carrossel', 'foto', 'reel'] as const
type Formato = (typeof FORMATOS)[number]

export interface VagaPedida {
  quando: string
  formato: Formato
  linha: string
  tema_obrigatorio?: string
}

const Tema = z.object({
  n: z.number().int().describe('o número da vaga'),
  titulo: z.string().describe('nome curto do post'),
  gancho: z.string().describe('a frase da capa ou dos primeiros segundos'),
  briefing: z.string().describe('o pedido completo para a equipe produzir o post, em 1 a 3 frases, no formato da vaga'),
  novidade: z.enum(['inedito', 'angulo_novo']).describe('inedito: tema que a marca nunca postou; angulo_novo: tema que já saiu, com um ângulo claramente diferente'),
  parecido_com: z.string().describe('se angulo_novo: o post antigo mais parecido (data e tema, como na lista); se inedito: vazio'),
})
const Temas = z.object({ vagas: z.array(Tema) })

const corta = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '')

/** Só vagas bem formadas, no futuro e no máximo `MAX_VAGAS`. */
export function limparVagas(vagas: unknown, agora = Date.now()): VagaPedida[] {
  return (Array.isArray(vagas) ? vagas : [])
    .map((v) => (v ?? {}) as Record<string, unknown>)
    .filter((v) => typeof v.quando === 'string' && Date.parse(v.quando) > agora && FORMATOS.includes(v.formato as Formato))
    .slice(0, MAX_VAGAS)
    .map((v) => ({
      quando: new Date(v.quando as string).toISOString(),
      formato: v.formato as Formato,
      linha: corta(v.linha, 40) || 'livre',
      ...(corta(v.tema_obrigatorio, 120) ? { tema_obrigatorio: corta(v.tema_obrigatorio, 120) } : {}),
    }))
}

const diaDaSemana = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })

export function textoDasVagas(vagas: VagaPedida[]) {
  return vagas.map((v, i) => `${i + 1}. ${diaDaSemana(v.quando)} · ${v.formato} · linha: ${v.linha}${v.tema_obrigatorio ? ` · TEMA OBRIGATÓRIO: ${v.tema_obrigatorio}` : ''}`).join('\n')
}

async function contexto(marcaId: string) {
  const [{ data: marca }, { data: andamento }, memoria] = await Promise.all([
    db.from('marcas').select('*').eq('id', marcaId).single(),
    // ainda não publicados: em produção, na mesa, agendados ou guardados
    db.from('posts').select('briefing').eq('marca_id', marcaId).not('status', 'in', '(publicado,reprovado)').order('criado_em', { ascending: false }).limit(30),
    memoriaDaMarca(marcaId, 150),
  ])
  if (!marca) throw new Error('Marca não encontrada')
  const m = completarMarca(marca as Marca)
  const sistema = [
    `Você é o Social Media de uma equipe que cria posts de Instagram${m.identidade?.neutra ? '' : ` para a marca ${m.nome}`}. Você monta o plano editorial: um tema por vaga do calendário, variado, bom para salvar e compartilhar, sem repetir o que a marca já publicou nem repetir temas dentro do próprio plano. Escreva em português do Brasil.`,
    m.tom_de_voz ? `## Tom de voz da marca\n${m.tom_de_voz.slice(0, 4000)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  const historico = [
    memoria || '## Posts que a marca já publicou\n(nenhum na memória)',
    `## Posts em andamento, agendados ou guardados (também não repita)\n${(andamento ?? []).map((p) => `- ${corta(p.briefing, 200)}`).join('\n') || '(nenhum)'}`,
  ].join('\n\n')
  return { sistema, historico }
}

const REGRAS = `Regras:
- Cada vaga já tem dia, formato e linha de conteúdo: o tema precisa caber nos três (carrossel = conteúdo em partes, para salvar; foto = uma ideia forte numa imagem; reel = algo que funciona em vídeo de cenas, sem texto na tela).
- Tema obrigatório (datas especiais) é para seguir.
- Nenhum tema repete outro da lista de posts publicados; se voltar a um assunto antigo, o ângulo é claramente novo e marque angulo_novo com o post parecido.
- Dentro do plano, nenhum tema, gancho ou fecho se repete; alterne objetivos (ensinar, inspirar, entreter, vender) ao longo das semanas.
- O briefing é o pedido que a equipe recebe: diga o assunto, o ângulo e o que o post entrega, sem descrever o visual.`

/** Cria o plano em rascunho com as vagas preenchidas pelo Social Media. */
export async function gerarPlano(marcaId: string, config: Record<string, unknown>, vagas: VagaPedida[], pedido?: string) {
  if (!vagas.length) throw new Error('O plano ficou sem vagas: confira o período e o ritmo.')
  const { sistema, historico } = await contexto(marcaId)
  const { dados, uso } = await gerarJson({
    modelo: 'claude-sonnet-5-5',
    effort: 'medium',
    sistema,
    conteudo: `${historico}\n\n${pedido ? `## O que o dono quer neste plano\n${pedido}\n\n` : ''}## Vagas do plano (${vagas.length})\n${textoDasVagas(vagas)}\n\n${REGRAS}\n\nPreencha todas as ${vagas.length} vagas, uma por número.`,
    schema: Temas,
  })
  const porN = new Map(dados.vagas.map((t) => [t.n, t]))
  const { data: plano, error } = await db.from('planos').insert({ marca_id: marcaId, config, custo_usd: uso.custo_usd }).select('id').single()
  if (error || !plano) throw new Error(error?.message ?? 'Não consegui criar o plano')
  const linhas = vagas.map((v, i) => {
    const t = porN.get(i + 1)
    return {
      plano_id: plano.id,
      marca_id: marcaId,
      ordem: i + 1,
      quando: v.quando,
      formato: v.formato,
      linha: v.linha,
      tema_obrigatorio: v.tema_obrigatorio ?? null,
      titulo: corta(t?.titulo, 120) || (v.tema_obrigatorio ?? 'Vaga sem tema'),
      gancho: corta(t?.gancho, 200),
      briefing: corta(t?.briefing, 1200) || (v.tema_obrigatorio ?? ''),
      novidade: t?.novidade ?? null,
      parecido_com: corta(t?.parecido_com, 200) || null,
    }
  })
  const { error: e } = await db.from('vagas').insert(linhas)
  if (e) {
    await db.from('planos').delete().eq('id', plano.id)
    throw new Error(e.message)
  }
  // um plano por vez: o rascunho anterior vai embora e o aprovado fica no histórico como encerrado
  await db.from('planos').delete().eq('marca_id', marcaId).eq('status', 'rascunho').neq('id', plano.id)
  await db.from('planos').update({ status: 'encerrado' }).eq('marca_id', marcaId).eq('status', 'aprovado')
  return { plano_id: plano.id as string, custo_usd: uso.custo_usd }
}

/** Outra ideia para uma vaga só, sem repetir as outras vagas do plano. */
export async function outraIdeia(vagaId: string, pedido?: string) {
  const { data: vaga } = await db.from('vagas').select('*').eq('id', vagaId).single()
  if (!vaga) throw new Error('Vaga não encontrada')
  const { data: irmas } = await db.from('vagas').select('ordem, titulo, gancho').eq('plano_id', vaga.plano_id).neq('id', vagaId).neq('status', 'descartada').order('ordem')
  const { sistema, historico } = await contexto(vaga.marca_id)
  const v: VagaPedida = { quando: vaga.quando, formato: vaga.formato, linha: vaga.linha ?? 'livre', ...(vaga.tema_obrigatorio ? { tema_obrigatorio: vaga.tema_obrigatorio } : {}) }
  const { dados, uso } = await gerarJson({
    modelo: 'claude-sonnet-5-5',
    effort: 'low',
    sistema,
    conteudo: `${historico}\n\n## Outras vagas deste plano (não repita)\n${(irmas ?? []).map((i) => `- ${i.titulo}: "${i.gancho}"`).join('\n') || '(nenhuma)'}\n\n## Tema que o dono não quis nesta vaga\n${vaga.titulo}: "${vaga.gancho}"\n\n${pedido ? `## O que o dono pediu\n${pedido}\n\n` : ''}## Vaga\n${textoDasVagas([v])}\n\n${REGRAS}\n\nDê um tema novo para esta vaga (n = 1).`,
    schema: Temas,
  })
  const t = dados.vagas[0]
  if (!t) throw new Error('O Social Media não mandou ideia nova. Tente de novo.')
  const novo = { titulo: corta(t.titulo, 120), gancho: corta(t.gancho, 200), briefing: corta(t.briefing, 1200), novidade: t.novidade, parecido_com: corta(t.parecido_com, 200) || null }
  const { error } = await db.from('vagas').update(novo).eq('id', vagaId)
  if (error) throw new Error(error.message)
  const { data: plano } = await db.from('planos').select('custo_usd').eq('id', vaga.plano_id).single()
  await db.from('planos').update({ custo_usd: Number(plano?.custo_usd ?? 0) + uso.custo_usd }).eq('id', vaga.plano_id)
  return { vaga: { ...vaga, ...novo }, custo_usd: uso.custo_usd }
}
