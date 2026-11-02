// Imagens que o designer gera para o post: pela OpenAI (o gerador de imagens do ChatGPT, com OPENAI_API_KEY)
// ou pelo fal.ai (mesma FAL_KEY dos vídeos). Com fotos de referência da marca, o modelo usa elas como base;
// sem, gera só pelo texto.
import { BUCKET_POSTS, db, urlPublica } from './db.js'
import { chamarFal } from './fal.js'

export type Provedor = 'openai' | 'fal'

export interface ModeloImagem {
  nome: string
  provedor: Provedor
  /** fal: rota do modelo; openai: nome do modelo */
  textoParaImagem: string
  comReferencias: string
  /** US$ por imagem gerada (estimativa) */
  preco: number
  /** quantas referências o modelo aceita de uma vez */
  maxReferencias: number
  extras: Record<string, unknown>
}

/** O modelo de imagem da OpenAI; dá para trocar na Vercel (OPENAI_IMAGE_MODEL) quando sair um mais novo. */
const MODELO_OPENAI = () => process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2'

export const MODELOS_IMAGEM = {
  'gpt-image': {
    nome: 'ChatGPT (GPT Image)',
    provedor: 'openai',
    textoParaImagem: 'generations',
    comReferencias: 'edits',
    // retrato em qualidade média: cerca de US$ 0,04 a 0,05 por imagem
    preco: 0.05,
    maxReferencias: 8,
    // 2:3 em pé; o slide é 4:5 e o HTML recorta com folga em cima e embaixo
    extras: { size: '1024x1536', quality: 'medium' },
  },
  seedream: {
    nome: 'Seedream 4',
    provedor: 'fal',
    textoParaImagem: 'fal-ai/bytedance/seedream/v4/text-to-image',
    comReferencias: 'fal-ai/bytedance/seedream/v4/edit',
    preco: 0.03,
    maxReferencias: 6,
    extras: { image_size: { width: 1080, height: 1350 }, num_images: 1 },
  },
  'nano-banana': {
    nome: 'Nano Banana',
    provedor: 'fal',
    textoParaImagem: 'fal-ai/nano-banana',
    comReferencias: 'fal-ai/nano-banana/edit',
    preco: 0.0398,
    maxReferencias: 6,
    extras: { aspect_ratio: '4:5', num_images: 1 },
  },
  'nano-banana-pro': {
    nome: 'Nano Banana Pro',
    provedor: 'fal',
    textoParaImagem: 'fal-ai/nano-banana-pro',
    comReferencias: 'fal-ai/nano-banana-pro/edit',
    preco: 0.15,
    maxReferencias: 14,
    extras: { aspect_ratio: '4:5', num_images: 1 },
  },
} satisfies Record<string, ModeloImagem>
export type MotorImagem = keyof typeof MODELOS_IMAGEM
/** quanto esperar por uma imagem: passou disso, o designer segue com as fotos da marca em vez de travar o passo */
export const LIMITE_IMAGEM_MS = 90_000
/** teto de imagens geradas por post, para o custo não fugir (≈ US$ 0,15 no ChatGPT, US$ 0,09 no Seedream) */
export const MAX_IMAGENS_POR_POST = 3

export const eMotorImagem = (m: unknown): m is MotorImagem => typeof m === 'string' && m in MODELOS_IMAGEM

/** Motores que têm chave na Vercel agora. */
export function motorTemChave(motor: MotorImagem) {
  return MODELOS_IMAGEM[motor].provedor === 'openai' ? !!process.env.OPENAI_API_KEY : !!process.env.FAL_KEY
}

/** Padrão quando o post não escolheu: o ChatGPT se tem a chave da OpenAI, senão o Seedream do fal.ai, senão nenhum. */
export function motorImagemPadrao(): MotorImagem | null {
  if (process.env.OPENAI_API_KEY) return 'gpt-image'
  if (process.env.FAL_KEY) return 'seedream'
  return null
}

/** Explica em português o erro que a API de imagens da OpenAI devolveu. */
export function explicarErroOpenAI(status: number, mensagem: string) {
  if (status === 401) return 'A OpenAI recusou a chave (OPENAI_API_KEY errada ou apagada)'
  if (status === 403) return `A OpenAI negou o acesso ao gerador de imagens: ${mensagem || 'a organização pode precisar de verificação em platform.openai.com'}`
  if (status === 429) return /quota|billing|credit/i.test(mensagem) ? 'A conta da OpenAI está sem crédito para gerar imagens' : 'A OpenAI pediu para esperar (muitas imagens seguidas)'
  if (status === 400 && /safety|moderation/i.test(mensagem)) return 'A OpenAI barrou o pedido de imagem pelo filtro de segurança'
  return `OpenAI respondeu HTTP ${status}${mensagem ? `: ${mensagem}` : ''}`
}

async function chamarOpenAI(m: ModeloImagem, prompt: string, refs: string[]): Promise<{ dados: Buffer; tipo: string }> {
  const chave = process.env.OPENAI_API_KEY
  if (!chave) throw new Error('Falta a OPENAI_API_KEY na Vercel')
  const sinal = AbortSignal.timeout(LIMITE_IMAGEM_MS)
  let r: Response
  if (refs.length) {
    // com referências: o modelo parte das fotos da marca (produto, copo, ambiente) em vez de inventar
    const form = new FormData()
    form.append('model', MODELO_OPENAI())
    form.append('prompt', prompt)
    for (const [k, v] of Object.entries(m.extras)) form.append(k, String(v))
    const baixadas = await Promise.all(
      refs.map(async (url, i) => {
        const b = await fetch(url, { signal: AbortSignal.timeout(20_000) })
        if (!b.ok) return null
        const tipo = b.headers.get('content-type') ?? 'image/png'
        const ext = tipo.includes('jpeg') || tipo.includes('jpg') ? 'jpg' : tipo.includes('webp') ? 'webp' : 'png'
        return new File([await b.arrayBuffer()], `referencia-${i}.${ext}`, { type: tipo })
      }),
    )
    const arquivos = baixadas.filter((f): f is File => !!f)
    if (!arquivos.length) return chamarOpenAI(m, prompt, [])
    for (const f of arquivos) form.append('image[]', f)
    r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${chave}` }, body: form, signal: sinal })
  } else {
    r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODELO_OPENAI(), prompt, n: 1, ...m.extras }),
      signal: sinal,
    })
  }
  const json = (await r.json().catch(() => null)) as { data?: { b64_json?: string; url?: string }[]; error?: { message?: string } } | null
  if (!r.ok) throw new Error(explicarErroOpenAI(r.status, json?.error?.message ?? ''))
  const item = json?.data?.[0]
  if (item?.b64_json) return { dados: Buffer.from(item.b64_json, 'base64'), tipo: 'image/png' }
  if (item?.url) {
    const b = await fetch(item.url, { signal: AbortSignal.timeout(20_000) })
    if (b.ok) return { dados: Buffer.from(await b.arrayBuffer()), tipo: b.headers.get('content-type') ?? 'image/png' }
  }
  throw new Error(`${m.nome} terminou sem devolver a imagem`)
}

async function chamarFalImagem(m: ModeloImagem, prompt: string, refs: string[]): Promise<{ dados: Buffer; tipo: string }> {
  const r = await chamarFal<{ images?: { url?: string; content_type?: string }[] }>(`https://fal.run/${refs.length ? m.comReferencias : m.textoParaImagem}`, {
    prompt,
    ...m.extras,
    ...(refs.length ? { image_urls: refs } : {}),
  }, LIMITE_IMAGEM_MS)
  const origem = r.images?.[0]?.url
  if (!origem) throw new Error(`${m.nome} terminou sem devolver a imagem`)
  // a URL do fal expira: a imagem passa para o nosso bucket antes de entrar nos slides
  const baixada = await fetch(origem, { signal: AbortSignal.timeout(20_000) })
  if (!baixada.ok) throw new Error(`Não deu para baixar a imagem do ${m.nome} (HTTP ${baixada.status})`)
  return { dados: Buffer.from(await baixada.arrayBuffer()), tipo: baixada.headers.get('content-type') ?? r.images?.[0]?.content_type ?? 'image/png' }
}

/** Gera uma imagem em pé e guarda no bucket do post. Devolve a URL pública e o custo. */
export async function gerarImagem(
  motor: MotorImagem,
  opts: { prompt: string; referencias: string[]; postId: string; nome: string },
): Promise<{ url: string; caminho: string; custo: number; modelo: string }> {
  const m: ModeloImagem = MODELOS_IMAGEM[motor]
  const refs = opts.referencias.slice(0, m.maxReferencias)
  const { dados, tipo } = m.provedor === 'openai' ? await chamarOpenAI(m, opts.prompt, refs) : await chamarFalImagem(m, opts.prompt, refs)
  const ext = tipo.includes('jpeg') || tipo.includes('jpg') ? 'jpg' : tipo.includes('webp') ? 'webp' : 'png'
  const caminho = `${opts.postId}/imagens/${opts.nome}-${Date.now()}.${ext}`
  const { error } = await db.storage.from(BUCKET_POSTS).upload(caminho, dados, { contentType: tipo, upsert: true })
  if (error) throw new Error(`Falha ao guardar a imagem gerada: ${error.message}`)
  return { url: urlPublica(caminho), caminho, custo: m.preco, modelo: m.nome }
}
