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

/**
 * Renderiza cada `<section class="slide">` do HTML como JPEG.
 * Na Vercel usa o Chromium do @sparticuz/chromium; localmente, CHROMIUM_PATH.
 */
export async function renderizarSlides(html: string, largura = 1080, altura = 1350): Promise<Buffer[]> {
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
