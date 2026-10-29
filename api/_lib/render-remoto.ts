import { BUCKET_POSTS, db, urlPublica } from './db.js'
import { renderizarSlidesConferindo, type ProblemaDoSlide } from './render.js'

// O render dos slides roda numa função própria da Vercel (/api/render): o Chromium fica sozinho com a memória
// dela, longe do executor, que carrega os agentes, o SDK e a fila. Fora da Vercel (ou sem saber a própria URL),
// renderiza aqui mesmo.

export interface Slide {
  ordem: number
  caminho: string
  url: string
}

let origem: string | null = null

/** A URL do próprio app, vinda da requisição que acordou o executor; é por ela que o executor chama /api/render. */
export function definirOrigem(url: string) {
  origem = url
}

function origemDoApp() {
  if (origem) return origem
  const producao = process.env.VERCEL_PROJECT_PRODUCTION_URL
  return producao ? `https://${producao}` : null
}

export interface Renderizado {
  slides: Slide[]
  /** o que a checagem automática achou (texto cortado, sobreposto, pequeno) */
  problemas: ProblemaDoSlide[]
}

/** Renderiza cada slide, confere e sobe no bucket de posts. Devolve a lista na ordem e os problemas achados. */
export async function renderizarESalvar(html: string, pasta: string): Promise<Renderizado> {
  const url = process.env.VERCEL ? origemDoApp() : null
  if (url) {
    try {
      return await renderizarLonge(url, html, pasta)
    } catch (e) {
      // a função de render não respondeu (travou, 504, rede): desenha aqui mesmo em vez de esperar 5 minutos
      // três vezes; o executor também tem 2 GB e um navegador por vez
      if (!semResposta(e)) throw e
      console.warn('render remoto sem resposta, renderizando no executor', e instanceof Error ? e.message : e)
    }
  }
  const r = await renderizarSlidesConferindo(html)
  return { slides: await salvarImagens(r.imagens, pasta), problemas: r.problemas }
}

/** Quanto o executor espera pela função de render: um post de 10 slides leva perto de um minuto. */
const ESPERA_RENDER_MS = 150_000

class ErroDeRender extends Error {
  constructor(
    msg: string,
    public status: number,
  ) {
    super(msg)
  }
}

/** Erro que não diz nada sobre o HTML (a função não respondeu), e por isso vale tentar aqui mesmo. */
export function semResposta(e: unknown) {
  if (e instanceof ErroDeRender) return e.status >= 500
  if (e instanceof Error) return e.name === 'TimeoutError' || e.name === 'AbortError' || /fetch failed|ECONNRESET|socket/i.test(e.message)
  return false
}

async function renderizarLonge(url: string, html: string, pasta: string): Promise<Renderizado> {
  const r = await fetch(`${url}/api/render`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-executor-secret': process.env.EXECUTOR_SECRET ?? '' },
    body: JSON.stringify({ html, pasta }),
    signal: AbortSignal.timeout(ESPERA_RENDER_MS),
  })
  const json = (await r.json().catch(() => null)) as { slides?: Slide[]; problemas?: ProblemaDoSlide[]; erro?: string } | null
  if (!r.ok || !json?.slides) throw new ErroDeRender(json?.erro ?? `Render: HTTP ${r.status}`, r.status)
  return { slides: json.slides, problemas: json.problemas ?? [] }
}

export async function salvarImagens(imagens: Buffer[], pasta: string): Promise<Slide[]> {
  const slides: Slide[] = []
  for (const [i, img] of imagens.entries()) {
    const caminho = `${pasta}/slide-${i + 1}.jpg`
    const { error } = await db.storage.from(BUCKET_POSTS).upload(caminho, img, { contentType: 'image/jpeg', upsert: true })
    if (error) throw new Error(`Falha ao subir slide ${i + 1}: ${error.message}`)
    slides.push({ ordem: i + 1, caminho, url: urlPublica(caminho) })
  }
  return slides
}
