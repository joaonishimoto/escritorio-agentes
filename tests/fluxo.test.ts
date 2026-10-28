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
