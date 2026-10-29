// Fluxo da rota /api/aprovar com um banco falso: agendar, aprovar, corrigir, desagendar e dono errado.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BancoFalso } from './apoio/banco-falso'

const banco = vi.hoisted(() => ({ atual: null as unknown as BancoFalso }))
const fila = vi.hoisted(() => ({ enfileirados: [] as { post: string; agente: string; entrada?: unknown }[] }))

vi.mock('../api/_lib/db', () => ({
  get db() {
    return banco.atual
  },
  usuarioDaRequisicao: async (auth?: string) => (auth === 'Bearer dono' ? 'u1' : auth === 'Bearer outro' ? 'u2' : null),
  eDonoDaMarca: async (u: string, m: string) => banco.atual.tabela('marcas').some((x) => x.id === m && x.dono_id === u),
}))
vi.mock('../api/_lib/fila', () => ({
  enfileirar: async (post: string, agente: string, entrada?: unknown) => {
    fila.enfileirados.push({ post, agente, entrada })
  },
  acordarExecutor: () => {},
}))

process.env.SUPABASE_URL = 'http://x'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'
process.env.ANTHROPIC_API_KEY = 'x'
process.env.EXECUTOR_SECRET = 'x'
process.env.APP_URL = 'https://app.teste'

const { default: aprovar } = await import('../api/aprovar')

async function chamar(corpo: Record<string, unknown>, quem = 'dono') {
  let status = 200
  let json: unknown
  const res = {
    status(s: number) {
      status = s
      return this
    },
    json(j: unknown) {
      json = j
      return this
    },
    end() {
      return this
    },
    headersSent: false,
  }
  await aprovar({ method: 'POST', headers: { authorization: `Bearer ${quem}`, host: 'app.teste', 'x-forwarded-proto': 'https' }, body: corpo } as never, res as never)
  return { status, json: json as { erro?: string; ok?: boolean } }
}

const post = () => banco.atual.tabela('posts')[0]
const daqui = (min: number) => new Date(Date.now() + min * 60_000).toISOString()

beforeEach(() => {
  banco.atual = new BancoFalso()
  fila.enfileirados = []
  banco.atual.tabelas.marcas = [{ id: 'm1', dono_id: 'u1', nome: 'Drinfy' }]
  banco.atual.tabelas.posts = [{ id: 'p1', marca_id: 'm1', status: 'aguardando_aprovacao', agendado_para: null, slides: [{ ordem: 1, url: 'u' }], preferencias: {} }]
})

describe('aprovar', () => {
  it('agendar grava a data, o endereço do app e um evento, sem acordar o publicador', async () => {
    const quando = daqui(120)
    expect((await chamar({ post_id: 'p1', acao: 'agendar', quando })).status).toBe(200)
    expect(post()).toMatchObject({ status: 'agendado', agendado_para: quando })
    expect(banco.atual.tabela('config_app')).toEqual([expect.objectContaining({ chave: 'url_app', valor: 'https://app.teste' })])
    expect(banco.atual.tabela('eventos')[0].mensagem).toMatch(/^Agendado para/)
    expect(fila.enfileirados).toEqual([])
  })

  it('não agenda no passado', async () => {
    const r = await chamar({ post_id: 'p1', acao: 'agendar', quando: daqui(-5) })
    expect(r).toEqual({ status: 400, json: { erro: 'Escolha um horário no futuro' } })
    expect(post().status).toBe('aguardando_aprovacao')
  })

  it('aprovar manda para o publicador', async () => {
    await chamar({ post_id: 'p1', acao: 'aprovar' })
    expect(post().status).toBe('aprovado')
    expect(fila.enfileirados).toEqual([{ post: 'p1', agente: 'publicador', entrada: undefined }])
  })

  it('corrigir exige comentário e manda para o curador', async () => {
    expect((await chamar({ post_id: 'p1', acao: 'corrigir' })).status).toBe(400)
    await chamar({ post_id: 'p1', acao: 'corrigir', comentario: 'troque a capa' })
    expect(post().status).toBe('em_producao')
    expect(fila.enfileirados[0]).toMatchObject({ agente: 'curador', entrada: { acao: 'corrigir', comentario: 'troque a capa' } })
  })

  it('desagendar volta para a sua mesa', async () => {
    await chamar({ post_id: 'p1', acao: 'agendar', quando: daqui(60) })
    await chamar({ post_id: 'p1', acao: 'desagendar' })
    expect(post()).toMatchObject({ status: 'aguardando_aprovacao', agendado_para: null })
  })

  it('quem não é dono da marca não vê o post', async () => {
    expect((await chamar({ post_id: 'p1', acao: 'aprovar' }, 'outro')).status).toBe(404)
    expect((await chamar({ post_id: 'p1', acao: 'aprovar' }, 'ninguem')).status).toBe(401)
    expect(post().status).toBe('aguardando_aprovacao')
  })
})
