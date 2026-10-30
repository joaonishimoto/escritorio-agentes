// Fluxo da fila do executor com um banco falso e agentes de mentira: a ordem dos passos,
// a falha que para o post e o teto de gasto que manda o post para você.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BancoFalso } from './apoio/banco-falso'

const banco = vi.hoisted(() => ({ atual: null as unknown as BancoFalso }))
const cena = vi.hoisted(() => ({ custo: 0.1, falhar: null as string | null }))

vi.mock('../api/_lib/db', () => ({
  get db() {
    return banco.atual
  },
  BUCKET_POSTS: 'posts',
  urlPublica: (c: string) => c,
}))
vi.mock('@vercel/functions', () => ({ waitUntil: () => {} }))

// cada agente de mentira só registra que trabalhou; o revisor manda para você
const falso = (nome: string) => async () => {
  if (cena.falhar === nome) throw new Error(`${nome} quebrou`)
  if (nome === 'revisor') {
    await banco.atual.from('posts').update({ status: 'aguardando_aprovacao' }).eq('id', 'p1')
    return { saida: { aprovado: true }, uso: { tokens_entrada: 0, tokens_saida: 0, custo_usd: cena.custo }, entrega: 'Aprovado', proximos: null, para: 'voce' }
  }
  return { saida: nome === 'designer' ? { slides: [{ ordem: 1 }] } : { feito: nome }, uso: { tokens_entrada: 1, tokens_saida: 1, custo_usd: cena.custo }, entrega: `${nome} entregou` }
}
vi.mock('../api/_lib/agentes/producao', () => ({
  chefe: falso('chefe'),
  pesquisador: falso('pesquisador'),
  redator: falso('redator'),
  designer: falso('designer'),
  criativos: falso('criativos'),
  cinegrafista: falso('cinegrafista'),
  narrador: falso('narrador'),
  revisor: falso('revisor'),
}))
vi.mock('../api/_lib/agentes/pos', () => ({ curador: falso('curador'), publicador: falso('publicador') }))

const { enfileirar, rodarAteOLimite } = await import('../api/_lib/fila')

const passos = () => [...banco.atual.tabela('passos')].sort((a, b) => (a.ordem as number) - (b.ordem as number))
const post = () => banco.atual.tabela('posts')[0]

beforeEach(() => {
  cena.custo = 0.1
  cena.falhar = null
  const b = new BancoFalso()
  b.tabelas.marcas = [{ id: 'm1', dono_id: 'u1', nome: 'Marca de teste', tom_de_voz: '', modelo_slides_html: null, identidade: {} }]
  b.tabelas.posts = [{ id: 'p1', marca_id: 'm1', briefing: 'Post de teste', formato: 'carrossel', status: 'em_producao', slides: [], custo_usd: 0, criado_em: new Date().toISOString() }]
  // a função do banco que pega o próximo passo pendente e marca como rodando
  b.rpcs.pegar_proximo_passo = () => {
    const p = b.tabela('passos').filter((x) => x.status === 'pendente').sort((x, y) => (x.ordem as number) - (y.ordem as number))[0]
    if (!p) return null
    Object.assign(p, { status: 'rodando', tentativas: (p.tentativas as number) + 1, iniciado_em: new Date().toISOString() })
    return { ...p }
  }
  banco.atual = b
})

describe('fila do executor', () => {
  it('um carrossel passa por toda a equipe na ordem e chega na sua mesa', async () => {
    await enfileirar('p1', 'chefe')
    const r = await rodarAteOLimite(10_000)
    expect(r).toEqual({ rodou: 5, sobrou: false })
    expect(passos().map((p) => [p.agente, p.status])).toEqual([
      ['chefe', 'feito'],
      ['pesquisador', 'feito'],
      ['redator', 'feito'],
      ['designer', 'feito'],
      ['revisor', 'feito'],
    ])
    expect(post().status).toBe('aguardando_aprovacao')
    expect(post().custo_usd).toBeCloseTo(0.5)
    expect(banco.atual.tabela('eventos').filter((e) => e.tipo === 'entrega').map((e) => e.para)).toEqual(['pesquisador', 'redator', 'designer', 'revisor', 'voce'])
  })

  it('uma falha que não é de rede para o post e guarda o erro no passo', async () => {
    cena.falhar = 'redator'
    await enfileirar('p1', 'chefe')
    await rodarAteOLimite(10_000)
    expect(passos().map((p) => p.agente)).toEqual(['chefe', 'pesquisador', 'redator'])
    expect(passos()[2]).toMatchObject({ status: 'falhou', saida: { erro: 'redator quebrou' } })
    expect(post().status).toBe('erro')
  })

  it('o teto de gasto por post para a produção e manda o que tem para você', async () => {
    cena.custo = 0.8 // teto padrão é US$ 2: passa depois do redator (0,8 × 3)
    await enfileirar('p1', 'chefe')
    await rodarAteOLimite(10_000)
    expect(passos().map((p) => p.agente)).toEqual(['chefe', 'pesquisador', 'redator'])
    // o redator não tem slides: o post vai para erro, com a explicação
    expect(post().status).toBe('erro')
    expect(banco.atual.tabela('eventos').some((e) => e.tipo === 'erro' && String(e.mensagem).startsWith('Parei: o post chegou a US$ 2.40'))).toBe(true)
  })
})
