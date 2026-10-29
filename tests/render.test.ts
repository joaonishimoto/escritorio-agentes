import { describe, expect, it } from 'vitest'
import { desenharSetas } from '../api/_lib/render'

describe('setas nos slides', () => {
  it('troca a seta do texto por desenho e não mexe em atributos nem no <head>', () => {
    const html = '<html><head><style>.x::after{content:"→"}</style></head><body><p title="a→b">Veja →</p></body></html>'
    const saida = desenharSetas(html)
    expect(saida).toContain('content:"→"')
    expect(saida).toContain('title="a→b"')
    expect(saida).toContain('Veja <svg')
    expect(saida).not.toMatch(/Veja →/)
  })
})
