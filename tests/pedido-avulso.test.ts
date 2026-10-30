import { describe, expect, it } from 'vitest'
import { conteudoDoPedido, eAgenteAvulso } from '../api/_lib/pedido-avulso'

describe('pedido avulso', () => {
  it('todo funcionário com IA recebe pedido; o publicador não', () => {
    for (const a of ['chefe', 'pesquisador', 'redator', 'designer', 'cinegrafista', 'narrador', 'revisor', 'curador']) expect(eAgenteAvulso(a)).toBe(true)
    expect(eAgenteAvulso('publicador')).toBe(false)
    expect(eAgenteAvulso('toString')).toBe(false)
  })
  it('primeiro pedido vai sozinho', () => {
    expect(conteudoDoPedido('uma copy de anúncio')).toBe('uma copy de anúncio')
  })
  it('ajuste leva a conversa anterior', () => {
    const c = conteudoDoPedido('mais curto', [{ pedido: 'uma copy de anúncio', resposta: 'Texto longo' }])
    expect(c).toContain('uma copy de anúncio')
    expect(c).toContain('Texto longo')
    expect(c).toContain('mais curto')
  })
})
