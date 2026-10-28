// Geração de vídeo pela API oficial da Kling (kling.ai/document-api). A chave fica em KLING_API_KEY na Vercel.
const BASE = process.env.KLING_API_BASE ?? 'https://api-singapore.klingai.com'
export const MODELO_KLING = 'kling-2.5-turbo'

// preço oficial do 2.5 Turbo, sem áudio, em US$ por segundo de vídeo
const PRECO_POR_SEGUNDO = { '720p': 0.042, '1080p': 0.07 } as const
export type Resolucao = keyof typeof PRECO_POR_SEGUNDO

export function custoDoVideo(segundos: number, resolucao: Resolucao) {
  return segundos * PRECO_POR_SEGUNDO[resolucao]
}

interface Resposta<T> {
  code: number
  message: string
  data: T
}

interface Tarefa {
  id: string
  status: 'submitted' | 'processing' | 'succeeded' | 'failed'
  message?: string
  outputs?: { type: string; url: string; duration?: string }[]
}

async function chamar<T>(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<T> {
  const chave = process.env.KLING_API_KEY
  if (!chave) throw new Error('Falta configurar KLING_API_KEY na Vercel para gerar vídeo')
  const r = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const json = (await r.json().catch(() => null)) as Resposta<T> | null
  if (!r.ok || !json || json.code !== 0) {
    const msg = json?.message ?? `HTTP ${r.status}`
    if (r.status === 401) throw new Error(`Kling recusou a chave. Confira KLING_API_KEY na Vercel. (${msg})`)
    if (json?.code === 1303) throw new Error('Kling: já tem vídeo demais sendo gerado ao mesmo tempo no seu pacote. Tente de novo em alguns minutos.')
    throw new Error(`Kling: ${msg}`)
  }
  return json.data
}

/** Pede um vídeo vertical. Com `primeiroQuadro`, a imagem vira o começo do vídeo (e o vídeo sai na proporção dela). */
export async function pedirVideo(opts: { prompt: string; segundos: 5 | 10; resolucao: Resolucao; primeiroQuadro?: string; idExterno?: string }) {
  const settings = { resolution: opts.resolucao, duration: opts.segundos }
  const options = opts.idExterno ? { external_task_id: opts.idExterno } : undefined
  const tarefa = opts.primeiroQuadro
    ? await chamar<Tarefa>('POST', `/image-to-video/${MODELO_KLING}`, {
        contents: [
          { type: 'prompt', text: opts.prompt },
          { type: 'first_frame', url: opts.primeiroQuadro },
        ],
        settings,
        options,
      })
    : await chamar<Tarefa>('POST', `/text-to-video/${MODELO_KLING}`, { prompt: opts.prompt, settings: { ...settings, aspect_ratio: '9:16' }, options })
  return tarefa.id
}

/** Situação de um pedido: devolve a URL do vídeo quando estiver pronto. */
export async function consultarVideo(id: string): Promise<{ pronto: false } | { pronto: true; url: string }> {
  const [tarefa] = await chamar<Tarefa[]>('GET', `/tasks?task_ids=${encodeURIComponent(id)}`)
  if (!tarefa) throw new Error(`Kling não encontrou o pedido ${id}`)
  if (tarefa.status === 'failed') throw new Error(`Kling não conseguiu gerar o vídeo${tarefa.message ? `: ${tarefa.message}` : ''}`)
  const video = tarefa.outputs?.find((o) => o.type === 'video')
  if (tarefa.status !== 'succeeded' || !video?.url) return { pronto: false }
  return { pronto: true, url: video.url }
}
