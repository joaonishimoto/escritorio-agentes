import { describe, expect, it } from 'vitest'
import { sistemaComCache, somarUso } from '../api/_lib/claude'

describe('prompt caching', () => {
  it('marca o prompt de sistema para cache', () => {
    const blocos = sistemaComCache('Você é o revisor')
    expect(blocos).toEqual([{ type: 'text', text: 'Você é o revisor', cache_control: { type: 'ephemeral' } }])
  })

  it('cobra 1,25× o que grava no cache e 0,1× o que lê', () => {
    const base = { output_tokens: 0, input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } as never
    const semCache = somarUso('claude-sonnet-5-5', { ...base, input_tokens: 1_000_000 })
    const gravando = somarUso('claude-sonnet-5-5', { ...base, cache_creation_input_tokens: 1_000_000 })
    const lendo = somarUso('claude-sonnet-5-5', { ...base, cache_read_input_tokens: 1_000_000 })
    expect(semCache.custo_usd).toBeCloseTo(2)
    expect(gravando.custo_usd).toBeCloseTo(2.5)
    expect(lendo.custo_usd).toBeCloseTo(0.2)
    expect(lendo.tokens_entrada).toBe(1_000_000)
  })

  it('usa o preço de leitura do cache de cada modelo: no Opus 5.5 é US$ 0,20 (5% da entrada)', () => {
    const base = { output_tokens: 0, input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } as never
    expect(somarUso('claude-opus-5-5', { ...base, cache_read_input_tokens: 1_000_000 }).custo_usd).toBeCloseTo(0.2)
    expect(somarUso('claude-opus-5-5', { ...base, input_tokens: 1_000_000, output_tokens: 1_000_000 }).custo_usd).toBeCloseTo(24)
  })

  it('cobra o preço de prompt longo no Haiku 5.5 acima de 100 mil tokens', () => {
    const base = { output_tokens: 0, input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } as never
    expect(somarUso('claude-haiku-5-5', { ...base, input_tokens: 100_000, output_tokens: 1000 }).custo_usd).toBeCloseTo(0.01 + 0.0005)
    expect(somarUso('claude-haiku-5-5', { ...base, input_tokens: 200_000, output_tokens: 1000 }).custo_usd).toBeCloseTo(0.1 + 0.0025)
  })
})
