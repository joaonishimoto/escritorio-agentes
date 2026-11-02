// Mede o peso do app aberto: tempo até o primeiro quadro do 3D, tarefas longas (travadas), chamadas de desenho por quadro e quadros por segundo.
// Uso: npm run build && npm run medir   (MARCAS=8 mede com mais salas; PERFIL=1 mostra onde o processador gastou o tempo)
import { chromium } from 'playwright-core'
import { preview } from 'vite'

const PORTA = 4798
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const expira = Math.floor(Date.now() / 1000) + 86400
const usuario = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'teste@exemplo.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: usuario.id, role: 'authenticated', aud: 'authenticated', exp: expira })}.sig`
const sessao = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: expira, user: usuario }
const NMARCAS = Number(process.env.MARCAS ?? 4)
const MARCAS = Array.from({ length: NMARCAS }, (_, i) => ({ id: `m${i}`, nome: `Marca ${i}`, identidade: { cor_sala: ['#1e3d66', '#37aea4', '#b74e45', '#f2b233'][i % 4] }, instagram_conta_id: i % 2 ? '1' : null }))

const servidor = await preview({ preview: { port: PORTA, strictPort: true }, logLevel: 'error' })
const navegador = await chromium.launch({ args: ['--enable-unsafe-swiftshader'], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) })
try {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 860 } })
  await ctx.addInitScript((s) => {
    localStorage.setItem('sb-teste-auth-token', JSON.stringify(s))
    const m = (window.__medida = { desenhos: 0, buffers: 0, texturas: 0, longas: [], quadros: [] })
    for (const P of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const f of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        const o = P[f]
        if (o) P[f] = function (...a) { m.desenhos++; return o.apply(this, a) }
      }
      const cb = P.createBuffer
      P.createBuffer = function () { m.buffers++; return cb.call(this) }
      const ct = P.createTexture
      P.createTexture = function () { m.texturas++; return ct.call(this) }
    }
    new PerformanceObserver((l) => { for (const e of l.getEntries()) m.longas.push(Math.round(e.duration)) }).observe({ type: 'longtask', buffered: true })
  }, sessao)
  await ctx.route(/supabase\.co/, (rota) => {
    const u = rota.request().url()
    if (u.includes('/auth/v1/user')) return rota.fulfill({ json: usuario })
    if (u.includes('/rest/v1/marcas')) return rota.fulfill({ json: u.includes('select=identidade') && !u.includes('in.') ? MARCAS[0] : MARCAS })
    return rota.fulfill({ json: [] })
  })
  await ctx.route(/\/api\//, (r) => r.fulfill({ json: {} }))
  const p = await ctx.newPage()
  const cdp = process.env.PERFIL ? await ctx.newCDPSession(p) : null
  if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start') }
  const t0 = Date.now()
  await p.goto(`http://localhost:${PORTA}/`)
  await p.locator('canvas.tres-tela').first().waitFor({ timeout: 60_000 })
  const tCanvas = Date.now() - t0
  await p.waitForTimeout(4000)
  if (cdp) {
    const { profile } = await cdp.send('Profiler.stop')
    const porNo = new Map(profile.nodes.map((n) => [n.id, n]))
    const dt = {}
    profile.samples.forEach((id, i) => { const n = porNo.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`; dt[k] = (dt[k] ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000 })
    console.log(Object.entries(dt).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${Math.round(v)}ms ${k}`).join('\n'))
  }
  const r = await p.evaluate(async () => {
    const m = window.__medida
    const d0 = m.desenhos
    const n0 = performance.now()
    let q = 0
    await new Promise((ok) => { const f = () => { q++; if (performance.now() - n0 < 3000) requestAnimationFrame(f); else ok() }; requestAnimationFrame(f) })
    const seg = (performance.now() - n0) / 1000
    return { desenhosPorQuadro: Math.round((m.desenhos - d0) / q), fps: Math.round(q / seg), buffers: m.buffers, texturas: m.texturas, longas: m.longas, heapMB: Math.round(performance.memory?.usedJSHeapSize / 1e6) }
  })
  const recursos = await p.evaluate(() => performance.getEntriesByType('resource').map((e) => [e.name.replace(/^https?:\/\/[^/]+/, ''), Math.round(e.transferSize / 1024)]).filter(([, k]) => k > 0))
  console.log(JSON.stringify({ marcas: NMARCAS, msAteCanvas: tCanvas, ...r, somaLongasMs: r.longas.reduce((a, b) => a + b, 0), recursosKB: recursos }, null, 1))
} finally {
  await navegador.close()
  servidor.httpServer.close()
}
