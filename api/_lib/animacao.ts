import { MUXER_JS } from './muxer-fonte.js'
import { abrirNavegador, desenharSetas, limparTmp, umNavegadorPorVez } from './render.js'

// Vídeo feito pelo próprio app: o Claude escreve uma animação em HTML/CSS, o Chromium mostra quadro a quadro
// e o codificador de vídeo do navegador (WebCodecs) monta o MP4. Não depende de serviço de vídeo pago.
const ORIGEM = 'https://animacao.local'
const FPS = 24
const LARGURA = 1080
const ALTURA = 1920

// roda dentro da página de codificação; fica em texto para o empacotador não mexer no código
const CODIFICADOR = `
let enc, muxer, falha = null, fps = 24
function iniciar(w, h, quadros) {
  fps = quadros
  muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: w, height: h, frameRate: fps }, fastStart: 'in-memory' })
  enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { falha = e } })
  enc.configure({ codec: 'avc1.640028', width: w, height: h, bitrate: 8000000, framerate: fps, avc: { format: 'avc' } })
}
async function quadro(b64, i) {
  if (falha) throw falha
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const imagem = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }))
  const q = new VideoFrame(imagem, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) })
  enc.encode(q, { keyFrame: i % (fps * 2) === 0 })
  q.close()
  imagem.close()
  while (enc.encodeQueueSize > 4) await new Promise((ok) => setTimeout(ok, 5))
}
async function fim() {
  await enc.flush()
  if (falha) throw falha
  muxer.finalize()
  const buf = new Uint8Array(muxer.target.buffer)
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(bin)
}`


/** Grava `segundos` de animação do HTML em MP4 (H.264, 1080x1920). As animações precisam ser CSS (@keyframes). */
export function gravarAnimacao(html: string, segundos: number): Promise<Buffer> {
  return umNavegadorPorVez(() => gravarAnimacaoAgora(html, segundos))
}

async function gravarAnimacaoAgora(html: string, segundos: number): Promise<Buffer> {
  const muxer = MUXER_JS
  const navegador = await abrirNavegador()
  try {
    // WebCodecs só existe em página segura: serve tudo de uma origem https falsa
    const contexto = await navegador.newContext({ viewport: { width: LARGURA, height: ALTURA }, deviceScaleFactor: 1 })
    await contexto.route(`${ORIGEM}/**`, (r) => {
      const caminho = new URL(r.request().url()).pathname
      if (caminho === '/muxer.js') return r.fulfill({ contentType: 'text/javascript', body: muxer })
      if (caminho === '/codificar') return r.fulfill({ contentType: 'text/html', body: `<!doctype html><script src="/muxer.js"></script><script>${CODIFICADOR}</script>` })
      return r.fulfill({ contentType: 'text/html; charset=utf-8', body: desenharSetas(html) })
    })

    const cena = await contexto.newPage()
    await cena.goto(`${ORIGEM}/`, { waitUntil: 'networkidle', timeout: 45_000 }).catch(() => cena.waitForLoadState('load'))
    await cena.evaluate(() =>
      Promise.race([
        Promise.all(Array.from(document.images).map((img) => (img.complete ? null : new Promise((ok) => { img.onload = img.onerror = ok })))),
        new Promise((ok) => setTimeout(ok, 15_000)),
      ]),
    )
    await cena.evaluate(() => document.fonts.ready)
    const animacoes = await cena.evaluate(() => {
      const todas = document.getAnimations()
      todas.forEach((a) => a.pause())
      return todas.length
    })
    if (animacoes === 0) throw new Error('A animação não tem nenhum @keyframes para gravar')

    const codificador = await contexto.newPage()
    await codificador.goto(`${ORIGEM}/codificar`)
    await codificador.evaluate(`iniciar(${LARGURA}, ${ALTURA}, ${FPS})`)

    const total = Math.round(segundos * FPS)
    for (let i = 0; i < total; i++) {
      await cena.evaluate((ms) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms }), (i * 1000) / FPS)
      const jpeg = await cena.screenshot({ type: 'jpeg', quality: 88 })
      await codificador.evaluate(([b64, n]) => (window as unknown as { quadro: (b: string, n: number) => Promise<void> }).quadro(b64 as string, n as number), [jpeg.toString('base64'), i] as const)
    }
    const mp4 = await codificador.evaluate<string>('fim()')
    return Buffer.from(mp4, 'base64')
  } finally {
    await navegador.close().catch(() => {})
    await limparTmp()
  }
}
