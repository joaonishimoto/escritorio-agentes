// Anúncio no Meta, do lado do app: os nomes do Novo post e da gaveta. Os mesmos ids de api/_lib/anuncio.ts.

export const OBJETIVOS_ANUNCIO = [
  { id: 'vendas', nome: 'Vendas', desc: 'Oferta clara para comprar agora' },
  { id: 'trafego', nome: 'Tráfego', desc: 'Levar o clique para o site' },
  { id: 'cadastros', nome: 'Cadastros', desc: 'Deixar o contato por uma isca' },
  { id: 'app', nome: 'Promoção do app', desc: 'Instalar o app' },
  { id: 'engajamento', nome: 'Engajamento', desc: 'Comentar ou mandar mensagem' },
  { id: 'reconhecimento', nome: 'Reconhecimento', desc: 'Ser lembrado, pouco texto' },
] as const
export type ObjetivoAnuncio = (typeof OBJETIVOS_ANUNCIO)[number]['id']

export const ETAPAS_FUNIL = [
  { id: 'frio', nome: 'Público frio', desc: 'Nunca ouviu falar da marca' },
  { id: 'morno', nome: 'Público morno', desc: 'Conhece ou tem uma ocasião' },
  { id: 'quente', nome: 'Remarketing', desc: 'Já visitou e não comprou' },
] as const
export type EtapaFunil = (typeof ETAPAS_FUNIL)[number]['id']

/** Limites que o Meta mostra sem cortar (os mesmos de api/_lib/anuncio.ts). */
export const LIMITES = { texto_principal: 125, titulo: 40, descricao: 30 } as const

export interface Pacote {
  nome: string
  texto_principal: string[]
  titulo: string[]
  descricao: string
  botao: string
}

export interface Anuncio {
  objetivo: ObjetivoAnuncio
  etapa: EtapaFunil
  destino?: string
  pacote?: Pacote
}

export const nomeDoObjetivo = (id?: string) => OBJETIVOS_ANUNCIO.find((o) => o.id === id)?.nome ?? 'Anúncio'
export const nomeDaEtapa = (id?: string) => ETAPAS_FUNIL.find((e) => e.id === id)?.nome ?? ''

/** As artes do anúncio na ordem em que o designer de criativos entrega: feed 4:5 e Stories e Reels 9:16. */
export const ARTES = [
  { nome: 'Feed', medida: '4:5 · 1080 × 1350', arquivo: 'feed-4x5' },
  { nome: 'Stories e Reels', medida: '9:16 · 1080 × 1920', arquivo: 'stories-9x16' },
] as const

/** Nome do arquivo de cada arte, para chegar organizado na pasta de downloads. */
export function nomeDoArquivo(pacote: Pick<Pacote, 'nome'> | undefined, i: number) {
  const base = (pacote?.nome || 'anuncio')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return `${base || 'anuncio'}-${ARTES[i]?.arquivo ?? `arte-${i + 1}`}.jpg`
}

/** Baixa a imagem como arquivo; se o navegador não deixar buscar (rede, CORS), abre numa aba nova para salvar. */
export async function baixarArquivo(url: string, nome: string) {
  try {
    const r = await fetch(url)
    if (!r.ok) throw new Error(String(r.status))
    const blob = await r.blob()
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = nome
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000)
  } catch {
    window.open(url, '_blank', 'noopener')
  }
}
