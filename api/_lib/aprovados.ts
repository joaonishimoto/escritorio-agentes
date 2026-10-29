// Layout aprovado: o post que você publicou é o melhor exemplo de como a marca deve parecer.
// O designer recebe o CSS do último post publicado (de preferência com o mesmo layout da pauta de agora)
// para repetir fontes, cores, espaçamentos e assinatura, sem copiar a composição.
import type { Contexto } from './contexto.js'
import { db } from './db.js'

const MAX_CSS = 6000
const MAX_CAPA = 4000

/** Junta o CSS de todas as tags <style>, sem comentários e com espaços enxutos. */
export function extrairEstilo(html: string) {
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n')
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};:,])\s*/g, '$1')
    .trim()
    .slice(0, MAX_CSS)
}

/** O HTML do primeiro slide (a capa), para ver como as classes foram usadas. */
export function primeiroSlide(html: string) {
  const m = html.match(/<section[^>]*class=["'][^"']*\bslide\b[^"']*["'][^>]*>[\s\S]*?<\/section>/i)
  return m ? m[0].replace(/\s+/g, ' ').slice(0, MAX_CAPA) : ''
}

export interface Publicado {
  layout?: string | null
  html: string
}

/** Escolhe o exemplo: o mais recente com o mesmo layout; se nenhum, o mais recente. */
export function escolherExemplo(publicados: Publicado[], layout: string | null | undefined): (Publicado & { mesmoLayout: boolean }) | null {
  const comHtml = publicados.filter((p) => p.html)
  const igual = layout ? comHtml.find((p) => p.layout === layout) : undefined
  const exemplo = igual ?? comHtml[0]
  return exemplo ? { ...exemplo, mesmoLayout: !!igual } : null
}

export function textoDoExemplo(e: Publicado & { mesmoLayout: boolean }) {
  const css = extrairEstilo(e.html)
  if (!css) return ''
  return [
    `## Layout aprovado (CSS de um post que o dono aprovou e publicou${e.mesmoLayout ? ', com o mesmo layout de agora' : ''})`,
    'Reaproveite daqui as fontes, cores, tamanhos de texto, espaçamentos, cantos, assinatura e selo, para os posts da marca parecerem da mesma família. ' +
      (e.mesmoLayout ? 'Como o layout é o mesmo, pode seguir também a composição da capa.' : 'A composição continua seguindo a direção de layout desta pauta.'),
    '```css',
    css,
    '```',
    e.mesmoLayout && primeiroSlide(e.html) ? `Capa desse post:\n\`\`\`html\n${primeiroSlide(e.html)}\n\`\`\`` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Busca os últimos posts publicados da marca e monta o texto para o designer (vazio se não há nenhum). */
export async function layoutAprovado(ctx: Contexto): Promise<string> {
  const { data: posts } = await db
    .from('posts')
    .select('id')
    .eq('marca_id', ctx.marca.id)
    .eq('status', 'publicado')
    .neq('id', ctx.post.id)
    .order('publicado_em', { ascending: false })
    .limit(8)
  const ids = (posts ?? []).map((p) => p.id as string)
  if (!ids.length) return ''
  const { data: passos } = await db.from('passos').select('post_id, agente, saida, terminado_em').in('post_id', ids).in('agente', ['chefe', 'designer']).eq('status', 'feito').order('terminado_em')
  // o último passo feito de cada agente em cada post é o que valeu
  const porPost = new Map<string, Publicado>()
  for (const p of passos ?? []) {
    const atual = porPost.get(p.post_id) ?? { html: '' }
    const s = (p.saida ?? {}) as { html?: string; layout?: string }
    if (p.agente === 'designer' && s.html) atual.html = s.html
    if (p.agente === 'chefe') atual.layout = s.layout
    porPost.set(p.post_id, atual)
  }
  const publicados = ids.map((id) => porPost.get(id)).filter((p): p is Publicado => !!p)
  const exemplo = escolherExemplo(publicados, (ctx.saidas.chefe as { layout?: string } | undefined)?.layout)
  return exemplo ? textoDoExemplo(exemplo) : ''
}
