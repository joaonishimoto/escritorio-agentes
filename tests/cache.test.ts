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
})
