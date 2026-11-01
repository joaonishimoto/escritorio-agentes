// Tira fotos da vista 3D com o banco fingido (mesmo truque do fumaca.mjs). Uso: node e2e/foto3d.mjs pasta-de-saida
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

process.env.VITE_SUPABASE_URL = 'https://teste.supabase.co'
process.env.VITE_SUPABASE_ANON_KEY = 'chave-falsa'
const saida = process.argv[2] ?? '.'
const PORTA = 4798
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const expira = Math.floor(Date.now() / 1000) + 86400
const usuario = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'teste@exemplo.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: usuario.id, role: 'authenticated', aud: 'authenticated', exp: expira })}.sig`
const sessao = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: expira, user: usuario }
const MARCAS = [
  { id: 'm1', nome: 'Drinfy', identidade: { cor_sala: '#1e3d66' }, instagram_conta_id: '1' },
  { id: 'm2', nome: 'Limão', identidade: { cor_sala: '#37aea4' }, instagram_conta_id: null },
]
const servidor = await createServer({ server: { port: PORTA, strictPort: true }, logLevel: 'error' })
await servidor.listen()
const navegador = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) })
try {
  for (const [nome, viewport] of [['desktop', { width: 1440, height: 900 }], ['celular', { width: 390, height: 780 }]]) {
    const ctx = await navegador.newContext({ viewport, deviceScaleFactor: 1 })
    await ctx.addInitScript((s) => localStorage.setItem('sb-teste-auth-token', JSON.stringify(s)), sessao)
    await ctx.route(/teste\.supabase\.co/, (rota) => {
      const u = rota.request().url()
      if (u.includes('/auth/v1/user')) return rota.fulfill({ json: usuario })
      if (u.includes('/rest/v1/marcas')) return rota.fulfill({ json: u.includes('select=identidade') && !u.includes('in.') ? MARCAS[0] : MARCAS })
      return rota.fulfill({ json: [] })
    })
    await ctx.route(/\/api\//, (rota) => rota.fulfill({ json: {} }))
    const p = await ctx.newPage()
    const erros = []
    p.on('pageerror', (e) => erros.push(e.message))
    p.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
    await p.goto(`http://localhost:${PORTA}/`)
    await p.locator('canvas.tres-tela').first().waitFor({ timeout: 30_000 })
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${saida}/3d-${nome}.png` })
    if (nome === 'desktop') {
      await p.getByRole('button', { name: 'Drinfy' }).first().click()
      await p.waitForTimeout(1800)
      await p.screenshot({ path: `${saida}/3d-marca.png` })
      await p.getByRole('button', { name: 'Sua sala' }).first().click()
      await p.waitForTimeout(1800)
      await p.screenshot({ path: `${saida}/3d-sua-sala.png` })
    }
    console.log(nome, erros.length ? `ERROS: ${erros.join(' | ')}` : 'sem erros')
    await ctx.close()
  }
} finally {
  await navegador.close()
  await servidor.close()
}
