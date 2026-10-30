import { describe, expect, it } from 'vitest'
import { formatoDaMidia, textoDaMemoria, textoDoPost, type Ficha } from '../api/_lib/memoria'

const ficha = (f: Partial<Ficha>): Ficha => ({ publicado_em: null, formato: null, tema: null, angulo: null, gancho: null, linha: null, texto: '', ...f })

describe('memória da marca', () => {
  it('traduz o tipo de mídia do Instagram para o formato do app', () => {
    expect(formatoDaMidia({ media_type: 'CAROUSEL_ALBUM' })).toBe('carrossel')
    expect(formatoDaMidia({ media_type: 'VIDEO', media_product_type: 'REELS' })).toBe('reel')
    expect(formatoDaMidia({ media_type: 'IMAGE', media_product_type: 'FEED' })).toBe('foto')
  })

  it('junta o texto dos slides e a legenda, e cai no briefing quando não há nenhum', () => {
    expect(textoDoPost({ slides: [{ texto: 'Capa' }, { texto: '  ' }, { url: 'x' }], legenda: 'Salva aí' })).toBe('Slides: Capa Legenda: Salva aí')
    expect(textoDoPost({ slides: [], legenda: null, briefing: 'post sobre gin' })).toBe('post sobre gin')
  })

  it('monta o texto do prompt com a ficha resumida ou um pedaço do texto quando ainda não tem resumo', () => {
    const t = textoDaMemoria([
      ficha({ publicado_em: '2026-10-20T15:00:00Z', formato: 'carrossel', linha: 'receita', tema: 'caipirinha de limão', angulo: 'erros comuns', gancho: 'Sua caipirinha amarga?' }),
      ficha({ formato: 'foto', texto: 'Legenda antiga   sobre gin tônica' }),
    ])
    expect(t).toContain('- 2026-10-20 · carrossel · receita · caipirinha de limão (erros comuns): "Sua caipirinha amarga?"')
    expect(t).toContain('- s/ data · foto · Legenda antiga sobre gin tônica')
    expect(textoDaMemoria([])).toBe('')
  })

  it('mostra só os mais recentes quando passa do máximo', () => {
    const t = textoDaMemoria(Array.from({ length: 5 }, (_, i) => ficha({ tema: `tema ${i}` })), 2)
    expect(t).toContain('(5, mostrando os 2 mais recentes)')
    expect(t).not.toContain('tema 2')
  })
})
