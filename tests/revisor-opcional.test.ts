import { describe, expect, it } from 'vitest'
import { pulaRevisor } from '../api/_lib/contexto'

describe('revisor opcional', () => {
  it('só pula quando o Novo post desligou a revisão', () => {
    expect(pulaRevisor({ preferencias: { revisar: false } })).toBe(true)
    expect(pulaRevisor({ preferencias: { revisar: true } })).toBe(false)
    expect(pulaRevisor({ preferencias: {} })).toBe(false)
    expect(pulaRevisor({ preferencias: null })).toBe(false)
    expect(pulaRevisor({})).toBe(false)
  })
})
