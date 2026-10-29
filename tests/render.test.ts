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

describe('reconferência só com os slides que mudaram', async () => {
  const { marcasDosSlides } = await import('../api/_lib/agentes/producao')
  it('a marca de um slide só muda quando o HTML dele muda', () => {
    const antes = marcasDosSlides('<body><section class="slide">A</section><section class="slide">B</section></body>')
    const depois = marcasDosSlides('<body><section class="slide">A</section><section class="slide">B2</section></body>')
    expect(antes).toHaveLength(2)
    expect(depois[0]).toBe(antes[0])
    expect(depois[1]).not.toBe(antes[1])
    expect(marcasDosSlides(undefined)).toEqual([])
  })
})

describe('render remoto sem resposta', async () => {
  const { semResposta } = await import('../api/_lib/render-remoto')
  it('cai para o render local só quando a função não respondeu', () => {
    const timeout = new Error('x')
    timeout.name = 'TimeoutError'
    expect(semResposta(timeout)).toBe(true)
    expect(semResposta(new TypeError('fetch failed'))).toBe(true)
    expect(semResposta(new Error('Slide 1: O slide não apareceu na página'))).toBe(false)
  })
})
