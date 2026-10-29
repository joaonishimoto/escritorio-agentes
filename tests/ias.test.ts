import { describe, expect, it } from 'vitest'
import { limparIas, modeloDe, motorDeImagem, motorDeVideo, motorPadrao, PADRAO_TEXTO } from '../api/_lib/ias'
import type { Contexto } from '../api/_lib/contexto'

const ctx = (ias?: Record<string, string>) => ({ post: { preferencias: { ias } } }) as unknown as Contexto

describe('motor de vídeo padrão', () => {
  it('é sempre a animação do Claude: vídeo pago só por escolha no post', () => {
    expect(motorPadrao()).toBe('claude')
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
  it('imagens do designer: só com FAL_KEY, no Seedream se o post não escolheu, ou nenhuma', () => {
    expect(limparIas({ imagens: 'nano-banana', designer: 'nenhuma' })).toEqual({ imagens: 'nano-banana' })
    expect(limparIas({ imagens: 'nenhuma' })).toEqual({ imagens: 'nenhuma' })
    expect(limparIas({ imagens: 'dall-e' })).toEqual({})
    const antes = process.env.FAL_KEY
    delete process.env.FAL_KEY
    expect(motorDeImagem(ctx())).toBeNull()
    process.env.FAL_KEY = 'teste'
    expect(motorDeImagem(ctx())).toBe('seedream')
    expect(motorDeImagem(ctx({ imagens: 'nano-banana-pro' }))).toBe('nano-banana-pro')
    expect(motorDeImagem(ctx({ imagens: 'nenhuma' }))).toBeNull()
    if (antes === undefined) delete process.env.FAL_KEY
    else process.env.FAL_KEY = antes
  })
})
