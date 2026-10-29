// Imagens que o designer gera para o post pelo fal.ai (mesma FAL_KEY dos vídeos).
// Com fotos de referência da marca, o modelo de edição usa elas como base; sem, gera só pelo texto.
import { BUCKET_POSTS, db, urlPublica } from './db.js'
import { chamarFal } from './fal.js'

export interface ModeloImagem {
  nome: string
  textoParaImagem: string
  comReferencias: string
  /** US$ por imagem gerada */
  preco: number
  /** quantas referências o modelo aceita de uma vez */
  maxReferencias: number
  extras: Record<string, unknown>
}

export const MODELOS_IMAGEM = {
  seedream: {
    nome: 'Seedream 4',
    textoParaImagem: 'fal-ai/bytedance/seedream/v4/text-to-image',
    comReferencias: 'fal-ai/bytedance/seedream/v4/edit',
    preco: 0.03,
    maxReferencias: 6,
    extras: { image_size: { width: 1080, height: 1350 }, num_images: 1 },
  },
  'nano-banana': {
    nome: 'Nano Banana',
    textoParaImagem: 'fal-ai/nano-banana',
    comReferencias: 'fal-ai/nano-banana/edit',
    preco: 0.0398,
    maxReferencias: 6,
    extras: { aspect_ratio: '4:5', num_images: 1 },
  },
  'nano-banana-pro': {
    nome: 'Nano Banana Pro',
    textoParaImagem: 'fal-ai/nano-banana-pro',
    comReferencias: 'fal-ai/nano-banana-pro/edit',
    preco: 0.15,
    maxReferencias: 14,
    extras: { aspect_ratio: '4:5', num_images: 1 },
  },
} satisfies Record<string, ModeloImagem>
export type MotorImagem = keyof typeof MODELOS_IMAGEM
export const MOTOR_IMAGEM_PADRAO: MotorImagem = 'seedream'
/** quanto esperar por uma imagem: passou disso, o designer segue com as fotos da marca em vez de travar o passo */
export const LIMITE_IMAGEM_MS = 75_000
/** teto de imagens geradas por post, para o custo não fugir (≈ US$ 0,09 no Seedream) */
export const MAX_IMAGENS_POR_POST = 3

export const eMotorImagem = (m: unknown): m is MotorImagem => typeof m === 'string' && m in MODELOS_IMAGEM

/** Gera uma imagem 4:5 e guarda no bucket do post. Devolve a URL pública e o custo. */
export async function gerarImagem(
  motor: MotorImagem,
  opts: { prompt: string; referencias: string[]; postId: string; nome: string },
): Promise<{ url: string; caminho: string; custo: number; modelo: string }> {
  const m: ModeloImagem = MODELOS_IMAGEM[motor]
  const refs = opts.referencias.slice(0, m.maxReferencias)
  const r = await chamarFal<{ images?: { url?: string; content_type?: string }[] }>(`https://fal.run/${refs.length ? m.comReferencias : m.textoParaImagem}`, {
    prompt: opts.prompt,
    ...m.extras,
    ...(refs.length ? { image_urls: refs } : {}),
  }, LIMITE_IMAGEM_MS)
  const origem = r.images?.[0]?.url
  if (!origem) throw new Error(`${m.nome} terminou sem devolver a imagem`)
  // a URL do fal expira: a imagem passa para o nosso bucket antes de entrar nos slides
  const baixada = await fetch(origem, { signal: AbortSignal.timeout(20_000) })
  if (!baixada.ok) throw new Error(`Não deu para baixar a imagem do ${m.nome} (HTTP ${baixada.status})`)
  const tipo = baixada.headers.get('content-type') ?? r.images?.[0]?.content_type ?? 'image/png'
  const ext = tipo.includes('jpeg') || tipo.includes('jpg') ? 'jpg' : tipo.includes('webp') ? 'webp' : 'png'
  const caminho = `${opts.postId}/imagens/${opts.nome}-${Date.now()}.${ext}`
  const { error } = await db.storage.from(BUCKET_POSTS).upload(caminho, Buffer.from(await baixada.arrayBuffer()), { contentType: tipo, upsert: true })
  if (error) throw new Error(`Falha ao guardar a imagem gerada: ${error.message}`)
  return { url: urlPublica(caminho), caminho, custo: m.preco, modelo: m.nome }
}
