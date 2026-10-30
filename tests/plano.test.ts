import { describe, expect, it } from 'vitest'
import { espalhar, lerEspeciais, montarVagas, resumoDoPlano, type ConfigPlano } from '../src/lib/plano'

const base: ConfigPlano = {
  inicio: '2026-11-02',
  dias: 30,
  ritmo: { tipo: 'por_dia', n: 1 },
  mix: { carrossel: 60, foto: 30, reel: 10 },
  linhas: ['educativo', 'receita', 'bastidor'],
  especiais: [],
  horario: { modo: 'bons' },
  teto_usd: null,
}
const agora = new Date(2026, 9, 30, 10, 0)

describe('plano editorial', () => {
  it('30 dias com 1 por dia viram 30 vagas na proporção do mix', () => {
    const v = montarVagas(base, [], 'm1', agora)
    expect(v).toHaveLength(30)
    expect(resumoDoPlano(v).conta).toEqual({ carrossel: 18, foto: 9, reel: 3 })
    // um por dia, no primeiro horário bom (seg 02/11 às 12h)
    expect(new Date(v[0].quando)).toEqual(new Date(2026, 10, 2, 12, 0))
    expect(new Set(v.map((x) => new Date(x.quando).toDateString())).size).toBe(30)
  })

  it('não repete a mesma linha seguida nem o mesmo formato três vezes seguidas', () => {
    const v = montarVagas(base, [], 'm1', agora)
    for (let i = 1; i < v.length; i++) expect(v[i].linha).not.toBe(v[i - 1].linha)
    for (let i = 2; i < v.length; i++) expect(v[i].formato === v[i - 1].formato && v[i].formato === v[i - 2].formato).toBe(false)
  })

  it('pula os dias que a marca já tem post e respeita outras marcas', () => {
    const agenda = [
      { id: 'a', data: new Date(2026, 10, 3, 19).toISOString(), status: 'agendado', marcaId: 'm1' },
      { id: 'b', data: new Date(2026, 10, 4, 19).toISOString(), status: 'agendado', marcaId: 'outra' },
    ]
    const v = montarVagas({ ...base, dias: 3 }, agenda, 'm1', agora)
    expect(v.map((x) => new Date(x.quando).getDate())).toEqual([2, 4])
  })

  it('por semana espalha os dias e dias da semana só usa os escolhidos', () => {
    const tres = montarVagas({ ...base, dias: 14, ritmo: { tipo: 'por_semana', n: 3 } }, [], 'm1', agora)
    expect(tres).toHaveLength(6)
    const dias = montarVagas({ ...base, dias: 14, ritmo: { tipo: 'dias', dias: [1, 3, 5] } }, [], 'm1', agora)
    expect(dias.map((x) => new Date(x.quando).getDay())).toEqual([1, 3, 5, 1, 3, 5])
  })

  it('data especial ganha vaga com o tema, mesmo fora do ritmo', () => {
    const v = montarVagas({ ...base, dias: 7, ritmo: { tipo: 'dias', dias: [1] }, especiais: [{ data: '2026-11-06', tema: 'Black Friday' }] }, [], 'm1', agora)
    expect(v).toHaveLength(2)
    expect(v[1]).toMatchObject({ linha: 'data especial', tema_obrigatorio: 'Black Friday' })
  })

  it('dois por dia usam os dois horários bons; horário fixo vale para todos', () => {
    const dois = montarVagas({ ...base, dias: 1, ritmo: { tipo: 'por_dia', n: 2 } }, [], 'm1', agora)
    expect(dois.map((x) => new Date(x.quando).getHours())).toEqual([12, 19])
    const fixo = montarVagas({ ...base, dias: 2, horario: { modo: 'fixo', hora: '20:30' } }, [], 'm1', agora)
    expect(fixo.map((x) => `${new Date(x.quando).getHours()}:${new Date(x.quando).getMinutes()}`)).toEqual(['20:30', '20:30'])
  })

  it('espalha na proporção e lê datas especiais em texto', () => {
    expect(espalhar(4, [['a', 1], ['b', 1]], 1)).toEqual(['a', 'b', 'a', 'b'])
    expect(espalhar(3, [['a', 0], ['b', 1]], 1)).toEqual(['b', 'b', 'b'])
    expect(lerEspeciais('27/11 Black Friday\nlixo\n05/01 Ano novo', '2026-11-02')).toEqual([
      { data: '2026-11-27', tema: 'Black Friday' },
      { data: '2027-01-05', tema: 'Ano novo' },
    ])
  })
})

describe('plano no servidor', async () => {
  const { limparVagas, textoDasVagas } = await import('../api/_lib/plano')
  it('só aceita vagas no futuro, com formato conhecido, e limpa os textos', () => {
    const agora = Date.parse('2026-10-30T12:00:00Z')
    const v = limparVagas(
      [
        { quando: '2026-11-02T15:00:00Z', formato: 'carrossel', linha: '  receita  ' },
        { quando: '2026-10-01T15:00:00Z', formato: 'foto', linha: 'x' },
        { quando: '2026-11-03T15:00:00Z', formato: 'story', linha: 'x' },
        { quando: '2026-11-27T15:00:00Z', formato: 'reel', tema_obrigatorio: 'Black Friday' },
      ],
      agora,
    )
    expect(v).toEqual([
      { quando: '2026-11-02T15:00:00.000Z', formato: 'carrossel', linha: 'receita' },
      { quando: '2026-11-27T15:00:00.000Z', formato: 'reel', linha: 'livre', tema_obrigatorio: 'Black Friday' },
    ])
    expect(textoDasVagas(v)).toContain('2. sex., 27/11 · reel · linha: livre · TEMA OBRIGATÓRIO: Black Friday')
    expect(limparVagas('nada')).toEqual([])
  })
})
