// Tarefas da Assistente da sua sala: tipos e ajudantes puros (entender o que você digitou, agrupar, prazos).

export interface Tarefa {
  id: string
  /** null = pessoal */
  marca_id: string | null
  titulo: string
  topico: string
  notas: string | null
  /** dia no formato AAAA-MM-DD */
  prazo: string | null
  importante: boolean
  feita_em: string | null
  criado_em: string
}

export interface MarcaDaTarefa {
  id: string
  nome: string
  cor: string
}

export const TOPICO_PADRAO = 'Geral'
/** sugestões de tópico quando você ainda não criou os seus */
export const TOPICOS_SUGERIDOS = ['Geral', 'Conteúdo', 'Reuniões', 'Financeiro', 'Estratégia', 'Admin', 'Casa', 'Saúde']
export const COR_PESSOAL = '#f2b233'

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Dia local no formato AAAA-MM-DD. */
export const diaIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const deIso = (s: string) => {
  const [a, m, d] = s.split('-').map(Number)
  return new Date(a, m - 1, d)
}
const somarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

const SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
const SEMANA_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export interface Entendido {
  titulo: string
  /** undefined = não achou marca no texto */
  marcaId?: string
  topico?: string
  prazo?: string
  importante: boolean
}

/**
 * A Assistente lê o que você anotou e separa sozinha:
 * "Drinfy: gravar reels amanhã #conteúdo !" → marca Drinfy, tópico Conteúdo, prazo amanhã, importante.
 * Marca: "@Nome", "Nome:" no começo ou o nome solto no texto. Prazo: hoje, amanhã, depois de amanhã, dia da semana ou dd/mm.
 */
export function entenderTexto(texto: string, marcas: { id: string; nome: string }[], hoje = new Date()): Entendido {
  let t = ` ${texto.trim()} `
  const r: Entendido = { titulo: '', importante: false }

  // tópico: #palavra (aceita acento e hífen)
  t = t.replace(/\s#([\p{L}\p{N}_-]+)/u, (_, p: string) => {
    const nome = p.replace(/[_-]+/g, ' ')
    r.topico = nome.charAt(0).toUpperCase() + nome.slice(1)
    return ' '
  })

  // importante: "!" solto ou "urgente"
  t = t.replace(/\s!+(?=\s)/g, () => {
    r.importante = true
    return ' '
  })
  if (/\surgente\s/i.test(t)) r.importante = true

  // marca: a de nome mais comprido primeiro, para "Drinfy Pro" ganhar de "Drinfy"
  for (const m of [...marcas].sort((a, b) => b.nome.length - a.nome.length)) {
    const nome = escapar(m.nome.trim())
    if (!nome) continue
    const arroba = new RegExp(`\\s@${nome}(?=[\\s:,.;!?]|$)[:,]?`, 'iu')
    const prefixo = new RegExp(`^\\s${nome}\\s*[:\\-–]\\s`, 'iu')
    if (arroba.test(t)) {
      t = t.replace(arroba, ' ')
      r.marcaId = m.id
      break
    }
    if (prefixo.test(t)) {
      t = t.replace(prefixo, ' ')
      r.marcaId = m.id
      break
    }
    if (new RegExp(`(^|[^\\p{L}\\p{N}])${escapar(semAcento(m.nome.trim()))}(?=[^\\p{L}\\p{N}]|$)`, 'u').test(semAcento(t))) {
      r.marcaId = m.id
      break
    }
  }

  // prazo (com a preposição que vier antes: "até amanhã", "na sexta", "para 12/11")
  const prep = '(?:\\s(?:ate|até|para|pra|na|no|em|dia))?'
  const tirar = (re: RegExp, dia: (m: RegExpMatchArray) => Date | null) => {
    if (r.prazo) return
    const m = t.match(re)
    if (!m) return
    const d = dia(m)
    if (!d || Number.isNaN(d.getTime())) return
    r.prazo = diaIso(d)
    t = t.replace(re, ' ')
  }
  tirar(new RegExp(`${prep}\\sdepois de amanh[aã](?=\\s)`, 'iu'), () => somarDias(hoje, 2))
  tirar(new RegExp(`${prep}\\samanh[aã](?=\\s)`, 'iu'), () => somarDias(hoje, 1))
  tirar(new RegExp(`${prep}\\shoje(?=\\s)`, 'iu'), () => hoje)
  tirar(new RegExp(`${prep}\\s(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?(?=\\s)`, 'iu'), (m) => {
    const dia = Number(m[1])
    const mes = Number(m[2]) - 1
    if (dia < 1 || dia > 31 || mes < 0 || mes > 11) return null
    let ano = m[3] ? Number(m[3]) : hoje.getFullYear()
    if (ano < 100) ano += 2000
    const d = new Date(ano, mes, dia)
    // sem ano e já passou: é o do ano que vem
    if (!m[3] && d < somarDias(hoje, -1)) d.setFullYear(ano + 1)
    return d
  })
  tirar(new RegExp(`${prep}\\s(domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)(?:-feira)?(?=\\s)`, 'iu'), (m) => {
    const alvo = SEMANA.indexOf(semAcento(m[1]))
    const falta = (alvo - hoje.getDay() + 7) % 7 || 7
    return somarDias(hoje, falta)
  })

  r.titulo = t.replace(/\s+/g, ' ').trim().replace(/^[-–:,]\s*/, '')
  if (r.titulo) r.titulo = r.titulo.charAt(0).toUpperCase() + r.titulo.slice(1)
  return r
}

export type SituacaoPrazo = 'atrasada' | 'hoje' | 'amanha' | 'semana' | 'depois'

export function situacaoDoPrazo(prazo: string, hoje = new Date()): SituacaoPrazo {
  const dias = Math.round((deIso(prazo).getTime() - deIso(diaIso(hoje)).getTime()) / 86_400_000)
  if (dias < 0) return 'atrasada'
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanha'
  return dias < 7 ? 'semana' : 'depois'
}

/** "Hoje", "Amanhã", "sex" (nesta semana) ou "12 nov". */
export function textoDoPrazo(prazo: string, hoje = new Date()): string {
  const s = situacaoDoPrazo(prazo, hoje)
  const d = deIso(prazo)
  if (s === 'hoje') return 'Hoje'
  if (s === 'amanha') return 'Amanhã'
  if (s === 'semana') return SEMANA_CURTA[d.getDay()]
  return `${d.getDate()} ${MESES_CURTOS[d.getMonth()]}${d.getFullYear() !== hoje.getFullYear() ? ` ${d.getFullYear()}` : ''}`
}

/** Abertas primeiro (importantes, depois pelo prazo mais perto, depois as mais novas); feitas no fim, da mais recente. */
export function ordenar(lista: Tarefa[]): Tarefa[] {
  return [...lista].sort((a, b) => {
    if (!!a.feita_em !== !!b.feita_em) return a.feita_em ? 1 : -1
    if (a.feita_em && b.feita_em) return b.feita_em.localeCompare(a.feita_em)
    if (a.importante !== b.importante) return a.importante ? -1 : 1
    if (a.prazo !== b.prazo) return !a.prazo ? 1 : !b.prazo ? -1 : a.prazo.localeCompare(b.prazo)
    return b.criado_em.localeCompare(a.criado_em)
  })
}

export interface Grupo {
  chave: string
  nome: string
  cor: string
  tarefas: Tarefa[]
}

const COR_TOPICOS = ['#2a5288', '#3f7650', '#b0447a', '#c46a2b', '#6d4f8f', '#2f7d7a', '#976822', '#52738a']
/** cor fixa para cada tópico, para o mesmo tópico ter sempre a mesma cor */
export function corDoTopico(topico: string): string {
  let h = 0
  for (const c of semAcento(topico)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COR_TOPICOS[h % COR_TOPICOS.length]
}

/** Separa por marca (Pessoal primeiro, depois as marcas na ordem do andar) ou por tópico (em ordem alfabética). */
export function agrupar(lista: Tarefa[], modo: 'marca' | 'topico', marcas: MarcaDaTarefa[]): Grupo[] {
  const grupos = new Map<string, Grupo>()
  if (modo === 'marca') {
    for (const t of lista) {
      const m = t.marca_id ? marcas.find((x) => x.id === t.marca_id) : null
      const chave = m ? m.id : 'pessoal'
      if (!grupos.has(chave)) grupos.set(chave, { chave, nome: m ? m.nome : 'Pessoal', cor: m ? m.cor : COR_PESSOAL, tarefas: [] })
      grupos.get(chave)!.tarefas.push(t)
    }
    const ordem = ['pessoal', ...marcas.map((m) => m.id)]
    return [...grupos.values()].map((g) => ({ ...g, tarefas: ordenar(g.tarefas) })).sort((a, b) => ordem.indexOf(a.chave) - ordem.indexOf(b.chave))
  }
  for (const t of lista) {
    const nome = t.topico || TOPICO_PADRAO
    const chave = semAcento(nome)
    if (!grupos.has(chave)) grupos.set(chave, { chave, nome, cor: corDoTopico(nome), tarefas: [] })
    grupos.get(chave)!.tarefas.push(t)
  }
  return [...grupos.values()].map((g) => ({ ...g, tarefas: ordenar(g.tarefas) })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Tópicos que você já usa, mais os sugeridos, sem repetir. */
export function topicosConhecidos(lista: Tarefa[]): string[] {
  const vistos = new Map<string, string>()
  for (const n of [...lista.map((t) => t.topico), ...TOPICOS_SUGERIDOS]) if (n && !vistos.has(semAcento(n))) vistos.set(semAcento(n), n)
  return [...vistos.values()]
}

/** O que a Assistente fala no balão: atrasadas e de hoje. */
export function resumoParaHoje(lista: Tarefa[], hoje = new Date()) {
  let atrasadas = 0
  let paraHoje = 0
  let abertas = 0
  for (const t of lista) {
    if (t.feita_em) continue
    abertas++
    if (!t.prazo) continue
    const s = situacaoDoPrazo(t.prazo, hoje)
    if (s === 'atrasada') atrasadas++
    else if (s === 'hoje') paraHoje++
  }
  return { abertas, atrasadas, paraHoje }
}
