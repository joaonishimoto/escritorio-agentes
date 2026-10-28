// Publicação pela Instagram Graph API (mesmo fluxo da skill post-instagram-drinfy).
const VERSAO = process.env.INSTAGRAM_API_VERSION ?? 'v23.0'
const BASE = `https://graph.instagram.com/${VERSAO}`

async function chamar<T>(metodo: 'GET' | 'POST', caminho: string, params: Record<string, string>, token: string): Promise<T> {
  const qs = new URLSearchParams({ ...params, access_token: token })
  const r = await fetch(`${BASE}/${caminho}${metodo === 'GET' ? `?${qs}` : ''}`, {
    method: metodo,
    body: metodo === 'POST' ? qs : undefined,
  })
  const json = (await r.json()) as T & { error?: { message: string; code?: number } }
  if (!r.ok || json.error) {
    const msg = json.error?.message ?? `HTTP ${r.status}`
    if (json.error?.code === 190) throw new Error(`Token do Instagram expirado ou inválido. Renove no painel da Meta. (${msg})`)
    throw new Error(`Instagram: ${msg}`)
  }
  return json
}

async function esperarPronto(containerId: string, token: string, aoEsperar: () => Promise<void>, tentativas = 30) {
  for (let i = 0; i < tentativas; i++) {
    const { status_code } = await chamar<{ status_code: string }>('GET', containerId, { fields: 'status_code' }, token)
    if (status_code === 'FINISHED') return
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Instagram recusou a mídia (${status_code})`)
    await aoEsperar()
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error('Instagram demorou demais para processar a mídia')
}

export async function publicarCarrossel(opts: {
  contaId: string
  token: string
  imagens: string[]
  legenda: string
  aoProgredir: (msg: string) => Promise<void>
}): Promise<{ mediaId: string; permalink: string }> {
  const { contaId, token, imagens, legenda, aoProgredir } = opts
  let criacao: string
  if (imagens.length === 1) {
    criacao = (await chamar<{ id: string }>('POST', `${contaId}/media`, { image_url: imagens[0], caption: legenda }, token)).id
  } else {
    const filhos: string[] = []
    for (const [i, url] of imagens.entries()) {
      await aoProgredir(`Enviando imagem ${i + 1} de ${imagens.length}`)
      filhos.push((await chamar<{ id: string }>('POST', `${contaId}/media`, { image_url: url, is_carousel_item: 'true' }, token)).id)
    }
    criacao = (
      await chamar<{ id: string }>('POST', `${contaId}/media`, { media_type: 'CAROUSEL', children: filhos.join(','), caption: legenda }, token)
    ).id
  }
  await esperarPronto(criacao, token, () => aoProgredir('Esperando o Instagram processar'))
  const { id } = await chamar<{ id: string }>('POST', `${contaId}/media_publish`, { creation_id: criacao }, token)
  const { permalink } = await chamar<{ permalink: string }>('GET', id, { fields: 'permalink' }, token)
  return { mediaId: id, permalink }
}

/** Reel: o Instagram baixa o vídeo da URL pública e processa; a capa é o primeiro slide. */
export async function publicarReel(opts: {
  contaId: string
  token: string
  video: string
  capa?: string
  legenda: string
  aoProgredir: (msg: string) => Promise<void>
}): Promise<{ mediaId: string; permalink: string }> {
  const { contaId, token, video, capa, legenda, aoProgredir } = opts
  await aoProgredir('Enviando o vídeo')
  const params: Record<string, string> = { media_type: 'REELS', video_url: video, caption: legenda, share_to_feed: 'true' }
  if (capa) params.cover_url = capa
  const criacao = (await chamar<{ id: string }>('POST', `${contaId}/media`, params, token)).id
  // vídeo demora mais que imagem para processar: até ~3 minutos
  await esperarPronto(criacao, token, () => aoProgredir('Esperando o Instagram processar o vídeo'), 60)
  const { id } = await chamar<{ id: string }>('POST', `${contaId}/media_publish`, { creation_id: criacao }, token)
  const { permalink } = await chamar<{ permalink: string }>('GET', id, { fields: 'permalink' }, token)
  return { mediaId: id, permalink }
}
