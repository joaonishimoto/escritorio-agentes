import { describe, expect, it } from 'vitest'
import { chaveDia, diasDoMes } from '../src/lib/datas'
import { dolar, duracao } from '../src/lib/formato'

describe('calendário e formatos', () => {
  it('monta o mês em semanas completas de domingo a sábado', () => {
    const dias = diasDoMes(2026, 9) // outubro de 2026 começa numa quinta
    expect(dias.length % 7).toBe(0)
    expect(dias.slice(0, 4)).toEqual([null, null, null, null])
    expect(dias[4]?.getDate()).toBe(1)
    expect(dias.filter(Boolean).length).toBe(31)
  })
  it('chave do dia ignora a hora', () => {
    expect(chaveDia(new Date(2026, 9, 28, 23, 59))).toBe(chaveDia(new Date(2026, 9, 28, 0, 1)))
  })
  it('tempo e dinheiro em português', () => {
    expect(duracao(75)).toBe('1 min 15 s')
    expect(duracao(4000)).toBe('1 h 06 min')
    expect(dolar(1.5)).toBe('US$ 1,50')
  })
})
