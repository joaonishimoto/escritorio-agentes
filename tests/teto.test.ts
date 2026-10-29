import { describe, expect, it } from 'vitest'
import { passouDoTeto, tetoDaMarca, TETO_POST_PADRAO } from '../api/_lib/teto'

describe('teto de gasto', () => {
  it('lê o teto da identidade, com padrão por post e sem teto por mês', () => {
    expect(tetoDaMarca({})).toEqual({ post: TETO_POST_PADRAO, mes: null })
    expect(tetoDaMarca({ teto: { por_post_usd: 1.5, por_mes_usd: 30 } })).toEqual({ post: 1.5, mes: 30 })
    expect(tetoDaMarca({ teto: { por_post_usd: null } })).toEqual({ post: null, mes: null })
    expect(tetoDaMarca({ teto: { por_post_usd: -1, por_mes_usd: 'x' } })).toEqual({ post: TETO_POST_PADRAO, mes: null })
  })
  it('para a produção só quando passou e ainda há passo de produção pela frente', () => {
    const teto = { post: 2, mes: null }
    expect(passouDoTeto({ agente: 'designer', proximo: 'revisor', custoDoPost: 2.1, teto })).toBe(true)
    expect(passouDoTeto({ agente: 'designer', proximo: 'revisor', custoDoPost: 1.9, teto })).toBe(false)
    expect(passouDoTeto({ agente: 'revisor', proximo: undefined, custoDoPost: 5, teto })).toBe(false)
    expect(passouDoTeto({ agente: 'cinegrafista', proximo: 'cinegrafista', custoDoPost: 5, teto })).toBe(false)
    expect(passouDoTeto({ agente: 'curador', proximo: 'designer', custoDoPost: 5, teto })).toBe(false)
    expect(passouDoTeto({ agente: 'designer', proximo: 'revisor', custoDoPost: 50, teto: { post: null, mes: null } })).toBe(false)
  })
})
