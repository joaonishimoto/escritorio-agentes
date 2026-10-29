import { describe, expect, it, vi } from 'vitest'

vi.mock('../api/_lib/db', () => ({ db: {} }))

const { fecharPauta } = await import('../api/_lib/variacao')

const pauta = (formato: string, quantidade_slides: number, plano_slides: string[]) => ({ formato, quantidade_slides, plano_slides })

describe('fecharPauta', () => {
  it('foto tem uma imagem só, mesmo se o modelo planejou duas', () => {
    const p = fecharPauta(pauta('foto', 2, ['marca em destaque', 'chamada']))
    expect(p.quantidade_slides).toBe(1)
    expect(p.plano_slides).toEqual(['marca em destaque / chamada'])
  })
  it('Reel tem só a capa', () => {
    expect(fecharPauta(pauta('reel', 3, ['capa'])).quantidade_slides).toBe(1)
  })
  it('carrossel segue o plano, entre 2 e 10', () => {
    expect(fecharPauta(pauta('carrossel', 7, ['a', 'b', 'c', 'd'])).quantidade_slides).toBe(4)
    expect(fecharPauta(pauta('carrossel', 1, ['a'])).quantidade_slides).toBe(2)
  })
  it('a quantidade escolhida pelo dono vale e o plano acompanha', () => {
    const p = fecharPauta(pauta('carrossel', 5, ['a', 'b', 'c', 'd', 'e']), 3)
    expect(p.quantidade_slides).toBe(3)
    expect(p.plano_slides).toEqual(['a', 'b', 'c / d / e'])
  })
})
