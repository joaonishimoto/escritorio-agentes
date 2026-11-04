// Publicação direta: você manda ao publicador um vídeo ou imagens prontos com a legenda, sem passar pela equipe.
// Vira um post como os outros (aparece na sala, no histórico e no calendário) e vai direto para o publicador.

export interface MidiaEnviada {
  tipo: 'imagem' | 'video'
  url: string
}

export interface PublicacaoDireta {
  formato: 'reel' | 'foto' | 'carrossel'
  legenda: string
  slides: { ordem: number; url: string; caminho: string }[]
  video: { url: string; caminho: string; prompt: string; segundos: number; modelo: string } | null
  agendado_para: string | null
}

/** O Instagram aceita até 2.200 caracteres na legenda e até 10 itens num carrossel. */
export const LIMITE_LEGENDA = 2200
export const LIMITE_IMAGENS = 10

/**
 * Confere o que veio do app e monta o post. Só aceita arquivos do armazenamento da própria marca
 * (`base` é a URL pública da pasta dela), um vídeo com a imagem da capa, ou de 1 a 10 imagens.
 */
export function montarPublicacaoDireta(
  entrada: { legenda?: unknown; midias?: unknown; quando?: unknown },
  base: string,
  agora = new Date(),
): { erro: string } | { post: PublicacaoDireta } {
  const legenda = typeof entrada.legenda === 'string' ? entrada.legenda.trim() : ''
  if (legenda.length > LIMITE_LEGENDA) return { erro: `A legenda passou de ${LIMITE_LEGENDA} caracteres, o limite do Instagram` }
  const midias = (Array.isArray(entrada.midias) ? entrada.midias : []).filter(
    (m): m is MidiaEnviada => !!m && typeof m === 'object' && (m.tipo === 'imagem' || m.tipo === 'video') && typeof m.url === 'string',
  )
  if (midias.some((m) => !m.url.startsWith(base) || m.url.includes('..'))) return { erro: 'Os arquivos precisam ser enviados pelo app, na pasta da marca' }
  const videos = midias.filter((m) => m.tipo === 'video')
  const imagens = midias.filter((m) => m.tipo === 'imagem')
  if (!videos.length && !imagens.length) return { erro: 'Mande um vídeo ou pelo menos uma imagem' }
  if (videos.length > 1) return { erro: 'Mande um vídeo só (o Reel)' }
  if (videos.length && !imagens.length) return { erro: 'Mande também a imagem da capa do Reel' }
  if (videos.length && imagens.length > 1) return { erro: 'Com vídeo, dá para mandar só uma imagem, que vira a capa do Reel' }
  if (imagens.length > LIMITE_IMAGENS) return { erro: `O Instagram aceita até ${LIMITE_IMAGENS} imagens num carrossel` }

  let agendado_para: string | null = null
  if (entrada.quando !== undefined && entrada.quando !== null && entrada.quando !== '') {
    const data = typeof entrada.quando === 'string' ? new Date(entrada.quando) : null
    if (!data || Number.isNaN(data.getTime())) return { erro: 'Escolha a data e a hora' }
    if (data.getTime() < agora.getTime() + 60_000) return { erro: 'Escolha um horário no futuro' }
    agendado_para = data.toISOString()
  }

  const caminho = (url: string) => url.slice(base.length)
  const slides = imagens.map((m, i) => ({ ordem: i + 1, url: m.url, caminho: caminho(m.url) }))
  const video = videos[0] ? { url: videos[0].url, caminho: caminho(videos[0].url), prompt: '', segundos: 0, modelo: 'enviado' } : null
  const formato = video ? 'reel' : imagens.length === 1 ? 'foto' : 'carrossel'
  return { post: { formato, legenda, slides, video, agendado_para } }
}

/** O pedido que fica no post, para você reconhecer na sala e no calendário. */
export function briefingDireto(legenda: string, formato: PublicacaoDireta['formato']) {
  const tipo = formato === 'reel' ? 'Reel' : formato === 'foto' ? 'Foto' : 'Carrossel'
  const inicio = legenda.split('\n').find((l) => l.trim())?.trim() ?? ''
  const resumo = inicio.length > 80 ? `${inicio.slice(0, 77)}…` : inicio
  return `${tipo} ${formato === 'foto' ? 'enviada' : 'enviado'} por você${resumo ? `: ${resumo}` : ''}`
}
