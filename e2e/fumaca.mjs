// Teste de fumaça da interface: sobe o app com o Vite, finge o login e o banco, e confere que o
// escritório 3D abre, que dá para ir até a sala de uma marca e pedir um post. Roda no CI depois do build.
// Uso: node e2e/fumaca.mjs   (CHROMIUM_PATH aponta outro Chromium, se precisar)
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

process.env.VITE_SUPABASE_URL = 'https://teste.supabase.co'
process.env.VITE_SUPABASE_ANON_KEY = 'chave-falsa'

const PORTA = 4799
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const expira = Math.floor(Date.now() / 1000) + 86400
const usuario = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'teste@exemplo.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: usuario.id, role: 'authenticated', aud: 'authenticated', exp: expira })}.sig`
const sessao = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: expira, user: usuario }
const MARCAS = [
  { id: 'm1', nome: 'Marca Um', identidade: { cor_sala: '#1e3d66' }, instagram_conta_id: null },
  { id: 'm2', nome: 'Marca Dois', identidade: { cor_sala: '#37aea4' }, instagram_conta_id: '1' },
]

const falhas = []
const conferir = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`)
  if (!ok) falhas.push(msg)
}

const servidor = await createServer({ server: { port: PORTA, strictPort: true }, logLevel: 'error' })
await servidor.listen()
const navegador = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
try {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 860 } })
  await ctx.addInitScript((s) => localStorage.setItem('sb-teste-auth-token', JSON.stringify(s)), sessao)
  await ctx.route(/teste\.supabase\.co/, (rota) => {
    const u = rota.request().url()
    if (u.includes('/auth/v1/user')) return rota.fulfill({ json: usuario })
    if (u.includes('/rest/v1/marcas')) return rota.fulfill({ json: u.includes('select=identidade') && !u.includes('in.') ? MARCAS[0] : MARCAS })
    return rota.fulfill({ json: [] })
  })
  let pedido = null
  await ctx.route(/\/api\//, (rota) => {
    const u = rota.request().url()
    if (u.includes('/api/posts') && rota.request().method() === 'POST') {
      pedido = rota.request().postDataJSON()
      return rota.fulfill({ status: 201, json: { post: { id: 'p1', marca_id: pedido.marca_id, briefing: pedido.briefing, status: 'em_producao', slides: [], legenda: null, custo_usd: 0, agendado_para: null, publicado_em: null, criado_em: new Date().toISOString() } } })
    }
    return rota.fulfill({ json: {} })
  })
  const p = await ctx.newPage()
  const erros = []
  p.on('pageerror', (e) => erros.push(e.message))
  await p.goto(`http://localhost:${PORTA}/`)
  await p.locator('canvas.tres-tela').first().waitFor({ timeout: 20_000 })
  conferir(true, 'o escritório 3D abre com o login')
  await p.waitForTimeout(1500)
  const placas = await p.locator('.tres-placa').allInnerTexts()
  conferir(MARCAS.every((m) => placas.some((t) => t.includes(m.nome))), `as salas das marcas aparecem (${placas.join(', ')})`)
  conferir(['Pauta', 'Design', 'Estúdio', 'Revisão', 'Publicação'].every((n) => placas.some((t) => t.includes(n))), 'as cinco salas da equipe aparecem')
  await p.getByRole('button', { name: 'Marca Dois' }).first().click()
  await p.waitForTimeout(800)
  await p.getByRole('button', { name: 'Novo post' }).first().click()
  await p.locator('#np-pedido').waitFor({ timeout: 5000 })
  conferir(true, 'o Novo post abre')
  await p.locator('#np-pedido').fill('Carrossel de teste sobre gelo')
  await p.getByRole('button', { name: 'Pôr a equipe para trabalhar' }).click()
  await p.waitForTimeout(800)
  conferir(pedido?.briefing === 'Carrossel de teste sobre gelo', 'pedir um post chama a API com o pedido')
  conferir(pedido?.marca_id === 'm2', 'o post vai para a marca escolhida')

  // publicar algo pronto pelo publicador: sobe a imagem, confere e só manda depois de confirmar
  pedido = null
  await p.keyboard.press('Escape')
  await p.evaluate(async () => (await import('/src/store/escritorio.ts')).useEscritorio.getState().selecionar('publicador'))
  await p.getByRole('tab', { name: 'Publicar algo' }).click()
  const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCSiiivBPbP/9k=', 'base64')
  await p.locator('.pd-soltar input[type=file]').setInputFiles({ name: 'foto.jpg', mimeType: 'image/jpeg', buffer: jpeg })
  await p.locator('.pd-lista li').first().waitFor({ timeout: 15_000 })
  await p.locator('.publicar-direto textarea').fill('Legenda de teste')
  await p.getByRole('button', { name: 'Revisar antes de publicar' }).click()
  conferir(pedido === null, 'revisar não publica nada antes de confirmar')
  await p.getByRole('button', { name: 'Confirmar e publicar' }).click()
  await p.locator('.pd-pronto').waitFor({ timeout: 5000 })
  conferir(pedido?.direto?.legenda === 'Legenda de teste' && pedido?.direto?.midias?.[0]?.tipo === 'imagem' && pedido?.marca_id === 'm2', 'publicar algo pronto manda a imagem e a legenda para a marca da sala')
  conferir(erros.length === 0, `sem erro de JavaScript na página${erros.length ? `: ${erros.join(' | ')}` : ''}`)
} catch (e) {
  conferir(false, `o teste quebrou: ${e instanceof Error ? e.message : e}`)
} finally {
  await navegador.close()
  await servidor.close()
}
if (falhas.length) {
  console.error(`\n${falhas.length} conferência(s) falharam`)
  process.exit(1)
}
console.log('\nTudo certo')
