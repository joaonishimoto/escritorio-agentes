import { describe, expect, it } from 'vitest'
import { origemConfiavel } from '../api/_lib/http'
import { validarIdentidade } from '../api/_lib/identidade'

describe('endereço do app', () => {
  const forjado = { host: 'atacante.com', 'x-forwarded-host': 'atacante.com' }
  it('nunca usa o cabeçalho Host na Vercel', () => {
    expect(origemConfiavel({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'agents.exemplo.com', VERCEL_URL: 'x-123.vercel.app' }, forjado)).toBe('https://agents.exemplo.com')
    expect(origemConfiavel({ VERCEL_ENV: 'preview', VERCEL_URL: 'x-123.vercel.app' }, forjado)).toBe('https://x-123.vercel.app')
  })
  it('APP_URL ganha de tudo', () => {
    expect(origemConfiavel({ APP_URL: 'https://meu.app/', VERCEL_URL: 'x.vercel.app' }, forjado)).toBe('https://meu.app')
  })
  it('rodando local usa o cabeçalho', () => {
    expect(origemConfiavel({}, { host: 'localhost:3000' })).toBe('http://localhost:3000')
  })
})

describe('identidade da marca', () => {
  it('aceita o que o app grava e anotações livres', () => {
    const r = validarIdentidade({ cor_sala: '#1e3d66', cores: { primaria: '#ff0000' }, teto: { por_post_usd: null, por_mes_usd: 30 }, estilo: 'minimalista', sala: { piso: 'x' }, ideias_guardadas: [] })
    expect(r.ok).toBe(true)
    // como está hoje no banco: lista dentro de cores, formatos como objeto
    expect(validarIdentidade({ cores: { vermelho: '#EE382B', funcionais: ['verde', 'azul'] }, formatos: { reel: '1080x1920' }, fonte: 'Plus Jakarta Sans (Google Fonts, pesos 400 a 800). Títulos 700 ou 800, letter-spacing -0.025em, line-height 1.15. Texto 400.' }).ok).toBe(true)
  })
  it('recusa tipo errado nos campos que o código lê', () => {
    expect(validarIdentidade({ cor_sala: 'azul' })).toEqual({ ok: false, erro: 'Campo "cor_sala" inválido: cor da sala precisa ser #RRGGBB' })
    expect(validarIdentidade({ teto: { por_mes_usd: -5 } }).ok).toBe(false)
    expect(validarIdentidade({ estilo: 'x'.repeat(5000) }).ok).toBe(false)
  })
})
