// Ajudantes de calendário usados pelo calendário grande e pelo da parede.

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** Dias do mês em semanas de domingo a sábado; `null` preenche o começo e o fim. */
export function diasDoMes(ano: number, mes: number): (Date | null)[] {
  const primeiro = new Date(ano, mes, 1).getDay()
  const total = new Date(ano, mes + 1, 0).getDate()
  const dias: (Date | null)[] = Array(primeiro).fill(null)
  for (let d = 1; d <= total; d++) dias.push(new Date(ano, mes, d))
  while (dias.length % 7) dias.push(null)
  return dias
}
