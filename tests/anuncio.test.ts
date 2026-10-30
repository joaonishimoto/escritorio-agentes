import { describe, expect, it } from 'vitest'
import { arrumarPacote, avisosDoPacote, eAnuncio, limparPedidoAnuncio, type Pacote } from '../api/_lib/anuncio'
import { fluxoDeProducao, quemDesenha, rotaDaDevolucao } from '../api/_lib/contexto'
import { alturaDoSlide } from '../api/_lib/render'

describe('pedido do anúncio', () => {
  it('aceita objetivo e etapa conhecidos e um link http(s)', () => {
    expect(limparPedidoAnuncio({ objetivo: 'vendas', etapa: 'quente', destino: ' https://drinfy.app/oferta ' })).toEqual({ objetivo: 'vendas', etapa: 'quente', destino: 'https://drinfy.app/oferta' })
  })
  it('sem etapa vale público frio; link estranho fica de fora', () => {
    expect(limparPedidoAnuncio({ objetivo: 'trafego', destino: 'javascript:alert(1)' })).toEqual({ objetivo: 'trafego', etapa: 'frio' })
  })
  it('sem objetivo conhecido não é anúncio', () => {
    expect(limparPedidoAnuncio({ objetivo: 'viralizar' })).toBeNull()
    expect(limparPedidoAnuncio(null)).toBeNull()
  })
})

describe('pacote do anúncio', () => {
  const pacote: Pacote = {
    nome: ' Vendas-Frio ',
    texto_principal: ['Gancho curto\nCorpo', 'Gancho curto\nCorpo', ' ', `${'a'.repeat(130)}\nresto`],
    titulo: ['Receitas em 1 minuto', 'Um título que passa muito do limite de quarenta'],
    descricao: '7 dias grátis · Cancele quando quiser',
    botao: 'Saiba mais',
  }
  it('tira versões vazias e repetidas', () => {
    const p = arrumarPacote(pacote)
    expect(p.nome).toBe('vendas-frio')
    expect(p.texto_principal).toHaveLength(2)
  })
  it('avisa o que passa do que o Meta mostra', () => {
    const avisos = avisosDoPacote(arrumarPacote(pacote))
    expect(avisos.some((a) => a.includes('primeira linha do texto principal 2'))).toBe(true)
    expect(avisos.some((a) => a.includes('título'))).toBe(true)
    expect(avisos.some((a) => a.includes('descrição'))).toBe(true)
  })
})

describe('quem desenha o anúncio', () => {
  it('o designer de criativos fica no lugar do designer', () => {
    expect(fluxoDeProducao([], 'foto', true)).toEqual(['chefe', 'pesquisador', 'redator', 'criativos', 'revisor'])
    expect(quemDesenha({ anuncio: { objetivo: 'vendas' } })).toBe('criativos')
    expect(quemDesenha({ anuncio: null })).toBe('designer')
    expect(eAnuncio({ anuncio: null })).toBe(false)
  })
  it('o que o revisor aponta ao designer volta para o designer de criativos', () => {
    const fluxo = fluxoDeProducao([], 'foto', true)
    expect(rotaDaDevolucao(['designer'], fluxo)).toEqual(['criativos', 'revisor'])
    expect(rotaDaDevolucao(['redator'], fluxo)).toEqual(['redator', 'criativos', 'revisor'])
    expect(rotaDaDevolucao([], fluxo)).toEqual(['criativos', 'revisor'])
  })
})

describe('altura do slide', () => {
  it('a arte de story é 9:16 e o resto fica com a altura pedida', () => {
    expect(alturaDoSlide('<section class="slide story">x</section>', 1080, 1350)).toBe(1920)
    expect(alturaDoSlide('<section class="slide feed">x</section>', 1080, 1350)).toBe(1350)
    expect(alturaDoSlide('<section class="slide storyboard">x</section>', 1080, 1350)).toBe(1350)
  })
})
