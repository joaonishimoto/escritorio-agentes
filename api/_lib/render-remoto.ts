import { BUCKET_POSTS, db, urlPublica } from './db.js'
import { renderizarSlides } from './render.js'

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

/** Renderiza cada slide e sobe no bucket de posts. Devolve a lista na ordem. */
export async function renderizarESalvar(html: string, pasta: string): Promise<Slide[]> {
  const url = process.env.VERCEL ? origemDoApp() : null
  if (url) return renderizarLonge(url, html, pasta)
  return salvarImagens(await renderizarSlides(html), pasta)
}

async function renderizarLonge(url: string, html: string, pasta: string): Promise<Slide[]> {
  const r = await fetch(`${url}/api/render`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-executor-secret': process.env.EXECUTOR_SECRET ?? '' },
    body: JSON.stringify({ html, pasta }),
  })
  const json = (await r.json().catch(() => null)) as { slides?: Slide[]; erro?: string } | null
  if (!r.ok || !json?.slides) throw new Error(json?.erro ?? `Render: HTTP ${r.status}`)
  return json.slides
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
