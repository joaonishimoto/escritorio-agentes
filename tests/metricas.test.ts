import { describe, expect, it } from 'vitest'
import { lerInsights, pontuacao, textoDoQueFuncionou } from '../api/_lib/metricas'

describe('métricas do Instagram', () => {
  it('lê os dois formatos de resposta de /insights', () => {
    const m = lerInsights({
      data: [
        { name: 'reach', values: [{ value: 1200 }] },
        { name: 'saved', total_value: { value: 34 } },
        { name: 'outra', values: [{ value: 9 }] },
      ],
    })
    expect(m.alcance).toBe(1200)
    expect(m.salvos).toBe(34)
    expect(m.curtidas).toBeNull()
  })

  it('pontua pelo engajamento sobre o alcance, com salvos e compartilhamentos valendo mais', () => {
    expect(pontuacao({ alcance: 0 })).toBeNull()
    expect(pontuacao({ alcance: 100, salvos: 10 })).toBeCloseTo(0.3)
    expect(pontuacao({ alcance: 100, curtidas: 10 })).toBeCloseTo(0.1)
  })

  it('só monta o texto para o chefe com pelo menos 3 posts, e mostra os piores a partir de 6', () => {
    const p = (briefing: string, salvos: number) => ({ briefing, alcance: 100, salvos })
    expect(textoDoQueFuncionou([p('a', 1), p('b', 2)])).toBe('')
    const tres = textoDoQueFuncionou([p('a', 1), p('b', 9), p('c', 5)])
    expect(tres.indexOf('- b')).toBeLessThan(tres.indexOf('- c'))
    expect(tres).not.toContain('Menos engajamento')
    const seis = textoDoQueFuncionou([p('a', 1), p('b', 9), p('c', 5), p('d', 3), p('e', 0), p('f', 7)])
    expect(seis).toContain('Menos engajamento:\n- a')
  })
})
