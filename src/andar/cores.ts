// Cores do andar: um padrão único para todas as salas. A cor de cada sala (a da marca, a da equipe,
// a sua e a do Financeiro) só aparece no tapete e no que fica pendurado na parede.
export const PADRAO = {
  piso: '#ece3d3',
  parede: '#ffffff',
  rodape: '#c9ccd6',
  /** sofás e cadeiras: grafite, para não brigar com a cor das salas */
  estofado: '#5b6270',
  mesa: '#ffffff',
}

/** Cor da equipe (e das salas por especialidade). */
export const COR_EQUIPE = '#2a5288'
/** Cor da sua sala e do Financeiro, as mesmas dos botões da barra. */
export const COR_VOCE = '#f2b233'
export const COR_FINANCEIRO = '#3f7650'

export const misturar = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
