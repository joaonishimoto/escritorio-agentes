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
  it('chave da ElevenLabs sem permissão de voz explica e oferece seguir sem narração', () => {
    const e = explicarErro('narrador', 'ElevenLabs: a chave não tem a permissão "Text to Speech". Na ElevenLabs, em Developers → API Keys, edite a chave.')
    expect(e.titulo).toMatch(/não pode gerar voz/)
    expect(e.trocarPara).toBe('nenhum')
  })
  it('Anthropic sem crédito explica, linka a recarga e não oferece trocar de IA', () => {
    for (const msg of [
      '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans &amp; Billing to upgrade or purchase credits."}}',
      'Anthropic: sem créditos na conta. Recarregue em https://console.anthropic.com/settings/billing e tente de novo.',
    ]) {
      const e = explicarErro('redator', msg)
      expect(e.titulo).toMatch(/créditos da Anthropic/)
      expect(e.semTrocaDeIA).toBe(true)
      expect(e.link?.url).toBe('https://console.anthropic.com/settings/billing')
    }
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

describe('erros da ElevenLabs', () => {
  it('permissão que falta vira instrução para liberar Text to Speech', async () => {
    const { explicarErroElevenLabs } = await import('../api/_lib/elevenlabs')
    const m = explicarErroElevenLabs(401, 'The API key you used is missing the permission text_to_speech to execute this operation.')
    expect(m).toMatch(/Text to Speech/)
    expect(m).not.toMatch(/recusou a chave/)
    expect(explicarErroElevenLabs(401, 'API key ID used as API key')).toMatch(/sk_/)
  })
})
