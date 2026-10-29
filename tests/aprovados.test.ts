import { describe, expect, it } from 'vitest'
import { escolherExemplo, extrairEstilo, primeiroSlide, textoDoExemplo } from '../api/_lib/aprovados'

const html = `<html><head><style>
  /* fonte da marca */
  .slide { width: 1080px ; height: 1350px }
  h1 { font: 700 96px Inter }
</style></head><body><section class="slide capa"><h1>Gin</h1></section><section class="slide"><p>2</p></section></body></html>`

describe('layout aprovado', () => {
  it('extrai o CSS enxuto, sem comentários', () => {
    expect(extrairEstilo(html)).toBe('.slide{width:1080px;height:1350px}h1{font:700 96px Inter}')
  })

  it('pega só a capa', () => {
    expect(primeiroSlide(html)).toBe('<section class="slide capa"><h1>Gin</h1></section>')
  })

  it('prefere o post com o mesmo layout, senão o mais recente', () => {
    const lista = [
      { layout: 'lista', html: 'a' },
      { layout: 'editorial', html: 'b' },
    ]
    expect(escolherExemplo(lista, 'editorial')).toEqual({ layout: 'editorial', html: 'b', mesmoLayout: true })
    expect(escolherExemplo(lista, 'outro')).toEqual({ layout: 'lista', html: 'a', mesmoLayout: false })
    expect(escolherExemplo([], 'x')).toBeNull()
  })

  it('só manda a capa quando o layout é o mesmo', () => {
    expect(textoDoExemplo({ html, mesmoLayout: true })).toContain('Capa desse post')
    expect(textoDoExemplo({ html, mesmoLayout: false })).not.toContain('Capa desse post')
    expect(textoDoExemplo({ html: '<p>sem css</p>', mesmoLayout: false })).toBe('')
  })
})
