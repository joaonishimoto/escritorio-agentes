// Calendário editorial: horários bons e livres, e posts da mesma marca no mesmo dia.
import { chaveDia } from './datas'

export interface NaAgenda {
  id: string
  data: string
  status: string
  marcaId?: string
}

/** Horários que costumam funcionar no Instagram: almoço e começo da noite; no fim de semana, mais cedo. */
export function horariosBons(dia: Date): [number, number][] {
  const fds = dia.getDay() === 0 || dia.getDay() === 6
  return fds ? [[11, 0], [18, 0]] : [[12, 0], [19, 0]]
}

const ocupa = (i: NaAgenda) => i.status === 'agendado' || i.status === 'publicado'

/** Os próximos `n` horários bons em dias em que a marca ainda não tem post (um por dia). */
export function horariosLivres(agenda: NaAgenda[], marcaId: string | undefined, agora = new Date(), n = 3, ignorarId?: string): Date[] {
  const ocupados = new Set(agenda.filter((i) => ocupa(i) && i.id !== ignorarId && (!marcaId || !i.marcaId || i.marcaId === marcaId)).map((i) => chaveDia(new Date(i.data))))
  const livres: Date[] = []
  const dia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  for (let k = 0; k < 60 && livres.length < n; k++, dia.setDate(dia.getDate() + 1)) {
    if (ocupados.has(chaveDia(dia))) continue
    const hora = horariosBons(dia)
      .map(([h, m]) => new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m))
      .find((d) => d.getTime() > agora.getTime() + 30 * 60_000)
    if (hora) livres.push(hora)
  }
  return livres
}

/** Outros posts da mesma marca no mesmo dia (agendados ou publicados). */
export function noMesmoDia(agenda: NaAgenda[], marcaId: string | undefined, quando: Date, ignorarId?: string) {
  const k = chaveDia(quando)
  return agenda.filter((i) => ocupa(i) && i.id !== ignorarId && (!marcaId || !i.marcaId || i.marcaId === marcaId) && chaveDia(new Date(i.data)) === k)
}

/** Mesmo dia, outra data: mantém a hora e o minuto. */
export function mudarDia(original: Date, dia: Date) {
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), original.getHours(), original.getMinutes())
}

/** Data no formato do campo datetime-local, no fuso do navegador. */
export function paraCampo(d: Date) {
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export const rotuloHorario = (d: Date) => d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
