import { describe, expect, it } from 'vitest'
import { montarProposta, pedidoDeJuntar } from '../api/_lib/regras'

const antigas = [
  { id: 'a', regra: 'Selo alinhado à direita', motivo: null },
  { id: 'b', regra: 'O selo fica no canto direito', motivo: 'correção do post 3' },
  { id: 'c', regra: 'Use no máximo 2 emojis', motivo: null },
  { id: 'd', regra: 'Nunca escreva "drink" no plural', motivo: null },
]

describe('juntar regras parecidas', () => {
  it('numera as regras da mais antiga para a mais recente', () => {
    expect(pedidoDeJuntar('designer', antigas)).toContain('2. O selo fica no canto direito (motivo: correção do post 3)')
  })

  it('troca as parecidas por uma e deixa as outras como estão', () => {
    const p = montarProposta(antigas, {
      regras: [
        { regra: 'Selo sempre no canto direito', motivo: 'duas correções', juntou: [1, 2] },
        { regra: 'Use no máximo 2 emojis', motivo: '', juntou: [3] },
        { regra: 'Nunca escreva "drink" no plural', motivo: '', juntou: [4] },
      ],
    })
    expect(p.novas).toEqual([{ regra: 'Selo sempre no canto direito', motivo: 'duas correções', substitui: ['a', 'b'] }])
    expect(p.ficam).toEqual(['c', 'd'])
  })

  it('ignora números que não existem e não usa uma regra antiga duas vezes', () => {
    const p = montarProposta(antigas, {
      regras: [
        { regra: 'Selo à direita', motivo: '', juntou: [1, 2, 9] },
        { regra: 'Selo à direita e 2 emojis', motivo: '', juntou: [2, 3] },
        { regra: 'Nada', motivo: '', juntou: [0, 7] },
      ],
    })
    expect(p.novas.map((n) => n.substitui)).toEqual([['a', 'b'], ['c']])
    expect(p.ficam).toEqual(['d'])
  })

  it('não muda nada quando o modelo esquece regras', () => {
    const p = montarProposta(antigas, { regras: [] })
    expect(p.novas).toEqual([])
    expect(p.ficam).toEqual(['a', 'b', 'c', 'd'])
  })
})
