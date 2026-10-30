// Plano editorial do Social Media: das escolhas do dono (período, ritmo, mix de formatos, linhas) para as vagas do calendário.
// As vagas saem aqui, no fuso do navegador; o Social Media só preenche o tema de cada uma.
import { horariosBons, type NaAgenda } from './agenda'
import { chaveDia } from './datas'

export type FormatoPlano = 'carrossel' | 'foto' | 'reel'
export const FORMATOS: FormatoPlano[] = ['carrossel', 'foto', 'reel']

export type Ritmo = { tipo: 'por_dia'; n: number } | { tipo: 'por_semana'; n: number } | { tipo: 'dias'; dias: number[] }

export interface ConfigPlano {
  /** primeiro dia, YYYY-MM-DD */
  inicio: string
  /** duração em dias */
  dias: number
  ritmo: Ritmo
  /** peso de cada formato (em %, mas só a proporção importa) */
  mix: Record<FormatoPlano, number>
  linhas: string[]
  /** datas com tema obrigatório (YYYY-MM-DD) */
  especiais: { data: string; tema: string }[]
  horario: { modo: 'bons' } | { modo: 'fixo'; hora: string }
  /** US$ para o plano inteiro; null = só os tetos da sala */
  teto_usd: number | null
}

export interface VagaNova {
  quando: string
  formato: FormatoPlano
  linha: string
  tema_obrigatorio?: string
}

/** Mais vagas que isso num plano só vira produção demais para revisar. */
export const MAX_VAGAS = 93

// custo médio real dos posts do app (US$), com a copy já incluída; o Reel tem pouca amostra
export const CUSTO_POR_FORMATO: Record<FormatoPlano, number> = { carrossel: 0.83, foto: 0.39, reel: 1.3 }

const doCampo = (s: string) => {
  const [a, m, d] = s.split('-').map(Number)
  return new Date(a, m - 1, d)
}
export const paraDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Quantos posts cada dia do plano recebe, antes de olhar o que já está agendado. */
function postsNoDia(ritmo: Ritmo, indice: number, dia: Date): number {
  if (ritmo.tipo === 'por_dia') return Math.max(1, Math.min(3, Math.round(ritmo.n)))
  if (ritmo.tipo === 'dias') return ritmo.dias.includes(dia.getDay()) ? 1 : 0
  // n por semana, espalhados nos 7 dias de cada bloco a partir do início
  const n = Math.max(1, Math.min(7, Math.round(ritmo.n)))
  const noBloco = indice % 7
  return Array.from({ length: n }, (_, i) => Math.floor((i * 7) / n)).includes(noBloco) ? 1 : 0
}

function horarios(cfg: ConfigPlano, dia: Date, n: number): Date[] {
  const em = (h: number, m: number) => new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m)
  if (cfg.horario.modo === 'fixo') {
    const [h, m] = cfg.horario.hora.split(':').map(Number)
    // mais de um por dia no horário fixo: os outros saem de 3 em 3 horas antes
    return Array.from({ length: n }, (_, i) => em((h || 0) - 3 * (n - 1 - i), m || 0))
  }
  const bons = horariosBons(dia).map(([h, m]) => em(h, m))
  return n <= bons.length ? bons.slice(0, n) : [em(9, 0), ...bons].slice(0, n)
}

/**
 * Ordem dos itens com cada um na proporção do peso e espalhados: a cada vaga entra o que está mais atrasado
 * em relação à sua cota, sem passar de `maxSeguidos` iguais em sequência quando há outra opção.
 */
export function espalhar<K extends string>(n: number, pesos: [K, number][], maxSeguidos: number): K[] {
  const validos = pesos.filter(([, p]) => p > 0)
  if (!validos.length || n <= 0) return []
  const total = validos.reduce((s, [, p]) => s + p, 0)
  const usados = new Map<K, number>()
  const saida: K[] = []
  for (let i = 0; i < n; i++) {
    const seguidos = (k: K) => {
      let c = 0
      for (let j = saida.length - 1; j >= 0 && saida[j] === k; j--) c++
      return c
    }
    const ordem = [...validos].sort((a, b) => b[1] / total * (i + 1) - (usados.get(b[0]) ?? 0) - (a[1] / total * (i + 1) - (usados.get(a[0]) ?? 0)))
    const k = (ordem.find(([o]) => seguidos(o) < maxSeguidos) ?? ordem[0])[0]
    saida.push(k)
    usados.set(k, (usados.get(k) ?? 0) + 1)
  }
  return saida
}

/** As vagas do plano: dias e horários, formato e linha de cada uma. Pula dias que a marca já tem post e horários que já passaram. */
export function montarVagas(cfg: ConfigPlano, agenda: NaAgenda[], marcaId: string, agora = new Date()): VagaNova[] {
  const ocupados = new Map<string, number>()
  for (const i of agenda) {
    if ((i.status !== 'agendado' && i.status !== 'publicado') || (i.marcaId && i.marcaId !== marcaId)) continue
    const k = chaveDia(new Date(i.data))
    ocupados.set(k, (ocupados.get(k) ?? 0) + 1)
  }
  const especiais = new Map(cfg.especiais.map((e) => [e.data, e.tema]))
  const inicio = doCampo(cfg.inicio)
  const slots: { quando: Date; tema?: string }[] = []
  for (let i = 0; i < Math.min(cfg.dias, 366) && slots.length < MAX_VAGAS; i++) {
    const dia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i)
    const tema = especiais.get(paraDia(dia))
    const pedidos = Math.max(postsNoDia(cfg.ritmo, i, dia), tema ? 1 : 0)
    const n = Math.max(0, pedidos - (ocupados.get(chaveDia(dia)) ?? 0))
    const livres = horarios(cfg, dia, n).filter((d) => d.getTime() > agora.getTime() + 30 * 60_000)
    livres.forEach((quando, j) => slots.push({ quando, tema: j === 0 ? tema : undefined }))
  }
  const vagas = slots.slice(0, MAX_VAGAS)
  const formatos = espalhar(vagas.length, FORMATOS.map((f) => [f, cfg.mix[f] ?? 0] as [FormatoPlano, number]), 2)
  const linhas = cfg.linhas.length ? espalhar(vagas.length, cfg.linhas.map((l) => [l, 1] as [string, number]), cfg.linhas.length > 1 ? 1 : vagas.length) : []
  return vagas.map((v, i) => ({
    quando: v.quando.toISOString(),
    formato: formatos[i] ?? 'carrossel',
    linha: v.tema ? 'data especial' : (linhas[i] ?? 'livre'),
    ...(v.tema ? { tema_obrigatorio: v.tema } : {}),
  }))
}

/** Quantos de cada formato e o custo estimado do plano (faixa: média e média + 25% de ajustes). */
export function resumoDoPlano(vagas: Pick<VagaNova, 'formato'>[]) {
  const conta: Record<FormatoPlano, number> = { carrossel: 0, foto: 0, reel: 0 }
  for (const v of vagas) conta[v.formato]++
  const base = FORMATOS.reduce((s, f) => s + conta[f] * CUSTO_POR_FORMATO[f], 0)
  return { conta, minimo: base, maximo: base * 1.25 }
}

/** "25/11 Black Friday" por linha → datas especiais do plano, no ano do início (ou no seguinte, se já passou). */
export function lerEspeciais(texto: string, inicio: string): { data: string; tema: string }[] {
  const ano = Number(inicio.slice(0, 4))
  const comeco = doCampo(inicio)
  return texto
    .split('\n')
    .map((l) => l.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s+(.+)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => {
      let d = new Date(m[3] ? Number(m[3]) : ano, Number(m[2]) - 1, Number(m[1]))
      if (!m[3] && d < comeco) d = new Date(ano + 1, Number(m[2]) - 1, Number(m[1]))
      return { data: paraDia(d), tema: m[4].trim().slice(0, 120) }
    })
}
