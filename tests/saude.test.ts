import { describe, expect, it } from 'vitest'
import { arquivosParaApagar, usadosPeloPost } from '../api/_lib/limpeza'
import { classificarSaude, type PassoVisto } from '../api/_lib/saude'

const agora = new Date('2026-10-29T12:00:00Z')
const min = (n: number) => new Date(agora.getTime() - n * 60_000).toISOString()
const passo = (o: Partial<PassoVisto>): PassoVisto => ({ agente: 'designer', status: 'feito', criado_em: min(1), iniciado_em: null, terminado_em: null, saida: null, briefing: 'Post', ...o })

describe('saúde da produção', () => {
  it('acha passo rodando há mais de 15 min e pendente há mais de 10', () => {
    const l = classificarSaude([passo({ status: 'rodando', iniciado_em: min(20) }), passo({ status: 'pendente', criado_em: min(5) })], 0, null, agora)
    expect(l.find((x) => x.id === 'saude:parados')).toMatchObject({ estado: 'erro' })
    const ok = classificarSaude([passo({ status: 'rodando', iniciado_em: min(5) })], 0, null, agora)
    expect(ok.find((x) => x.id === 'saude:parados')).toMatchObject({ estado: 'ok' })
  })

  it('agrupa as falhas da semana por agente, com a última mensagem', () => {
    const l = classificarSaude(
      [
        passo({ status: 'falhou', terminado_em: min(100), saida: { erro: 'antigo' } }),
        passo({ status: 'falhou', terminado_em: min(10), saida: { erro: 'Chromium caiu' } }),
        passo({ status: 'falhou', agente: 'redator', terminado_em: min(60 * 24 * 8), saida: { erro: 'velho' } }),
      ],
      0,
      null,
      agora,
    )
    const d = l.find((x) => x.id === 'saude:falhas:designer')!
    expect(d.nome).toBe('Designer: 2 falhas em 7 dias')
    expect(d.detalhe).toBe('Última: Chromium caiu')
    expect(l.find((x) => x.id === 'saude:falhas:redator')).toBeUndefined()
  })
})

describe('faxina', () => {
  it('apaga só as versões que o post não usa mais', () => {
    const usados = usadosPeloPost({
      slides: [{ caminho: 'p1/v2-9/slide-1.jpg', url: 'https://x/storage/v1/object/public/posts/p1/v2-9/slide-1.jpg' }],
      video: { url: 'https://x/storage/v1/object/public/posts/p1/video-5.mp4' },
    })
    expect(arquivosParaApagar(['p1/v1-1/slide-1.jpg', 'p1/v2-9/slide-1.jpg', 'p1/video-5.mp4', 'p1/video-3.mp4'], usados)).toEqual(['p1/v1-1/slide-1.jpg', 'p1/video-3.mp4'])
  })
})
