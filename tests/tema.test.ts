import { describe, expect, it } from 'vitest'
import { ehTema, temaValendo } from '../src/lib/tema'

describe('tema', () => {
  it('automático segue o aparelho; claro e escuro valem como escolhidos', () => {
    expect(temaValendo('automatico', true)).toBe('escuro')
    expect(temaValendo('automatico', false)).toBe('claro')
    expect(temaValendo('escuro', false)).toBe('escuro')
    expect(temaValendo('claro', true)).toBe('claro')
  })
  it('aceita só escolhas conhecidas vindas do armazenamento', () => {
    expect(ehTema('escuro')).toBe(true)
    expect(ehTema('dark')).toBe(false)
    expect(ehTema(null)).toBe(false)
  })
})
