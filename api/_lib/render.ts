import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, statfs, writeFile } from 'node:fs/promises'
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
export function desenharSetas(html: string) {
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
  return (await renderizarSlidesConferindo(html, largura, altura)).imagens
}

/** Renderiza e confere cada slide (texto cortado, sobreposto ou pequeno demais). */
export async function renderizarSlidesConferindo(html: string, largura = 1080, altura = 1350, prazoMs = PRAZO_DO_RENDER_MS): Promise<Render> {
  // o prazo conta desde já, incluindo a espera na fila de um navegador por vez
  const prazo = Date.now() + prazoMs
  return umNavegadorPorVez(() => renderizarSlidesAgora(desenharSetas(html), largura, altura, prazo))
}

/** Tempo total de um render, da fila à última foto: cabe com folga nos 300 s de uma função da Vercel. */
export const PRAZO_DO_RENDER_MS = 110_000

/**
 * Na Vercel, uma mesma instância atende vários pedidos ao mesmo tempo. Dois posts no designer ao mesmo tempo
 * abriam dois Chromiums juntos, e um derrubava o outro ("Target page, context or browser has been closed").
 * Aqui eles fazem fila: um navegador por vez em cada instância.
 */
let fila: Promise<unknown> = Promise.resolve()
export function umNavegadorPorVez<T>(fazer: () => Promise<T>): Promise<T> {
  const vez = fila.then(fazer, fazer)
  fila = vez.catch(() => {})
  return vez
}

/**
 * Separa o documento em um HTML por slide: o mesmo <head> e <body>, só com aquele <section class="slide">.
 * Cada página do Chromium carrega um slide só (uma imagem de fundo, uma fonte), em vez do post inteiro de uma vez,
 * que era o que derrubava o navegador da Vercel ("Target page, context or browser has been closed").
 */
export function separarSlides(html: string): string[] {
  const secao = /<section\b[^>]*\bclass\s*=\s*["'][^"']*\bslide\b[^"']*["'][^>]*>[\s\S]*?<\/section>/gi
  const trechos = Array.from(html.matchAll(secao))
  return trechos.map((t, i) => {
    let saida = ''
    let cursor = 0
    for (const [j, outro] of trechos.entries()) {
      saida += html.slice(cursor, outro.index!)
      if (j === i) saida += outro[0]
      cursor = outro.index! + outro[0].length
    }
    return saida + html.slice(cursor)
  })
}

/** Altura de cada slide: a arte de Stories e Reels dos anúncios (`<section class="slide story">`) é 9:16; o resto, a altura pedida. */
export function alturaDoSlide(parte: string, largura: number, altura: number) {
  const secao = parte.match(/<section\b[^>]*\bclass\s*=\s*["']([^"']*)["']/i)
  return secao && /\bstory\b/.test(secao[1]) ? Math.round((largura * 16) / 9) : altura
}

/** Problema que a checagem automática achou num slide (antes de gastar uma rodada de revisor nisso). */
export interface ProblemaDoSlide {
  slide: number
  problema: string
}

export interface Render {
  imagens: Buffer[]
  problemas: ProblemaDoSlide[]
}

// Roda dentro da página, depois de fontes e imagens: texto cortado pela borda do slide, texto por cima de outro
// texto e corpo de texto pequeno demais. É determinístico, então não precisa de modelo para achar.
const CONFERIR = `(() => {
  const slide = document.querySelector('section.slide')
  if (!slide) return []
  const limite = slide.getBoundingClientRect()
  const problemas = []
  const textos = []
  for (const el of slide.querySelectorAll('*')) {
    const temTexto = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 0)
    if (!temTexto) continue
    const estilo = getComputedStyle(el)
    if (estilo.display === 'none' || estilo.visibility === 'hidden' || Number(estilo.opacity) === 0) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const texto = el.textContent.trim().replace(/\\s+/g, ' ')
    const trecho = texto.length > 40 ? texto.slice(0, 40) + '…' : texto
    const folga = 2
    if (r.left < limite.left - folga || r.right > limite.right + folga || r.top < limite.top - folga || r.bottom > limite.bottom + folga) {
      problemas.push('texto cortado pela borda do slide: "' + trecho + '"')
    }
    if (el.scrollHeight > el.clientHeight + 4 && estilo.overflowY !== 'visible') {
      problemas.push('texto não cabe na caixa (fica cortado): "' + trecho + '"')
    }
    const tamanho = parseFloat(estilo.fontSize)
    if (texto.length >= 60 && tamanho < 28) problemas.push('texto do corpo com ' + Math.round(tamanho) + ' px (mínimo 28): "' + trecho + '"')
    textos.push({ el, r, trecho })
  }
  // faixa vazia: junta tudo o que ocupa espaço (texto, imagem, desenho, cartão com fundo) e procura o maior vão
  // na altura do slide, no slide inteiro e em cada metade (layout em colunas deixa uma coluna vazia)
  const fundo = getComputedStyle(slide).backgroundColor
  const area = limite.width * limite.height
  const blocos = textos.map((t) => t.r)
  for (const el of slide.querySelectorAll('*')) {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue
    const estilo = getComputedStyle(el)
    if (estilo.display === 'none' || estilo.visibility === 'hidden' || Number(estilo.opacity) < 0.15) continue
    const tag = el.tagName.toLowerCase()
    const midia = ['img', 'svg', 'video', 'canvas', 'picture'].includes(tag) || estilo.backgroundImage.includes('url(')
    // forma desenhada com degradê (fruta, círculo) conta; o degradê grande por cima da foto é só sombra
    const desenho = estilo.backgroundImage.includes('gradient(')
    const cor = estilo.backgroundColor
    const alfa = cor.startsWith('rgba') ? parseFloat(cor.split(',')[3]) : 1
    const cartao = cor !== fundo && cor !== 'transparent' && alfa > 0.05
    if (!midia && !cartao && !desenho) continue
    const r = el.getBoundingClientRect()
    if (r.width * r.height < 2000) continue
    if (!midia && !cartao && r.width * r.height > area * 0.35) continue
    // fundo do slide inteiro (cor chapada) não conta como conteúdo; foto de fundo conta
    if (!midia && r.width * r.height > area * 0.9) continue
    blocos.push(r)
  }
  const maiorVao = (esq, dir) => {
    const faixas = blocos
      .filter((r) => r.right > esq + 20 && r.left < dir - 20)
      .map((r) => [Math.max(0, r.top - limite.top), Math.min(limite.height, r.bottom - limite.top)])
      .filter(([a, b]) => b > a)
      .sort((a, b) => a[0] - b[0])
    if (!faixas.length) return null
    let fim = faixas[0][1]
    let vao = { de: 0, ate: 0 }
    for (const [a, b] of faixas.slice(1)) {
      if (a - fim > vao.ate - vao.de) vao = { de: fim, ate: a }
      fim = Math.max(fim, b)
    }
    const borda = Math.max(faixas[0][0], limite.height - fim)
    return { vao, borda }
  }
  const total = maiorVao(limite.left, limite.right)
  if (total) {
    const { vao, borda } = total
    if (vao.ate - vao.de > limite.height * 0.24) problemas.push('faixa vazia de y=' + Math.round(vao.de) + ' a y=' + Math.round(vao.ate) + ' px; aproxime os blocos ou aumente o elemento principal')
    else if (borda > limite.height * 0.36) problemas.push('o conteúdo ocupa só parte do slide: sobram ' + Math.round(borda) + ' px vazios em cima ou embaixo; distribua os blocos na altura')
    else {
      const meio = limite.left + limite.width / 2
      for (const [lado, esq, dir] of [['esquerda', limite.left, meio], ['direita', meio, limite.right]]) {
        const v = maiorVao(esq, dir)
        if (v && v.vao.ate - v.vao.de > limite.height * 0.3) problemas.push('coluna da ' + lado + ' com faixa vazia de y=' + Math.round(v.vao.de) + ' a y=' + Math.round(v.vao.ate) + ' px; distribua os blocos')
      }
    }
  }
  // área segura: no 4:5, o corte 1:1 da grade perde ~135 px em cima e embaixo (título ali some na miniatura);
  // no 9:16 do anúncio, o Meta cobre os 14% de cima (perfil, "Patrocinado") e os 35% de baixo (texto e botão do anúncio)
  const story = limite.height > limite.width * 1.6
  const corte = (limite.height - limite.width) / 2
  const seguro = story
    ? { de: Math.round(limite.height * 0.14), ate: Math.round(limite.height * 0.65), onde: 'área segura do story (o topo e os 35% de baixo ficam cobertos pelo Meta)' }
    : { de: corte, ate: limite.height - corte, onde: 'área central 1:1 (some no corte da grade)' }
  const fora = (r) => r.top - limite.top < seguro.de - 4 || r.bottom - limite.top > seguro.ate + 4
  if (story || corte > 40) {
    for (const t of textos) {
      if (parseFloat(getComputedStyle(t.el).fontSize) < 40) continue
      if (fora(t.r)) problemas.push('título fora da ' + seguro.onde + ': "' + t.trecho + '"')
    }
    // o logo em destaque também precisa aparecer; a assinatura pequena do rodapé pode ficar na faixa cortada
    for (const img of slide.querySelectorAll('img')) {
      const nome = ((img.getAttribute('src') || '') + ' ' + (img.getAttribute('alt') || '') + ' ' + img.className).toLowerCase()
      if (!/logo|icone|icon/.test(nome)) continue
      const r = img.getBoundingClientRect()
      if (Math.max(r.width, r.height) < 80) continue
      if (fora(r)) problemas.push('logo fora da ' + seguro.onde)
    }
  }
  for (let i = 0; i < textos.length; i++) {
    for (let j = i + 1; j < textos.length; j++) {
      const a = textos[i], b = textos[j]
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue
      const x = Math.max(0, Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left))
      const y = Math.max(0, Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top))
      const menor = Math.min(a.r.width * a.r.height, b.r.width * b.r.height)
      if (menor > 0 && (x * y) / menor > 0.25) problemas.push('texto sobreposto: "' + a.trecho + '" e "' + b.trecho + '"')
    }
  }
  return Array.from(new Set(problemas)).slice(0, 8)
})()`

type Modo = { espera: 'networkidle' | 'load'; leve: boolean }
// até três navegadores novos por slide: a segunda e a terceira vez não esperam a rede parar, e a terceira usa menos memória
const MODOS: Modo[] = [
  { espera: 'networkidle', leve: false },
  { espera: 'load', leve: false },
  { espera: 'load', leve: true },
]

/** Tempo máximo de um slide, do setContent à foto (normal: 1 a 3 s): passou disso, o navegador é considerado travado. */
const LIMITE_POR_SLIDE_MS = 30_000

/** Espera `fazer` até `ms`; passou disso, rejeita (quem chamou fecha o navegador, não fica pendurado). */
export function comLimite<T>(fazer: Promise<T>, ms: number, oQue: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const limite = new Promise<never>((_, falha) => {
    timer = setTimeout(() => falha(new Error(`${oQue} passou de ${Math.round(ms / 1000)} s`)), ms)
  })
  return Promise.race([fazer, limite]).finally(() => clearTimeout(timer))
}

/**
 * Fecha o navegador sem ficar preso: um Chromium que caiu pode não responder ao close. Um fechamento pendurado
 * travava a fila de um navegador por vez e todo render seguinte na mesma instância até o limite da função.
 */
export async function fecharNavegador(navegador: Navegador | null) {
  if (!navegador) return
  await comLimite(navegador.close(), 5_000, 'fechar o navegador').catch((e) => console.warn(e instanceof Error ? e.message : e))
}

async function renderizarSlidesAgora(html: string, largura: number, altura: number, prazo: number): Promise<Render> {
  const partes = separarSlides(html)
  if (partes.length === 0) throw new Error('O HTML não tem nenhum <section class="slide">')
  const imagens: Buffer[] = []
  const problemas: ProblemaDoSlide[] = []
  let navegador: Navegador | null = null
  try {
    for (const [i, parte] of partes.entries()) {
      let ultimo: unknown
      let feito = false
      for (const [n, modo] of MODOS.entries()) {
        const resta = prazo - Date.now()
        if (resta < 5_000) {
          ultimo ??= new Error('o render passou do prazo')
          break
        }
        const livre = await limparTmp()
        try {
          // um navegador novo por slide: com --single-process (o Chromium da Vercel), fechar a última página
          // derruba o navegador, e o slide seguinte caía em "browser.newPage: Target ... has been closed"
          navegador = await abrirNavegador()
          const r = await comLimite(renderizarUmSlide(navegador, parte, largura, alturaDoSlide(parte, largura, altura), modo), Math.min(LIMITE_POR_SLIDE_MS, resta), `render do slide ${i + 1}`)
          imagens.push(r.imagem)
          problemas.push(...r.problemas.map((problema) => ({ slide: i + 1, problema })))
          feito = true
          await fecharNavegador(navegador)
          navegador = null
          break
        } catch (e) {
          ultimo = e
          console.warn(`render do slide ${i + 1} falhou (tentativa ${n + 1}, /tmp com ${livre} MB livres)`, e)
          // o navegador pode ter caído: fecha (ou mata) e abre outro na próxima tentativa
          await fecharNavegador(navegador)
          navegador = null
          await new Promise((ok) => setTimeout(ok, 1500))
        }
      }
      if (!feito) {
        // a primeira linha do erro do Playwright basta; o espaço livre ajuda a entender uma queda do navegador
        const msg = ultimo instanceof Error ? ultimo.message.split('\n')[0] : String(ultimo)
        const livre = await limparTmp()
        throw new Error(`Slide ${i + 1}: ${msg}${livre >= 0 ? ` (espaço livre no servidor: ${livre} MB)` : ''}`)
      }
    }
    return { imagens, problemas }
  } finally {
    await fecharNavegador(navegador)
    await limparTmp()
  }
}

// Na Vercel o /tmp tem 512 MB e é tudo o que o Chromium tem para perfil, cache e memória compartilhada. O próprio
// Chromium descompactado ocupa uns 250 MB; cada vez que ele caía, o perfil temporário do Playwright ficava para trás,
// e numa instância quente o /tmp enchia ("Less than 64MB of free space in temporary directory") e todo render seguinte
// caía também. Antes de abrir, o que sobrou de perfis antigos sai e o espaço livre fica registrado.
const SOBRAS = /^(playwright_chromiumdev_profile-|puppeteer_dev_chrome_profile-|\.org\.chromium\.|\.com\.google\.Chrome\.|core\.|narracao-)/

/** Tira do /tmp o que ficou de navegadores anteriores e devolve quantos MB estão livres. */
export async function limparTmp() {
  const pasta = tmpdir()
  try {
    const nomes = await readdir(pasta)
    await Promise.all(nomes.filter((n) => SOBRAS.test(n)).map((n) => rm(join(pasta, n), { recursive: true, force: true }).catch(() => {})))
  } catch {
    // sem acesso ao /tmp: segue sem limpar
  }
  try {
    const s = await statfs(pasta)
    return Math.round((s.bavail * s.bsize) / 1e6)
  } catch {
    return -1
  }
}

/** Abre o Chromium: na Vercel o do @sparticuz/chromium, localmente o de CHROMIUM_PATH. */
export async function abrirNavegador() {
  const local = process.env.CHROMIUM_PATH
  if (local) return playwright.launch({ executablePath: local, args: ['--no-sandbox'] })
  const livre = await limparTmp()
  if (livre >= 0 && livre < 120) console.warn(`/tmp com só ${livre} MB livres antes de abrir o Chromium`)
  const executavel = await chromium.executablePath()
  await instalarFontesReserva()
  // sem cache em disco: cada render é uma página só, e o /tmp é curto
  return playwright.launch({ executablePath: executavel, args: [...chromium.args, '--disable-gpu', '--disk-cache-size=1', '--media-cache-size=1', '--disable-gpu-shader-disk-cache'] })
}

type Navegador = Awaited<ReturnType<typeof abrirNavegador>>

async function renderizarUmSlide(navegador: Navegador, html: string, largura: number, altura: number, modo: Modo): Promise<{ imagem: Buffer; problemas: string[] }> {
  const pagina = await navegador.newPage({ viewport: { width: largura, height: altura }, deviceScaleFactor: 1 })
  try {
    await pagina.setContent(html, { waitUntil: modo.espera, timeout: 45_000 })
    // modo leve: sem filtros e desfoques, que são o que mais gasta memória no Chromium da Vercel
    if (modo.leve) await pagina.addStyleTag({ content: '*{filter:none!important;backdrop-filter:none!important}' }).catch(() => {})
    // imagens que ainda não carregaram ganham até 15 s; a que falhar não trava o post
    await pagina.evaluate(() =>
      Promise.race([
        Promise.all(Array.from(document.images).map((img) => (img.complete ? null : new Promise((ok) => { img.onload = img.onerror = ok })))),
        new Promise((ok) => setTimeout(ok, 15_000)),
      ]),
    )
    // fonte do Google que não termina de carregar não segura o slide: 10 s e segue com a fonte que houver
    await comLimite(pagina.evaluate(() => document.fonts.ready), 10_000, 'carregar as fontes').catch(() => {})
    await pagina.waitForTimeout(300)
    const slide = await pagina.$('section.slide')
    if (!slide) throw new Error('O slide não apareceu na página')
    const imagem = await slide.screenshot({ type: 'jpeg', quality: 90 })
    // a checagem nunca derruba o render: sem ela, o revisor confere como antes
    const problemas = await Promise.race([pagina.evaluate<string[]>(CONFERIR), new Promise<string[]>((ok) => setTimeout(() => ok([]), 10_000))]).catch(() => [])
    return { imagem, problemas }
  } finally {
    await pagina.close().catch(() => {})
  }
}
