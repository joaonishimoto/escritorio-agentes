import { describe, expect, it } from 'vitest'
import { briefingDireto, montarPublicacaoDireta } from '../api/_lib/publicacao-direta'

const base = 'https://x.supabase.co/storage/v1/object/public/marcas/m1/'
const agora = new Date('2026-11-03T12:00:00Z')

describe('publicação direta', () => {
  it('vídeo vira Reel, com a imagem como capa', () => {
    const r = montarPublicacaoDireta({ legenda: ' Oi ', midias: [{ tipo: 'video', url: `${base}publicar/a.mp4` }, { tipo: 'imagem', url: `${base}publicar/c.jpg` }] }, base, agora)
    expect('post' in r && r.post).toMatchObject({ formato: 'reel', legenda: 'Oi', video: { url: `${base}publicar/a.mp4`, caminho: 'publicar/a.mp4' }, slides: [{ ordem: 1, caminho: 'publicar/c.jpg' }], agendado_para: null })
  })
  it('uma imagem é foto, várias são carrossel', () => {
    const uma = montarPublicacaoDireta({ midias: [{ tipo: 'imagem', url: `${base}1.jpg` }] }, base, agora)
    const duas = montarPublicacaoDireta({ midias: [{ tipo: 'imagem', url: `${base}1.jpg` }, { tipo: 'imagem', url: `${base}2.jpg` }] }, base, agora)
    expect('post' in uma && uma.post.formato).toBe('foto')
    expect('post' in duas && duas.post.formato).toBe('carrossel')
  })
  it('recusa arquivo de fora da pasta da marca', () => {
    expect(montarPublicacaoDireta({ midias: [{ tipo: 'imagem', url: 'https://outro.com/a.jpg' }] }, base, agora)).toHaveProperty('erro')
    expect(montarPublicacaoDireta({ midias: [{ tipo: 'imagem', url: base.replace('m1', 'm2') + 'a.jpg' }] }, base, agora)).toHaveProperty('erro')
  })
  it('recusa nada, dois vídeos, vídeo com várias imagens, mais de 10 imagens e legenda longa', () => {
    const img = (i: number) => ({ tipo: 'imagem', url: `${base}${i}.jpg` })
    const vid = { tipo: 'video', url: `${base}v.mp4` }
    expect(montarPublicacaoDireta({ midias: [] }, base, agora)).toHaveProperty('erro')
    expect(montarPublicacaoDireta({ midias: [vid, vid] }, base, agora)).toHaveProperty('erro')
    expect(montarPublicacaoDireta({ midias: [vid, img(1), img(2)] }, base, agora)).toHaveProperty('erro')
    expect(montarPublicacaoDireta({ midias: Array.from({ length: 11 }, (_, i) => img(i)) }, base, agora)).toHaveProperty('erro')
    expect(montarPublicacaoDireta({ legenda: 'a'.repeat(2201), midias: [img(1)] }, base, agora)).toHaveProperty('erro')
  })
  it('agenda só no futuro', () => {
    const midias = [{ tipo: 'imagem', url: `${base}1.jpg` }]
    expect(montarPublicacaoDireta({ midias, quando: '2026-11-03T11:00:00Z' }, base, agora)).toHaveProperty('erro')
    const r = montarPublicacaoDireta({ midias, quando: '2026-11-04T22:00:00Z' }, base, agora)
    expect('post' in r && r.post.agendado_para).toBe('2026-11-04T22:00:00.000Z')
  })
  it('o pedido do post mostra o tipo e o começo da legenda', () => {
    expect(briefingDireto('Espanhola de maracujá 🍹\n\n#drinks', 'reel')).toBe('Reel enviado por você: Espanhola de maracujá 🍹')
    expect(briefingDireto('', 'foto')).toBe('Foto enviada por você')
  })
})
