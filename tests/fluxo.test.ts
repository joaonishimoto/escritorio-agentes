import { describe, expect, it } from 'vitest'
import { fluxoDeProducao } from '../api/_lib/contexto'

describe('fluxo de produção', () => {
  it('carrossel segue o roteiro padrão', () => {
    expect(fluxoDeProducao([], 'carrossel')).toEqual(['chefe', 'pesquisador', 'redator', 'designer', 'revisor'])
  })
  it('reel põe cinegrafista e narrador antes do revisor', () => {
    expect(fluxoDeProducao([], 'reel')).toEqual(['chefe', 'pesquisador', 'redator', 'designer', 'cinegrafista', 'narrador', 'revisor'])
  })
  it('respeita quem o roteiro desligou', () => {
    const etapas = ['chefe', 'pesquisador', 'redator', 'designer', 'revisor'].map((agente) => ({ agente, ativo: agente !== 'pesquisador', instrucoes: '' }))
    expect(fluxoDeProducao(etapas, 'foto')).toEqual(['chefe', 'redator', 'designer', 'revisor'])
  })
})

import { identidadeVisual } from '../api/_lib/contexto'

describe('identidadeVisual', () => {
  it('tira do prompt o que o app guarda na identidade (sala, ideias guardadas) e deixa o visual', () => {
    const v = identidadeVisual({ cores: { primaria: '#123456' }, fontes: ['Inter'], sala: { base: 'a' }, posicao: 2, cor_sala: '#fff', ideias_guardadas: [{ titulo: 'x' }], tom_editado: true })
    expect(v).toEqual({ cores: { primaria: '#123456' }, fontes: ['Inter'] })
    expect(identidadeVisual(null)).toEqual({})
  })
})
