import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import chromium from '@sparticuz/chromium'
import { chromium as playwright } from 'playwright-core'

// O Chromium da Vercel não tem fontes de reserva: setas (→) e outros símbolos que a fonte do slide não cobre
// saíam como quadradinhos. Estas entram na pasta de fontes dele antes de abrir.
const FONTES_RESERVA = [
  'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansmath/NotoSansMath-Regular.ttf',
  'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssymbols2/NotoSansSymbols2-Regular.ttf',
]

async function instalarFontesReserva() {
  const pasta = process.env.FONTCONFIG_PATH ?? join(tmpdir(), 'fonts')
  await mkdir(pasta, { recursive: true })
  await Promise.all(
    FONTES_RESERVA.map(async (url) => {
      const destino = join(pasta, url.split('/').pop()!)
      if (existsSync(destino)) return
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
        if (r.ok) await writeFile(destino, Buffer.from(await r.arrayBuffer()))
      } catch (e) {
        console.warn('fonte de reserva não baixou', url, e)
      }
    }),
  )
}

// setas viram desenho: não dependem de a fonte ter o caractere (antes saía um quadradinho)
const SETA = (d: string) =>
  `<svg viewBox="0 0 24 24" width="1em" height="1em" style="display:inline-block;vertical-align:-0.12em" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`
const SETAS: Record<string, string> = {
  '→': SETA('M4 12h15M13 6l6 6-6 6'),
  '←': SETA('M20 12H5M11 6l-6 6 6 6'),
  '➜': SETA('M4 12h15M13 6l6 6-6 6'),
  '➔': SETA('M4 12h15M13 6l6 6-6 6'),
  '⟶': SETA('M4 12h15M13 6l6 6-6 6'),
}

/** Troca as setas só no texto (fora das tags), para não quebrar atributos nem CSS. */
function desenharSetas(html: string) {
  const corpo = html.search(/<body[\s>]/i)
  const inicio = corpo >= 0 ? corpo : 0
  const resto = html.slice(inicio).replace(/>([^<]*)</g, (_, texto: string) => `>${texto.replace(/[→←➜➔⟶]/g, (c) => SETAS[c])}<`)
  return html.slice(0, inicio) + resto
}

/**
 * Renderiza cada `<section class="slide">` do HTML como JPEG.
 * Na Vercel usa o Chromium do @sparticuz/chromium; localmente, CHROMIUM_PATH.
 */
export async function renderizarSlides(html: string, largura = 1080, altura = 1350): Promise<Buffer[]> {
  html = desenharSetas(html)
  const local = process.env.CHROMIUM_PATH
  const executavel = local ?? (await chromium.executablePath())
  if (!local) await instalarFontesReserva()
  const navegador = await playwright.launch(local ? { executablePath: local, args: ['--no-sandbox'] } : { executablePath: executavel, args: chromium.args })
  try {
    const pagina = await navegador.newPage({ viewport: { width: largura, height: altura }, deviceScaleFactor: 1 })
    await pagina.setContent(html, { waitUntil: 'networkidle', timeout: 45_000 })
    await pagina.evaluate(() => document.fonts.ready)
    await pagina.waitForTimeout(300)
    const slides = await pagina.$$('section.slide')
    if (slides.length === 0) throw new Error('O HTML não tem nenhum <section class="slide">')
    const imagens: Buffer[] = []
    for (const s of slides) imagens.push(await s.screenshot({ type: 'jpeg', quality: 90 }))
    return imagens
  } finally {
    await navegador.close()
  }
}
