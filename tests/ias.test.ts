import { describe, expect, it } from 'vitest'
import { limparIas, modeloDe, motorDeVideo, motorPadrao, PADRAO_TEXTO } from '../api/_lib/ias'
import type { Contexto } from '../api/_lib/contexto'

const ctx = (ias?: Record<string, string>) => ({ post: { preferencias: { ias } } }) as unknown as Contexto

describe('motor de vídeo padrão', () => {
  it('prefere o fal.ai, depois a Kling direta, depois a animação do Claude', () => {
    expect(motorPadrao({ fal: true, kling: true })).toBe('fal-kling')
    expect(motorPadrao({ fal: false, kling: true })).toBe('kling')
    expect(motorPadrao({})).toBe('claude')
  })
})

describe('IAs escolhidas por post', () => {
  it('só deixa passar escolhas conhecidas', () => {
    expect(limparIas({ redator: 'claude-haiku-5-5', cinegrafista: 'claude', narrador: 'nenhum', designer: 'gpt-99', chefe: 'kling', curador: 'claude-opus-5-5' })).toEqual({
      redator: 'claude-haiku-5-5',
      cinegrafista: 'claude',
      narrador: 'nenhum',
    })
    expect(limparIas('lixo')).toEqual({})
  })
  it('cai no padrão quando o post não escolheu', () => {
    expect(modeloDe(ctx(), 'redator')).toBe(PADRAO_TEXTO.redator)
    expect(modeloDe(ctx({ redator: 'claude-haiku-5-5' }), 'redator')).toBe('claude-haiku-5-5')
    expect(motorDeVideo(ctx())).toBe(motorPadrao())
    expect(motorDeVideo(ctx({ cinegrafista: 'fal-hailuo' }))).toBe('fal-hailuo')
  })
})
