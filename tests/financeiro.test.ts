// Números do Financeiro com um banco falso: os totais contam o que foi cobrado (passos que falharam, gastos fora dos
// posts) no dia em que foi cobrado, e cada post aparece como um teste com o seu custo.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BancoFalso } from './apoio/banco-falso'

const banco = vi.hoisted(() => ({ atual: null as unknown as BancoFalso }))
vi.mock('../api/_lib/db', () => ({
  get db() {
    return banco.atual
  },
  usuarioDaRequisicao: async () => 'u1',
}))

const { juntarNumeros } = await import('../api/financeiro')

const AGORA = Date.UTC(2026, 10, 20, 15)
const dia = (d: number, h = 12) => new Date(Date.UTC(2026, 10, d, h)).toISOString()

beforeEach(() => {
  const b = new BancoFalso()
  b.tabelas.marcas = [{ id: 'm1', dono_id: 'u1', nome: 'Drinfy' }]
  b.tabelas.posts = [
    { id: 'p1', marca_id: 'm1', briefing: 'Carrossel sobre negroni', status: 'publicado', formato: 'carrossel', custo_usd: 0.9, voltas_revisao: 1, criado_em: dia(18), preferencias: { ias: { redator: 'claude-sonnet-5-5' } } },
    { id: 'p2', marca_id: 'm1', briefing: 'Reel do app', status: 'erro', formato: 'reel', custo_usd: 0.4, voltas_revisao: 0, criado_em: dia(19), preferencias: {} },
  ]
  b.tabelas.passos = [
    { post_id: 'p1', agente: 'chefe', status: 'feito', custo_usd: 0.1, tokens_entrada: 10, tokens_saida: 5, iniciado_em: dia(18), terminado_em: dia(18), criado_em: dia(18), modelos: ['claude-sonnet-5-5'] },
    // a correção rodou dois dias depois de o post ser criado: o gasto é do dia 20
    { post_id: 'p1', agente: 'redator', status: 'feito', custo_usd: 0.8, tokens_entrada: 10, tokens_saida: 5, iniciado_em: dia(20, 9), terminado_em: dia(20, 10), criado_em: dia(20, 9), modelos: ['claude-sonnet-5-5'] },
    // passo que falhou também foi cobrado
    { post_id: 'p2', agente: 'cinegrafista', status: 'falhou', custo_usd: 0.4, tokens_entrada: 10, tokens_saida: 5, iniciado_em: dia(19), terminado_em: dia(19), criado_em: dia(19), modelos: ['claude-sonnet-5-5', 'Kling'] },
  ]
  b.tabelas.gastos = [
    { dono_id: 'u1', marca_id: 'm1', origem: 'ideias', descricao: 'drinks de verão', custo_usd: 0.05, criado_em: dia(20), deu_erro: false },
    { dono_id: 'u1', marca_id: null, origem: 'financeiro', descricao: 'Análise', custo_usd: 0.02, criado_em: dia(20), deu_erro: false },
    { dono_id: 'outro', marca_id: null, origem: 'ideias', descricao: 'de outra pessoa', custo_usd: 9, criado_em: dia(20), deu_erro: false },
  ]
  banco.atual = b
})

describe('números do Financeiro', () => {
  it('soma passos (inclusive os que falharam) e gastos fora dos posts', async () => {
    const n = (await juntarNumeros('u1', AGORA))!
    expect(n.total_posts_usd).toBeCloseTo(1.3)
    expect(n.total_fora_dos_posts_usd).toBeCloseTo(0.07)
    expect(n.total_usd).toBeCloseTo(1.37)
    expect(n.fora_dos_posts.map((o) => o.nome)).toEqual(['Ideias de posts', 'Análises do Financeiro'])
    expect(n.por_agente.find((a) => a.agente === 'cinegrafista')?.erros).toBe(1)
  })

  it('põe cada gasto no dia em que aconteceu', async () => {
    const n = (await juntarNumeros('u1', AGORA))!
    const no = (d: string) => n.por_dia.find((x) => x.dia === d)?.custo
    expect(no('2026-11-18')).toBeCloseTo(0.1)
    expect(no('2026-11-19')).toBeCloseTo(0.4)
    expect(no('2026-11-20')).toBeCloseTo(0.87)
  })

  it('lista o custo por teste, do mais novo ao mais antigo, com as IAs usadas', async () => {
    const n = (await juntarNumeros('u1', AGORA))!
    expect(n.testes.map((t) => [t.id, t.custo, t.execucoes, t.falhas])).toEqual([
      ['p2', 0.4, 1, 1],
      ['p1', 0.9, 2, 0],
    ])
    expect(n.testes[0].ias).toEqual(['claude-sonnet-5-5', 'Kling'])
  })
})
