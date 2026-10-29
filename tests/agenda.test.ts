import { describe, expect, it } from 'vitest'
import { horariosLivres, mudarDia, noMesmoDia } from '../src/lib/agenda'

// quarta-feira, 28 de outubro de 2026, 10h no fuso do teste
const agora = new Date(2026, 9, 28, 10, 0)
const em = (d: number, h = 19) => new Date(2026, 9, d, h, 0).toISOString()

describe('calendário editorial', () => {
  it('sugere um horário bom por dia, pulando dias em que a marca já tem post', () => {
    const agenda = [
      { id: 'a', data: em(28), status: 'agendado', marcaId: 'm1' },
      { id: 'b', data: em(29), status: 'agendado', marcaId: 'm2' },
    ]
    const livres = horariosLivres(agenda, 'm1', agora, 3)
    expect(livres.map((d) => [d.getDate(), d.getHours()])).toEqual([
      [29, 12],
      [30, 12],
      [31, 11], // sábado: mais cedo
    ])
  })

  it('não sugere horário que já passou ou está a menos de 30 minutos', () => {
    const livres = horariosLivres([], 'm1', new Date(2026, 9, 28, 11, 45), 1)
    expect([livres[0].getDate(), livres[0].getHours()]).toEqual([28, 19])
  })

  it('acha outro post da mesma marca no mesmo dia, ignorando o próprio e os que falharam', () => {
    const agenda = [
      { id: 'a', data: em(30, 12), status: 'agendado', marcaId: 'm1' },
      { id: 'b', data: em(30, 19), status: 'falhou', marcaId: 'm1' },
      { id: 'c', data: em(30, 19), status: 'agendado', marcaId: 'm2' },
    ]
    expect(noMesmoDia(agenda, 'm1', new Date(em(30, 18)), 'x').map((i) => i.id)).toEqual(['a'])
    expect(noMesmoDia(agenda, 'm1', new Date(em(30, 18)), 'a')).toEqual([])
  })

  it('arrastar para outro dia mantém a hora', () => {
    const d = mudarDia(new Date(2026, 9, 28, 19, 30), new Date(2026, 10, 2))
    expect([d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([10, 2, 19, 30])
  })
})
