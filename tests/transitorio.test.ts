import { describe, expect, it } from 'vitest'
import { eErroTransitorio, MAX_TENTATIVAS } from '../api/_lib/transitorio'

describe('erro transitório da fila', () => {
  it('reconhece instabilidade passageira', () => {
    for (const msg of [
      'Overloaded: 529 overloaded_error',
      'Request timed out after 60000ms',
      'fetch failed',
      'page.setContent: Target page, context or browser has been closed',
      'OpenRouter (x): rate limit exceeded',
      'Instagram demorou demais para processar a mídia',
      'read ECONNRESET',
    ])
      expect(eErroTransitorio(msg), msg).toBe(true)
  })
  it('não insiste em erro de verdade', () => {
    for (const msg of [
      'Kling: sem créditos na conta (saldo insuficiente).',
      'Kling recusou a chave. Confira KLING_API_KEY na Vercel. (HTTP 401)',
      'Falta configurar OPENROUTER_API_KEY na Vercel para usar GPT, Gemini ou DeepSeek',
      'O modelo recusou a tarefa',
      'O HTML não tem nenhum <section class="slide">',
      'A marca Drinfy ainda não tem conta do Instagram conectada (id da conta e token).',
      'Token do Instagram expirado ou inválido. Renove no painel da Meta. (HTTP 400)',
    ])
      expect(eErroTransitorio(msg), msg).toBe(false)
  })
  it('tenta no máximo três vezes', () => {
    expect(MAX_TENTATIVAS).toBe(3)
  })
})
