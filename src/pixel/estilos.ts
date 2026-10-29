// Estilos das salas: cores, pisos e o que o dono personalizou.
export interface Estilo {
  nome: string
  piso: string
  pisoLinha: string
  parede: string
  paredeDetalhe: string
  rodape: string
  mesa: string
  mesaSombra: string
  cadeira: string
  tapete: string
  tijolo?: boolean
  /** pisos escolhidos pelo dono, por área da sala */
  pisos?: SalaCustom['pisos']
}

export type Piso = 'tabua' | 'xadrez' | 'concreto' | 'carpete' | 'ladrilho'
export const PISOS: { id: Piso; nome: string }[] = [
  { id: 'tabua', nome: 'Tábua' },
  { id: 'xadrez', nome: 'Xadrez' },
  { id: 'concreto', nome: 'Concreto' },
  { id: 'carpete', nome: 'Carpete' },
  { id: 'ladrilho', nome: 'Ladrilho' },
]
export type AreaSala = 'pauta' | 'criacao' | 'publicacao' | 'hall'

/** O que o dono personalizou na sala (fica em marcas.identidade.sala). Vazio = estilo padrão. */
export interface SalaCustom {
  base?: string
  parede?: string
  tijolo?: boolean
  mesa?: string
  cadeira?: string
  tapete?: string
  pisos?: Partial<Record<AreaSala, { cor?: string; padrao?: Piso }>>
}

export const ESTILOS: Record<string, Estilo> = {
  d: { nome: 'Agência moderna', piso: '#e8d5b0', pisoLinha: '#d2ba90', parede: '#f3efe6', paredeDetalhe: '#e3ddd0', rodape: '#2a5288', mesa: '#ffffff', mesaSombra: '#c9ccd6', cadeira: '#2a5288', tapete: '#dce6f5' },
  e: { nome: 'Executivo noturno', piso: '#6b4a32', pisoLinha: '#57392a', parede: '#2c4a3e', paredeDetalhe: '#24403a', rodape: '#c9a45c', mesa: '#8a5a3a', mesaSombra: '#5e3d27', cadeira: '#1a1f1d', tapete: '#8a2f2a' },
  f: { nome: 'Loft criativo', piso: '#cfcac2', pisoLinha: '#bbb4aa', parede: '#b8654a', paredeDetalhe: '#9c513a', rodape: '#3a3a36', mesa: '#fbfaf7', mesaSombra: '#d6d1c7', cadeira: '#2f6f73', tapete: '#f2b233', tijolo: true },
}
export const ORDEM_ESTILOS = ['d', 'e', 'f']

/** A sala da equipe tem estilo fixo: é de todas as marcas. */
export const COR_EQUIPE = '#2a5288'

export const misturar = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** O estilo da sala pintado com a cor da marca: rodapé, cadeiras e tapete. */
export function comCorDaMarca(e: Estilo, cor: string): Estilo {
  if (!/^#[0-9a-f]{6}$/i.test(cor)) return e
  return { ...e, rodape: cor, cadeira: misturar(cor, '#1f2330', 0.25), tapete: misturar(cor, e.piso, 0.72) }
}

export const escurecer = (cor: string, t: number) => misturar(cor, '#1f2330', t)
export const corValida = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)

/** Estilo final da sala: o estilo base, a cor da marca e o que o dono trocou por cima. */
export function estiloDaSala(padrao: string, cor: string, c?: SalaCustom | null): Estilo {
  let e = comCorDaMarca(ESTILOS[c?.base ?? ''] ?? ESTILOS[padrao] ?? ESTILOS.d, cor)
  if (!c) return e
  e = { ...e, pisos: c.pisos }
  if (corValida(c.parede)) e = { ...e, parede: c.parede, paredeDetalhe: escurecer(c.parede, 0.12) }
  if (typeof c.tijolo === 'boolean') e = { ...e, tijolo: c.tijolo }
  if (corValida(c.mesa)) e = { ...e, mesa: c.mesa, mesaSombra: escurecer(c.mesa, 0.22) }
  if (corValida(c.cadeira)) e = { ...e, cadeira: c.cadeira }
  if (corValida(c.tapete)) e = { ...e, tapete: c.tapete }
  return e
}
