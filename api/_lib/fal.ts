// Geradores de vídeo pelo fal.ai, com uma chave só (FAL_KEY na Vercel): Kling 3.0, Hailuo e Seedance.
// Fila do fal: pede em queue.fal.run/<modelo> e acompanha pelos links status_url e response_url que ele devolve.

export interface ModeloFal {
  nome: string
  textoParaVideo: string
  imagemParaVideo: string
  /** durações aceitas, em segundos */
  duracoes: number[]
  /** US$ por segundo, quando o fal publica; sem preço, o custo fica de fora da conta do post */
  precoPorSegundo?: number
  extras: Record<string, unknown>
}

export const MODELOS_FAL = {
  'fal-kling': {
    nome: 'Kling 3.0',
    textoParaVideo: 'fal-ai/kling-video/o3/standard/text-to-video',
    imagemParaVideo: 'fal-ai/kling-video/o3/standard/image-to-video',
    duracoes: [5, 10],
    precoPorSegundo: 0.084,
    extras: { aspect_ratio: '9:16', generate_audio: false },
  },
  'fal-hailuo': {
    nome: 'Hailuo 02',
    textoParaVideo: 'fal-ai/minimax/hailuo-02/standard/text-to-video',
    imagemParaVideo: 'fal-ai/minimax/hailuo-02/standard/image-to-video',
    duracoes: [6, 10],
    precoPorSegundo: 0.045,
    extras: { aspect_ratio: '9:16', prompt_optimizer: true },
  },
  'fal-seedance': {
    nome: 'Seedance 2.0',
    textoParaVideo: 'bytedance/seedance-2.0/text-to-video',
    imagemParaVideo: 'bytedance/seedance-2.0/image-to-video',
    duracoes: [5, 10],
    extras: { aspect_ratio: '9:16', resolution: '720p' },
  },
} satisfies Record<string, ModeloFal>
export type MotorFal = keyof typeof MODELOS_FAL

/** Duração aceita pelo modelo mais perto da pedida. */
export function duracaoFal(motor: MotorFal, segundos: number) {
  const d: number[] = MODELOS_FAL[motor].duracoes
  return d.reduce((a, b) => (Math.abs(b - segundos) < Math.abs(a - segundos) ? b : a))
}

export function custoFal(motor: MotorFal, segundos: number) {
  const m: ModeloFal = MODELOS_FAL[motor]
  return m.precoPorSegundo ? m.precoPorSegundo * segundos : 0
}

export async function chamarFal<T>(url: string, corpo?: unknown): Promise<T> {
  const chave = process.env.FAL_KEY
  if (!chave) throw new Error('Falta configurar FAL_KEY na Vercel para usar o fal.ai')
  const r = await fetch(url, {
    method: corpo ? 'POST' : 'GET',
    headers: { Authorization: `Key ${chave}`, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const json = (await r.json().catch(() => null)) as (T & { detail?: unknown }) | null
  if (!r.ok || !json) {
    const det = json?.detail
    const msg = typeof det === 'string' ? det : det ? JSON.stringify(det).slice(0, 200) : `HTTP ${r.status}`
    if (r.status === 401) throw new Error(`fal.ai recusou a chave. Confira FAL_KEY na Vercel. (${msg})`)
    if (r.status === 402 || r.status === 403) throw new Error(`fal.ai: sem saldo ou sem acesso a este modelo. (${msg})`)
    throw new Error(`fal.ai: ${msg}`)
  }
  return json
}

/** Pede o vídeo. Devolve os links para acompanhar. */
export async function pedirVideoFal(motor: MotorFal, opts: { prompt: string; segundos: number; primeiroQuadro?: string }) {
  const m: ModeloFal = MODELOS_FAL[motor]
  const modelo = opts.primeiroQuadro ? m.imagemParaVideo : m.textoParaVideo
  const r = await chamarFal<{ request_id: string; status_url: string; response_url: string }>(`https://queue.fal.run/${modelo}`, {
    prompt: opts.prompt,
    duration: String(opts.segundos),
    ...m.extras,
    ...(opts.primeiroQuadro ? { image_url: opts.primeiroQuadro } : {}),
  })
  return { id: r.request_id, status_url: r.status_url, response_url: r.response_url }
}

/** Situação do pedido: devolve a URL do vídeo quando estiver pronto. */
export async function consultarVideoFal(pedido: { status_url: string; response_url: string }): Promise<{ pronto: false } | { pronto: true; url: string }> {
  const s = await chamarFal<{ status: string; error?: string }>(pedido.status_url)
  if (s.status !== 'COMPLETED') return { pronto: false }
  if (s.error) throw new Error(`fal.ai não conseguiu gerar o vídeo: ${s.error}`)
  const r = await chamarFal<{ video?: { url?: string } }>(pedido.response_url)
  if (!r.video?.url) throw new Error('fal.ai terminou sem devolver o vídeo')
  return { pronto: true, url: r.video.url }
}
