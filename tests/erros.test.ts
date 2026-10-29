import { describe, expect, it } from 'vitest'
import { explicarErro } from '../src/lib/erros'

describe('explicação dos erros para o dono', () => {
  it('Kling sem crédito sugere a animação do Claude', () => {
    const e = explicarErro('cinegrafista', 'Kling: sem créditos na conta (saldo insuficiente).')
    expect(e.titulo).toMatch(/Kling/)
    expect(e.trocarPara).toBe('claude')
  })
  it('navegador que caiu vira "desenho dos slides caiu"', () => {
    expect(explicarErro('designer', 'page.setContent: Target page, context or browser has been closed').titulo).toMatch(/desenho dos slides/)
  })
  it('token do Instagram expirado pede para reconectar', () => {
    expect(explicarErro('publicador', 'Token do Instagram expirado ou inválido.').texto).toMatch(/Reconecte/)
  })
  it('erro desconhecido tem saída genérica', () => {
    expect(explicarErro('redator', 'algo estranho').titulo).toBe('Algo deu errado')
  })
})

describe('erros que não são da IA', () => {
  it('navegador caído não oferece trocar de IA', () => {
    const e = explicarErro('designer', 'page.evaluate: Target page, context or browser has been closed')
    expect(e.semTrocaDeIA).toBe(true)
    expect(e.texto).toMatch(/sem gastar com a IA/)
  })
  it('falta de espaço no servidor tem explicação própria', () => {
    expect(explicarErro('designer', 'page.setContent: Target page closed (espaço livre no servidor: 13 MB)').titulo).toMatch(/espaço/)
  })
})
