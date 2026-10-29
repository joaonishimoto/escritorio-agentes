// Métricas dos posts publicados, lidas da API do Instagram (login do Instagram, graph.instagram.com).
// Servem para o dono ver o resultado e para o chefe de pauta saber o que funcionou na marca.

export interface Metricas {
  alcance: number | null
  visualizacoes: number | null
  curtidas: number | null
  comentarios: number | null
  salvos: number | null
  compartilhamentos: number | null
  interacoes: number | null
}

const NOMES: Record<string, keyof Metricas> = {
  reach: 'alcance',
  views: 'visualizacoes',
  likes: 'curtidas',
  comments: 'comentarios',
  saved: 'salvos',
  shares: 'compartilhamentos',
  total_interactions: 'interacoes',
}
const TODAS = Object.keys(NOMES)
// se a Meta recusar alguma métrica para esse tipo de mídia, pede só as que todo tipo tem
const BASICAS = ['reach', 'likes', 'comments', 'saved', 'shares']

type Resposta = { data?: { name: string; values?: { value?: number }[]; total_value?: { value?: number } }[]; error?: { message?: string } }

/** Converte a resposta de /insights nas nossas colunas (o que não veio fica null). */
export function lerInsights(json: Resposta): Metricas {
  const m: Metricas = { alcance: null, visualizacoes: null, curtidas: null, comentarios: null, salvos: null, compartilhamentos: null, interacoes: null }
  for (const d of json.data ?? []) {
    const coluna = NOMES[d.name]
    const valor = d.total_value?.value ?? d.values?.[0]?.value
    if (coluna && typeof valor === 'number') m[coluna] = valor
  }
  return m
}

export async function buscarMetricas(mediaId: string, token: string): Promise<Metricas> {
  const versao = process.env.INSTAGRAM_API_VERSION ?? 'v23.0'
  let ultimoErro = ''
  for (const lista of [TODAS, BASICAS]) {
    const qs = new URLSearchParams({ metric: lista.join(','), access_token: token })
    const r = await fetch(`https://graph.instagram.com/${versao}/${mediaId}/insights?${qs}`, { signal: AbortSignal.timeout(15_000) })
    const json = (await r.json().catch(() => ({}))) as Resposta
    if (r.ok && !json.error) return lerInsights(json)
    ultimoErro = json.error?.message ?? `HTTP ${r.status}`
  }
  throw new Error(ultimoErro)
}

/**
 * Quanto o post engajou para o tanto de gente que viu: salvar e compartilhar valem mais
 * (é o que o algoritmo mais premia em carrossel), depois comentário, depois curtida.
 */
export function pontuacao(m: Partial<Metricas>): number | null {
  if (!m.alcance) return null
  const pontos = (m.salvos ?? 0) * 3 + (m.compartilhamentos ?? 0) * 3 + (m.comentarios ?? 0) * 2 + (m.curtidas ?? 0)
  return pontos / m.alcance
}

export interface PostComMetricas extends Partial<Metricas> {
  briefing: string
  angulo?: string | null
  estrutura?: string | null
}

const numeros = (p: PostComMetricas) =>
  [`alcance ${p.alcance ?? '?'}`, `${p.salvos ?? 0} salvos`, `${p.compartilhamentos ?? 0} compartilhamentos`, `${p.comentarios ?? 0} comentários`, `${p.curtidas ?? 0} curtidas`].join(', ')
const linha = (p: PostComMetricas) =>
  `- ${p.briefing.replace(/\s+/g, ' ').slice(0, 160)}${p.angulo ? ` | ângulo: ${p.angulo}` : ''}${p.estrutura ? ` | estrutura: ${p.estrutura}` : ''} (${numeros(p)})`

/** Texto para o chefe de pauta: os que mais funcionaram e, com histórico suficiente, os que menos funcionaram. */
export function textoDoQueFuncionou(posts: PostComMetricas[]): string {
  const comNota = posts.map((p) => ({ p, nota: pontuacao(p) })).filter((x): x is { p: PostComMetricas; nota: number } => x.nota !== null)
  if (comNota.length < 3) return ''
  comNota.sort((a, b) => b.nota - a.nota)
  const melhores = comNota.slice(0, 3)
  const piores = comNota.length >= 6 ? comNota.slice(-2) : []
  return [
    '## O que funcionou no Instagram da marca (use como pista, não como regra)',
    'Mais salvos e compartilhamentos para o alcance:',
    ...melhores.map((x) => linha(x.p)),
    ...(piores.length ? ['Menos engajamento:', ...piores.map((x) => linha(x.p))] : []),
  ].join('\n')
}
