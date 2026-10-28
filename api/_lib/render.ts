import chromium from '@sparticuz/chromium'
import { chromium as playwright } from 'playwright-core'

/**
 * Renderiza cada `<section class="slide">` do HTML como JPEG.
 * Na Vercel usa o Chromium do @sparticuz/chromium; localmente, CHROMIUM_PATH.
 */
export async function renderizarSlides(html: string, largura = 1080, altura = 1350): Promise<Buffer[]> {
  const local = process.env.CHROMIUM_PATH
  const navegador = await playwright.launch(
    local ? { executablePath: local, args: ['--no-sandbox'] } : { executablePath: await chromium.executablePath(), args: chromium.args },
  )
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
