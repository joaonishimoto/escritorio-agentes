// Números e tempos do jeito que aparecem nos painéis.

/** 75 → "1 min 15 s"; 4000 → "1 h 06 min" */
export function duracao(seg: number) {
  const s = Math.round(seg)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min${s % 60 ? ` ${String(s % 60).padStart(2, '0')} s` : ''}`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

export const dolar = (v: number) => `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
