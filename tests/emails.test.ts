import { describe, expect, it } from 'vitest'
import { contarRecebidos, emailsDoPost, resumir } from '../src/lib/emails'
import type { Evento } from '../src/store/escritorio'

let n = 0
const ev = (agente: Evento['agente'], tipo: Evento['tipo'], mensagem: string, para?: Evento['para']): Evento => ({
  id: `e${++n}`,
  post_id: 'p',
  agente,
  tipo,
  mensagem,
  para,
  criado_em: new Date(2026, 10, 1, 12, 0, n).toISOString(),
})

describe('e-mails da equipe', () => {
  const eventos = [
    ev('chefe', 'inicio', 'Lendo o pedido'),
    ev('chefe', 'texto', 'Pauta: 5 slides '),
    ev('pesquisador', 'inicio', 'Buscando fatos'),
    ev('chefe', 'acao', 'Distribuindo a pauta'),
    ev('chefe', 'texto', 'sobre limão.'),
    ev('chefe', 'entrega', 'Pauta pronta', 'redator'),
    ev('redator', 'inicio', 'Escrevendo os slides'),
    ev('redator', 'entrega', 'Texto pronto', 'voce'),
    ev('voce', 'entrega', 'Ajuste no texto: mais curto', 'redator'),
    ev('redator', 'acao', 'Encurtando'),
    ev('redator', 'entrega', 'Texto ajustado', 'voce'),
  ]

  it('cada entrega vira um e-mail com o que a pessoa fez e o que escreveu', () => {
    const emails = emailsDoPost(eventos)
    expect(emails.map((e) => `${e.de}>${e.para}`)).toEqual(['chefe>redator', 'redator>voce', 'voce>redator', 'redator>voce'])
    expect(emails[0]).toMatchObject({ assunto: 'Pauta pronta', feito: ['Lendo o pedido', 'Distribuindo a pauta'], trecho: 'Pauta: 5 slides sobre limão.' })
  })

  it('o segundo e-mail de alguém só conta o que ele fez depois do primeiro', () => {
    const [, primeiro, , segundo] = emailsDoPost(eventos)
    expect(primeiro.feito).toEqual(['Escrevendo os slides'])
    expect(segundo.feito).toEqual(['Encurtando'])
  })

  it('a caixa de entrada conta o que cada um recebeu', () => {
    expect(contarRecebidos(eventos)).toEqual({ redator: 2, voce: 2 })
  })

  it('corta o trecho longo numa palavra inteira', () => {
    const t = resumir('palavra '.repeat(200), 50)
    expect(t.endsWith('…')).toBe(true)
    expect(t.length).toBeLessThanOrEqual(51)
    expect(t).not.toMatch(/ …$/)
  })
})
