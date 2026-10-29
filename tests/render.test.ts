import { describe, expect, it } from 'vitest'
import { desenharSetas, separarSlides } from '../api/_lib/render'

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

describe('um slide por página', () => {
  const html = '<html><head><style>.slide{width:1080px}</style></head><body><section class="slide cover" id="s1"><h1>A</h1></section>\n<section id="s2" class="slide drink"><p>B</p></section><footer>x</footer></body></html>'
  it('separa cada <section class="slide"> num documento só com ele, mantendo o resto', () => {
    const partes = separarSlides(html)
    expect(partes).toHaveLength(2)
    expect(partes[0]).toContain('<h1>A</h1>')
    expect(partes[0]).not.toContain('<p>B</p>')
    expect(partes[1]).toContain('<p>B</p>')
    expect(partes[1]).not.toContain('<h1>A</h1>')
    for (const p of partes) {
      expect(p).toContain('.slide{width:1080px}')
      expect(p).toContain('<footer>x</footer>')
    }
  })
  it('não confunde outras seções com slides', () => {
    expect(separarSlides('<body><section class="slideshow">a</section><section class="x slide">b</section></body>')).toHaveLength(1)
    expect(separarSlides('<body><p>nada</p></body>')).toHaveLength(0)
  })
})
