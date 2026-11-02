import { describe, expect, it } from 'vitest'
import { agrupar, entenderTexto, ordenar, resumoParaHoje, situacaoDoPrazo, textoDoPrazo, topicosConhecidos, type Tarefa } from '../src/lib/tarefas'

// segunda-feira, 2 de novembro de 2026
const hoje = new Date(2026, 10, 2, 10, 0)
const MARCAS = [
  { id: 'd', nome: 'Drinfy', cor: '#b74e45' },
  { id: 'n', nome: 'Nishistack', cor: '#1e3d66' },
  { id: 'f', nome: 'FreelaPro', cor: '#3f7650' },
]
const t = (p: Partial<Tarefa>): Tarefa => ({ id: Math.random().toString(), marca_id: null, titulo: 'x', topico: 'Geral', notas: null, prazo: null, importante: false, feita_em: null, criado_em: '2026-11-01T10:00:00Z', ...p })

describe('a Assistente entende o que você anotou', () => {
  it('acha marca no começo, tópico com #, prazo e importante', () => {
    expect(entenderTexto('Drinfy: gravar reels amanhã #conteúdo !', MARCAS, hoje)).toEqual({
      titulo: 'Gravar reels',
      marcaId: 'd',
      topico: 'Conteúdo',
      prazo: '2026-11-03',
      importante: true,
    })
  })

  it('aceita @marca no meio e o nome solto, sem tirar o nome solto do título', () => {
    expect(entenderTexto('mandar proposta @nishistack até sexta', MARCAS, hoje)).toMatchObject({ titulo: 'Mandar proposta', marcaId: 'n', prazo: '2026-11-06' })
    expect(entenderTexto('revisar contrato da freelapro', MARCAS, hoje)).toMatchObject({ titulo: 'Revisar contrato da freelapro', marcaId: 'f' })
  })

  it('tarefa pessoal fica sem marca', () => {
    const r = entenderTexto('pagar conta de luz hoje #casa', MARCAS, hoje)
    expect(r.marcaId).toBeUndefined()
    expect(r).toMatchObject({ titulo: 'Pagar conta de luz', topico: 'Casa', prazo: '2026-11-02', importante: false })
  })

  it('entende dd/mm, joga para o ano que vem se já passou, e dia da semana é sempre o próximo', () => {
    expect(entenderTexto('dentista 12/11', [], hoje).prazo).toBe('2026-11-12')
    expect(entenderTexto('renovar domínio 15/01', [], hoje).prazo).toBe('2027-01-15')
    expect(entenderTexto('academia segunda', [], hoje).prazo).toBe('2026-11-09')
    expect(entenderTexto('ligar pro banco depois de amanhã', [], hoje).prazo).toBe('2026-11-04')
  })

  it('não confunde parte de palavra com marca', () => {
    expect(entenderTexto('comprar drinfyzinho', MARCAS, hoje).marcaId).toBeUndefined()
  })
})

describe('organização', () => {
  it('prazos', () => {
    expect(situacaoDoPrazo('2026-11-01', hoje)).toBe('atrasada')
    expect(textoDoPrazo('2026-11-02', hoje)).toBe('Hoje')
    expect(textoDoPrazo('2026-11-03', hoje)).toBe('Amanhã')
    expect(textoDoPrazo('2026-11-06', hoje)).toBe('sex')
    expect(textoDoPrazo('2026-12-20', hoje)).toBe('20 dez')
  })

  it('abertas primeiro: importantes, depois o prazo mais perto; feitas no fim', () => {
    const lista = [t({ id: 'feita', feita_em: '2026-11-02T09:00:00Z' }), t({ id: 'sem-prazo' }), t({ id: 'longe', prazo: '2026-11-20' }), t({ id: 'perto', prazo: '2026-11-03' }), t({ id: 'imp', importante: true })]
    expect(ordenar(lista).map((x) => x.id)).toEqual(['imp', 'perto', 'longe', 'sem-prazo', 'feita'])
  })

  it('separa por marca (Pessoal primeiro, na ordem do andar) e por tópico', () => {
    const lista = [t({ marca_id: 'n', topico: 'Vendas' }), t({ topico: 'Casa' }), t({ marca_id: 'd', topico: 'Conteúdo' }), t({ marca_id: 'd', topico: 'Vendas' })]
    expect(agrupar(lista, 'marca', MARCAS).map((g) => [g.nome, g.tarefas.length])).toEqual([['Pessoal', 1], ['Drinfy', 2], ['Nishistack', 1]])
    expect(agrupar(lista, 'topico', MARCAS).map((g) => [g.nome, g.tarefas.length])).toEqual([['Casa', 1], ['Conteúdo', 1], ['Vendas', 2]])
  })

  it('conta atrasadas e de hoje, ignorando as feitas', () => {
    const lista = [t({ prazo: '2026-11-01' }), t({ prazo: '2026-11-02' }), t({ prazo: '2026-11-02', feita_em: 'x' }), t({})]
    expect(resumoParaHoje(lista, hoje)).toEqual({ abertas: 3, atrasadas: 1, paraHoje: 1 })
  })

  it('tópicos: os seus e os sugeridos, sem repetir acento', () => {
    const r = topicosConhecidos([t({ topico: 'conteudo' }), t({ topico: 'Lançamento' })])
    expect(r.slice(0, 3)).toEqual(['conteudo', 'Lançamento', 'Geral'])
    expect(r.filter((x) => x.toLowerCase().startsWith('conte'))).toHaveLength(1)
  })
})
