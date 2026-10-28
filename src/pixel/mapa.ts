// Planta do andar em pixel art (1 unidade = 1 pixel antes da escala) e o desenho do cenário parado.
import type { AgenteId } from '../agents/catalogo'

export const T = 16
export const SALA_W = 320 // 20 blocos: três departamentos e o hall
export const PASSO_SALA = 336 // sala + parede de 1 bloco
export const PAREDE_H = 34 // faixa da parede do fundo
export const SALA_H = 240
export const CORREDOR_Y = 240
export const CORREDOR_H = 26
export const ANDAR_H = CORREDOR_Y + CORREDOR_H
export const VOCE_W = 160
export const PORTA_X = 160 // porta principal de cada sala, que dá no corredor
export const CORREDOR_PES = CORREDOR_Y + 14

// ───────── planta da sala: três departamentos em cima, hall embaixo ─────────

export interface Depto {
  id: 'pauta' | 'criacao' | 'publicacao'
  nome: string
  x: number
  w: number
  /** centro da porta que dá no hall */
  porta: number
}
export const DEPTOS: Depto[] = [
  { id: 'pauta', nome: 'Pauta', x: 0, w: 104, porta: 52 },
  { id: 'criacao', nome: 'Criação', x: 108, w: 104, porta: 160 },
  { id: 'publicacao', nome: 'Publicação', x: 216, w: 104, porta: 268 },
]
export const PAREDE_DEPTO_Y = 152 // parede entre os departamentos e o hall
export const LINHA_DEPTO = 144 // onde se anda dentro do departamento, na frente das mesas
export const LINHA_HALL = 174 // onde se anda no hall
export const CAFE = { x: 262, y: 188 }
/** Cofrinho do hall: clicar mostra quanto a sala está gastando. */
export const COFRINHO = { x: 222, y: 190, w: 24, h: 22 }
/** Gaveta de posts do hall: cômoda com uma gaveta aberta cheia de pastas. */
export const GAVETA = { x: 258, y: 184, w: 30, h: 28 }
/** Kit de decoração do hall (mostruário de cores e lata de tinta): clicar abre a edição da sala. */
export const DECORAR = { x: 50, y: 186, w: 30, h: 28 }

/** Mesas (canto de cima à esquerda). O boneco senta embaixo, de costas para nós. */
export const MESAS: Record<AgenteId, { x: number; y: number }> = {
  chefe: { x: 10, y: 54 },
  pesquisador: { x: 62, y: 54 },
  curador: { x: 36, y: 104 },
  redator: { x: 118, y: 54 },
  designer: { x: 170, y: 54 },
  cinegrafista: { x: 118, y: 104 },
  narrador: { x: 170, y: 104 },
  revisor: { x: 226, y: 54 },
  publicador: { x: 278, y: 54 },
}
export const MESA_W = 30

/** Quadros da parede que abrem algo ao clicar: referências e calendário (Pauta), branding (Criação) e regras (Revisão). */
export const QUADROS = {
  referencias: { x: 6, y: 3, w: 42, h: 28 },
  calendario: { x: 58, y: 5, w: 38, h: 26 },
  branding: { x: 138, y: 3, w: 44, h: 28 },
  regras: { x: 246, y: 3, w: 44, h: 28 },
} as const
export type Quadro = keyof typeof QUADROS

/** Onde ficam os pés do boneco sentado. */
export const assento = (m: { x: number; y: number }) => ({ x: m.x + MESA_W / 2, y: m.y + 27 })
export const deptoDe = (m: { x: number }) => DEPTOS.find((d) => m.x >= d.x && m.x < d.x + d.w) ?? DEPTOS[0]

type P = [number, number]
/** Em pé ao lado da cadeira, do lado de fora (longe da mesa do meio do departamento). */
export function aoLadoDe(m: { x: number; y: number }): P {
  const a = assento(m)
  return [a.x < deptoDe(m).porta ? a.x - 13 : a.x + 13, a.y]
}
/** Da cadeira até o hall, saindo pela porta do departamento (coordenadas da sala). */
export function ateOHall(m: { x: number; y: number }): P[] {
  const a = assento(m)
  const d = deptoDe(m)
  return [[a.x, a.y], [a.x, LINHA_DEPTO], [d.porta, LINHA_DEPTO], [d.porta, LINHA_HALL]]
}
/** Do hall até ficar ao lado de quem recebe. */
export function doHallAte(m: { x: number; y: number }): P[] {
  const d = deptoDe(m)
  const [lx, ly] = aoLadoDe(m)
  return [[d.porta, LINHA_HALL], [d.porta, LINHA_DEPTO], [lx, LINHA_DEPTO], [lx, ly]]
}
/** Caminho dentro da mesma sala, de uma cadeira até o lado de outra. */
export function dentroDaSala(de: { x: number; y: number }, para: { x: number; y: number }): P[] {
  if (deptoDe(de) === deptoDe(para)) {
    const a = assento(de)
    const [lx, ly] = aoLadoDe(para)
    return [[a.x, a.y], [a.x, LINHA_DEPTO], [lx, LINHA_DEPTO], [lx, ly]]
  }
  return [...ateOHall(de), ...doHallAte(para)]
}

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

/** Onde fica a placa com o nome da marca na parede (o texto é HTML por cima, para ficar nítido). */
export const PLACA = { x: 160, y: 192 }

const misturar = (a: string, b: string, t: number) => {
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

const escurecer = (cor: string, t: number) => misturar(cor, '#1f2330', t)
const corValida = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)

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

const VOCE: Estilo = { nome: 'Sua sala', piso: '#9a6a43', pisoLinha: '#6e4a2e', parede: '#1e3d66', paredeDetalhe: '#1a3559', rodape: '#b88a3a', mesa: '#5a3a24', mesaSombra: '#3d2817', cadeira: '#7a3b2a', tapete: '#7a2e2e' }

/** Sua mesa, na sua sala (coordenadas locais). Você senta atrás dela, de frente para nós. */
export const MESA_VOCE = { x: 64, y: 78, w: 34 }
export const CALENDARIO = { x: 18, y: 6, w: 34, h: 24 }

type Ctx = CanvasRenderingContext2D
const r = (g: Ctx, cor: string, x: number, y: number, w: number, h: number) => {
  g.fillStyle = cor
  g.fillRect(Math.round(x), Math.round(y), w, h)
}

/** Piso de uma área, recortado no retângulo dela (nada vaza para a área vizinha). */
function piso(g: Ctx, e: Estilo, x0: number, w: number, y0: number, h: number, tipo: Piso) {
  g.save()
  g.beginPath()
  g.rect(x0, y0, w, h)
  g.clip()
  const base = e.piso
  const linha = e.pisoLinha
  const claro = misturar(base, '#ffffff', 0.14)
  const escuro = misturar(base, linha, 0.5)
  r(g, base, x0, y0, w, h)
  // o desenho segue uma grade única do andar (não começa do zero em cada área), e o ruído depende só da posição:
  // a mesma escolha de piso em áreas vizinhas fica contínua, como um piso só
  const ruido = (a: number, b: number) => (((a * 73856093) ^ (b * 19349663)) >>> 0) % 1000
  const de = (v: number, passo: number) => Math.floor(v / passo) * passo
  if (tipo === 'tabua') {
    for (let y = de(y0, 8); y < y0 + h; y += 8) {
      const f = y / 8
      const desloc = (((f * 29) % 44) + 44) % 44
      for (let x = de(x0 - desloc, 44) + desloc; x < x0 + w; x += 44) {
        const n = ruido(Math.floor(x / 44), f)
        r(g, n % 3 === 0 ? claro : n % 3 === 1 ? base : escuro, x, y, 44, 8)
        r(g, linha, x, y, 1, 8)
        r(g, misturar(base, linha, 0.75), x + 6 + (n % 20), y + 3 + (n % 3), 8 + (n % 6), 1)
      }
      r(g, linha, x0, y, w, 1)
    }
  } else if (tipo === 'xadrez') {
    for (let y = de(y0, 16); y < y0 + h; y += 16)
      for (let x = de(x0, 16); x < x0 + w; x += 16) {
        const par = (x / 16 + y / 16) % 2 === 0
        r(g, par ? linha : base, x, y, 16, 16)
        r(g, par ? misturar(linha, '#ffffff', 0.12) : claro, x, y, 16, 1)
        r(g, par ? misturar(linha, '#1f2330', 0.12) : escuro, x, y + 15, 16, 1)
      }
  } else if (tipo === 'concreto') {
    // placas grandes com juntas e pontinhos de agregado
    for (let y = de(y0, 32); y < y0 + h; y += 32)
      for (let x = de(x0, 32); x < x0 + w; x += 32) {
        r(g, ruido(x / 32, y / 32) % 2 ? base : misturar(base, linha, 0.18), x, y, 32, 32)
        r(g, linha, x, y, 32, 1)
        r(g, linha, x, y, 1, 32)
        r(g, claro, x + 1, y + 1, 31, 1)
      }
    for (let y = de(y0, 4); y < y0 + h; y += 4)
      for (let x = de(x0, 4); x < x0 + w; x += 4) {
        const n = ruido(x, y)
        if (n < 90) r(g, n % 2 ? linha : claro, x + (n % 4), y + ((n >> 2) % 4), 1, 1)
      }
  } else if (tipo === 'carpete') {
    // trama em losango miúdo, contínua de uma área para a outra
    for (let y = de(y0, 4); y < y0 + h; y += 4)
      for (let x = de(x0, 4) + ((y / 4) % 2) * 2; x < x0 + w; x += 4) {
        r(g, linha, x, y + 1, 1, 1)
        r(g, claro, x + 1, y + 2, 1, 1)
      }
  } else {
    // ladrilho: rejunte, brilho em cima e sombra embaixo de cada peça
    for (let y = de(y0, 24); y < y0 + h; y += 24)
      for (let x = de(x0, 24); x < x0 + w; x += 24) {
        if ((x / 24 + y / 24) % 2 === 0) r(g, misturar(base, '#ffffff', 0.08), x, y, 24, 24)
        r(g, linha, x, y, 24, 1)
        r(g, linha, x, y, 1, 24)
        r(g, misturar(base, '#ffffff', 0.3), x + 1, y + 1, 22, 1)
        r(g, misturar(base, '#ffffff', 0.3), x + 1, y + 1, 1, 22)
        r(g, escuro, x + 2, y + 23, 22, 1)
        r(g, misturar(base, '#ffffff', 0.45), x + 4, y + 4, 2, 1)
      }
  }
  g.restore()
}

function parede(g: Ctx, e: Estilo, x0: number, w: number) {
  r(g, e.parede, x0, 0, w, PAREDE_H)
  if (e.tijolo) {
    for (let y = 0; y < PAREDE_H - 4; y += 5) {
      r(g, e.paredeDetalhe, x0, y, w, 1)
      for (let x = x0 + ((y / 5) % 2) * 6; x < x0 + w; x += 12) r(g, e.paredeDetalhe, x, y, 1, 5)
    }
  } else {
    for (let x = x0 + 8; x < x0 + w; x += 16) r(g, e.paredeDetalhe, x, 0, 1, PAREDE_H - 4)
  }
  r(g, e.rodape, x0, PAREDE_H - 4, w, 4)
  r(g, 'rgba(0,0,0,0.12)', x0, PAREDE_H, w, 3)
}

function janela(g: Ctx, x: number, y: number, w: number, noite: boolean) {
  r(g, '#1f2330', x - 1, y - 1, w + 2, 20)
  r(g, noite ? '#f2c27a' : '#bcd6ef', x, y, w, 18)
  r(g, noite ? '#f7d9a6' : '#d9e8f7', x + 2, y + 2, 5, 8)
  r(g, '#1f2330', x + w / 2, y, 1, 18)
  r(g, '#1f2330', x, y + 9, w, 1)
  r(g, '#ffffff', x - 2, y + 18, w + 4, 2)
}

function estante(g: Ctx, x: number, y: number) {
  const livros = ['#2a5288', '#b74e45', '#976822', '#3f7650', '#f2b233', '#52738a']
  r(g, '#1f2330', x - 1, y - 1, 34, 34)
  r(g, '#6b4f36', x, y, 32, 32)
  for (let p = 0; p < 3; p++) {
    r(g, '#3d2c1e', x + 2, y + 2 + p * 10, 28, 8)
    for (let i = 0; i < 6; i++) if ((i + p) % 5 !== 4) r(g, livros[(i + p * 2) % 6], x + 3 + i * 4.5, y + 3 + p * 10 + (i % 2), 3, 7 - (i % 2))
  }
}

export function planta(g: Ctx, x: number, y: number) {
  r(g, '#1f2330', x + 2, y + 9, 10, 8)
  r(g, '#d98f62', x + 3, y + 10, 8, 6)
  r(g, '#1f2330', x, y - 1, 14, 11)
  r(g, '#3f7650', x + 1, y, 12, 9)
  r(g, '#5aa06b', x + 3, y + 1, 4, 3)
  r(g, '#2f5e3e', x + 8, y + 5, 4, 3)
}

/** Câmera no tripé, ao lado da mesa do cinegrafista. */
function tripe(g: Ctx, x: number, y: number) {
  r(g, '#1f2330', x - 1, y - 1, 12, 8)
  r(g, '#2a2d36', x, y, 10, 6)
  r(g, '#9fb3d6', x + 7, y + 2, 2, 2)
  r(g, '#1f2330', x + 4, y + 6, 2, 12)
  r(g, '#1f2330', x, y + 16, 2, 4)
  r(g, '#1f2330', x + 8, y + 16, 2, 4)
}

/** Microfone de estúdio com espuma, num pedestal em cima da mesa do narrador. */
function microfone(g: Ctx, x: number, y: number) {
  r(g, '#1f2330', x - 1, y - 1, 6, 9)
  r(g, '#3a3f4b', x, y, 4, 7)
  r(g, '#5b6272', x + 1, y + 1, 1, 5)
  r(g, '#1f2330', x + 1, y + 8, 2, 5)
  r(g, '#1f2330', x - 2, y + 12, 8, 2)
}

/** Cômoda de madeira; com posts guardados, a gaveta de cima fica aberta mostrando as pastas. */
function gaveteiro(g: Ctx, x: number, y: number, estilo: Estilo, quantos: number) {
  const madeira = estilo.mesa === '#ffffff' ? '#8a6a4a' : estilo.mesa
  const escuro = misturar(madeira, '#000000', 0.3)
  const claro = misturar(madeira, '#ffffff', 0.18)
  r(g, 'rgba(0,0,0,.15)', x + 2, y + 26, 28, 2)
  r(g, '#1f2330', x - 1, y + 3, 32, 24)
  r(g, madeira, x, y + 4, 30, 22)
  r(g, claro, x, y + 4, 30, 2)
  for (let i = 0; i < 3; i++) {
    r(g, escuro, x + 2, y + 8 + i * 6, 26, 1)
    r(g, '#d9b25f', x + 13, y + 10 + i * 6, 4, 1)
  }
  r(g, '#1f2330', x + 2, y + 26, 2, 2)
  r(g, '#1f2330', x + 26, y + 26, 2, 2)
  if (quantos > 0) {
    // gaveta de cima puxada para fora, com pastas coloridas aparecendo
    r(g, '#1f2330', x + 1, y - 2, 28, 9)
    r(g, escuro, x + 2, y - 1, 26, 7)
    const cores = ['#f2b233', '#7fb3e0', '#e07a6f', '#9fd3a8', '#f2a6b8']
    for (let i = 0; i < Math.min(5, quantos); i++) {
      r(g, '#1f2330', x + 4 + i * 5, y - 5 + (i % 2), 4, 6)
      r(g, cores[i % cores.length], x + 4 + i * 5, y - 4 + (i % 2), 3, 5)
    }
    r(g, madeira, x + 1, y + 4, 28, 3)
    r(g, '#d9b25f', x + 13, y + 5, 4, 1)
  }
}

/** Cavalete de pintor com um quadrinho da própria sala, paleta de tintas e pote de pincéis. */
function kitDecorar(g: Ctx, x: number, y: number, estilo: Estilo) {
  const c = '#1f2330'
  const madeira = '#b07a45'
  const madeiraEsc = '#7d5530'
  r(g, 'rgba(0,0,0,.16)', x + 1, y + 26, 28, 2)
  // pernas do cavalete (a de trás no meio, as da frente abrindo)
  r(g, madeiraEsc, x + 14, y + 4, 2, 23)
  for (let k = 0; k < 20; k++) {
    const d = Math.floor(k / 7)
    r(g, c, x + 6 - d - 1, y + 7 + k, 4, 1)
    r(g, madeira, x + 6 - d, y + 7 + k, 2, 1)
    r(g, c, x + 21 + d - 1, y + 7 + k, 4, 1)
    r(g, madeira, x + 21 + d, y + 7 + k, 2, 1)
  }
  // tela com a sala pintada: parede, faixa da marca, piso e uma mesinha
  r(g, c, x + 3, y, 24, 16)
  r(g, '#f7f1e3', x + 4, y + 1, 22, 14)
  r(g, estilo.parede, x + 5, y + 2, 20, 5)
  r(g, misturar(estilo.parede, '#ffffff', 0.35), x + 9, y + 3, 4, 3)
  r(g, estilo.rodape, x + 5, y + 7, 20, 1)
  r(g, estilo.piso, x + 5, y + 8, 20, 6)
  r(g, estilo.pisoLinha, x + 5, y + 10, 20, 1)
  r(g, estilo.mesa === '#ffffff' ? '#e8e8ee' : estilo.mesa, x + 15, y + 9, 6, 2)
  r(g, estilo.tapete, x + 7, y + 11, 6, 2)
  // apoio da tela
  r(g, c, x + 2, y + 16, 26, 3)
  r(g, madeira, x + 3, y + 16, 24, 2)
  // paleta encostada na perna
  r(g, c, x - 1, y + 20, 12, 7)
  r(g, '#e9d3a8', x, y + 21, 10, 5)
  r(g, c, x + 7, y + 23, 2, 2)
  r(g, '#e05a4f', x + 1, y + 22, 2, 1)
  r(g, '#3d77b0', x + 4, y + 21, 2, 1)
  r(g, '#f2b233', x + 1, y + 24, 2, 1)
  r(g, estilo.rodape, x + 4, y + 24, 2, 1)
  // pote de pincéis
  r(g, '#3d77b0', x + 22, y + 15, 1, 6)
  r(g, '#e05a4f', x + 26, y + 16, 1, 5)
  r(g, c, x + 21, y + 19, 8, 8)
  r(g, '#cfe6f2', x + 22, y + 20, 6, 6)
  r(g, '#9fc6ea', x + 22, y + 23, 6, 3)
}

/** Porquinho cor-de-rosa num banquinho, com uma moeda entrando. */
function cofrinho(g: Ctx, x: number, y: number) {
  const contorno = '#1f2330'
  const rosa = '#f2a6b8'
  const sombra = '#d9849a'
  r(g, 'rgba(0,0,0,.15)', x + 2, y + 20, 22, 2)
  // banquinho
  r(g, contorno, x + 3, y + 15, 18, 3)
  r(g, '#8a6a4a', x + 4, y + 16, 16, 1)
  r(g, contorno, x + 5, y + 18, 2, 3)
  r(g, contorno, x + 17, y + 18, 2, 3)
  // corpo
  r(g, contorno, x + 3, y + 5, 16, 10)
  r(g, contorno, x + 2, y + 6, 18, 8)
  r(g, rosa, x + 4, y + 6, 14, 8)
  r(g, rosa, x + 3, y + 7, 16, 6)
  r(g, sombra, x + 4, y + 12, 14, 2)
  r(g, '#f8c6d2', x + 6, y + 7, 4, 1)
  // orelha, focinho, olho, rabinho e patas
  r(g, contorno, x + 13, y + 3, 4, 3)
  r(g, sombra, x + 14, y + 4, 2, 2)
  r(g, contorno, x + 19, y + 8, 3, 5)
  r(g, sombra, x + 19, y + 9, 2, 3)
  r(g, contorno, x + 20, y + 10, 1, 1)
  r(g, contorno, x + 15, y + 8, 1, 1)
  r(g, contorno, x + 1, y + 7, 2, 1)
  r(g, contorno, x, y + 6, 1, 1)
  r(g, contorno, x + 5, y + 14, 3, 1)
  r(g, contorno, x + 14, y + 14, 3, 1)
  // fenda e moeda
  r(g, contorno, x + 8, y + 5, 5, 1)
  r(g, contorno, x + 8, y - 1, 5, 5)
  r(g, '#f2b233', x + 9, y, 3, 4)
  r(g, '#fff3b0', x + 9, y, 1, 2)
}

/** Mesa com monitor (a tela é redesenhada a cada quadro por cima). */
export function mesa(g: Ctx, e: Estilo, x: number, y: number) {
  r(g, 'rgba(0,0,0,.15)', x + 2, y + 14, MESA_W, 3)
  r(g, '#1f2330', x - 1, y - 1, MESA_W + 2, 16)
  r(g, e.mesa, x, y, MESA_W, 11)
  r(g, e.mesaSombra, x, y + 11, MESA_W, 3)
  // monitor
  r(g, '#1f2330', x + 7, y - 9, 16, 12)
  r(g, '#2a2d36', x + 8, y - 8, 14, 9)
  r(g, '#1f2330', x + 14, y + 3, 2, 2)
  // teclado e caneca
  r(g, '#d9dde6', x + 9, y + 6, 12, 3)
  r(g, '#b74e45', x + 24, y + 4, 3, 4)
}

export function cadeira(g: Ctx, e: Estilo, x: number, y: number) {
  r(g, '#1f2330', x - 1, y - 1, 14, 10)
  r(g, e.cadeira, x, y, 12, 8)
}

/** Pisos de cada parte da sala, tirados das cores do estilo e da marca. */
/** Cor e desenho do piso de cada área: o padrão do estilo, ou o que o dono escolheu. */
export function pisos(e: Estilo): Record<AreaSala, { estilo: Estilo; padrao: Piso }> {
  const v = (piso: string, pisoLinha: string) => ({ ...e, piso, pisoLinha })
  const padrao: Record<AreaSala, { estilo: Estilo; padrao: Piso }> = {
    pauta: { estilo: e, padrao: e.tijolo ? 'concreto' : 'tabua' },
    criacao: { estilo: v(misturar(e.piso, e.tapete, 0.55), misturar(e.piso, e.rodape, 0.35)), padrao: 'xadrez' },
    publicacao: { estilo: v(misturar(e.tapete, e.piso, 0.35), misturar(e.tapete, '#1f2330', 0.25)), padrao: 'carpete' },
    hall: { estilo: v(misturar(e.piso, '#ffffff', 0.25), misturar(e.pisoLinha, '#1f2330', 0.1)), padrao: 'ladrilho' },
  }
  for (const area of Object.keys(padrao) as AreaSala[]) {
    const c = e.pisos?.[area]
    if (!c) continue
    if (corValida(c.cor)) padrao[area].estilo = v(c.cor, escurecer(c.cor, 0.14))
    if (c.padrao && PISOS.some((p) => p.id === c.padrao)) padrao[area].padrao = c.padrao
  }
  return padrao
}

function divisoria(g: Ctx, e: Estilo, x: number, y: number, w: number, h: number) {
  r(g, '#1f2330', x, y, w, h)
  if (w > h) r(g, e.paredeDetalhe, x, y + 1, w, h - 3)
  else r(g, e.paredeDetalhe, x + 1, y, w - 2, h)
}

/** Quadro de branding: logo em bloco na cor da marca, paleta e uma amostra de letra. */
function quadroBranding(g: Ctx, e: Estilo, x: number, y: number, w: number, h: number) {
  r(g, '#1f2330', x - 1, y - 1, w + 2, h + 2)
  r(g, '#ffffff', x, y, w, h)
  r(g, e.rodape, x + 3, y + 3, 14, 14)
  r(g, '#ffffff', x + 6, y + 7, 8, 2)
  r(g, '#ffffff', x + 6, y + 11, 5, 2)
  const paleta = [e.rodape, misturar(e.rodape, '#ffffff', 0.5), misturar(e.rodape, '#1f2330', 0.45), e.tapete]
  paleta.forEach((c, i) => r(g, c, x + 20 + i * 5.5, y + 4, 5, 5))
  // "Aa" em pixel
  r(g, '#1f2330', x + 21, y + 12, 2, 6)
  r(g, '#1f2330', x + 25, y + 12, 2, 6)
  r(g, '#1f2330', x + 23, y + 11, 2, 2)
  r(g, '#1f2330', x + 23, y + 14, 2, 1)
  r(g, '#1f2330', x + 30, y + 14, 4, 4)
  r(g, '#ffffff', x + 31, y + 15, 2, 2)
  r(g, '#1f2330', x + 34, y + 14, 1, 4)
  r(g, '#d9dde6', x + 3, y + 21, w - 6, 2)
  r(g, '#d9dde6', x + 3, y + 24, w - 16, 1)
}

/** Painel de referências: fotos presas num quadro, uma por referência da marca (até caber). */
function quadroReferencias(g: Ctx, e: Estilo, x: number, y: number, w: number, h: number, refs: number) {
  r(g, '#1f2330', x - 1, y - 1, w + 2, h + 2)
  r(g, '#eef0f4', x, y, w, h)
  r(g, e.rodape, x, y, w, 2)
  const n = Math.min(refs, 6)
  const tons = [e.rodape, misturar(e.rodape, '#ffffff', 0.45), e.tapete, '#52738a', '#976822', misturar(e.rodape, '#1f2330', 0.4)]
  for (let i = 0; i < Math.max(n, 2); i++) {
    const fx = x + 3 + (i % 3) * 13
    const fy = y + 4 + Math.floor(i / 3) * 12
    const vazia = i >= n
    r(g, 'rgba(0,0,0,.18)', fx + 1, fy + 1, 11, 10)
    r(g, vazia ? '#ffffff' : '#ffffff', fx, fy, 11, 10)
    if (vazia) {
      r(g, '#d9dde6', fx + 2, fy + 2, 7, 5)
      r(g, '#ffffff', fx + 5, fy + 3, 1, 3)
      r(g, '#ffffff', fx + 4, fy + 4, 3, 1)
    } else {
      r(g, tons[i % tons.length], fx + 1, fy + 1, 9, 6)
      r(g, 'rgba(255,255,255,.55)', fx + 2, fy + 5, 3, 2)
      r(g, '#e05a4f', fx + 5, fy - 1, 2, 2)
    }
  }
}

/** Mural de regras: cortiça com um bilhete por regra ativa (até caber). */
function quadroRegras(g: Ctx, x: number, y: number, w: number, h: number, regras: number) {
  r(g, '#1f2330', x - 1, y - 1, w + 2, h + 2)
  r(g, '#b98a5a', x, y, w, h)
  for (let i = 0; i < 18; i++) r(g, '#a77a4c', x + ((i * 7) % (w - 2)) + 1, y + ((i * 5) % (h - 2)) + 1, 2, 1)
  const notas = ['#fff3b0', '#ffd6a5', '#cdeac0', '#bde0fe', '#ffc8dd']
  const n = Math.min(regras, 10)
  for (let i = 0; i < n; i++) {
    const nx = x + 3 + (i % 5) * 8
    const ny = y + 3 + Math.floor(i / 5) * 12
    r(g, notas[i % notas.length], nx, ny, 6, 9)
    r(g, '#e05a4f', nx + 2, ny, 2, 1)
    r(g, 'rgba(0,0,0,.25)', nx + 1, ny + 3, 4, 1)
    r(g, 'rgba(0,0,0,.25)', nx + 1, ny + 5, 3, 1)
  }
  if (!n) {
    r(g, '#ffffff', x + 14, y + 9, 16, 10)
    r(g, '#d9dde6', x + 16, y + 12, 12, 1)
    r(g, '#d9dde6', x + 16, y + 15, 8, 1)
  }
}

/** Mesinha redonda com notebook (canto livre da Revisão e publicação). */
function mesinha(g: Ctx, e: Estilo, x: number, y: number) {
  r(g, 'rgba(0,0,0,.15)', x + 2, y + 12, 26, 3)
  r(g, '#1f2330', x - 1, y - 1, 28, 14)
  r(g, e.mesa, x, y, 26, 10)
  r(g, e.mesaSombra, x, y + 10, 26, 2)
  r(g, '#2a2d36', x + 8, y + 2, 10, 6)
  r(g, '#9fb3d6', x + 9, y + 3, 8, 3)
  r(g, '#f2b233', x + 2, y + 3, 4, 5)
}

/** Desenha uma sala de marca inteira (sem os bonecos): Pauta, Criação e Revisão em cima, hall embaixo. */
export function desenharSala(g: Ctx, x0: number, estilo: Estilo, noite: boolean, quadros: { dias: Set<number>; hoje: number; regras: number; referencias: number; gaveta?: number }) {
  const p = pisos(estilo)
  const topoHall = PAREDE_DEPTO_Y + 6
  piso(g, p.hall.estilo, x0, SALA_W, topoHall, SALA_H - topoHall, p.hall.padrao)
  piso(g, p.pauta.estilo, x0, 104, PAREDE_H, topoHall - PAREDE_H, p.pauta.padrao)
  piso(g, p.criacao.estilo, x0 + 108, 104, PAREDE_H, topoHall - PAREDE_H, p.criacao.padrao)
  piso(g, p.publicacao.estilo, x0 + 216, 104, PAREDE_H, topoHall - PAREDE_H, p.publicacao.padrao)
  parede(g, estilo, x0, SALA_W)

  // parede do fundo: referências e calendário (Pauta), janelas e branding (Criação), mural de regras (Revisão)
  const f = QUADROS.referencias
  quadroReferencias(g, estilo, x0 + f.x, f.y, f.w, f.h, quadros.referencias)
  const c = QUADROS.calendario
  desenharCalendario(g, x0, quadros.dias, quadros.hoje, c)
  janela(g, x0 + 112, 7, 20, noite)
  janela(g, x0 + 188, 7, 20, noite)
  const b = QUADROS.branding
  quadroBranding(g, estilo, x0 + b.x, b.y, b.w, b.h)
  janela(g, x0 + 222, 7, 18, noite)
  janela(g, x0 + 296, 7, 18, noite)
  const q = QUADROS.regras
  quadroRegras(g, x0 + q.x, q.y, q.w, q.h, quadros.regras)

  // divisórias entre os departamentos e a parede do hall, com uma porta em cada
  divisoria(g, estilo, x0 + 104, PAREDE_H, 4, topoHall - PAREDE_H)
  divisoria(g, estilo, x0 + 212, PAREDE_H, 4, topoHall - PAREDE_H)
  let ultimo = 0
  for (const d of DEPTOS) {
    divisoria(g, estilo, x0 + ultimo, PAREDE_DEPTO_Y, d.porta - 15 - ultimo, 6)
    r(g, estilo.rodape, x0 + d.porta - 15, PAREDE_DEPTO_Y + 4, 30, 2)
    ultimo = d.porta + 15
  }
  divisoria(g, estilo, x0 + ultimo, PAREDE_DEPTO_Y, SALA_W - ultimo, 6)

  // mesas
  for (const id of Object.keys(MESAS) as AgenteId[]) {
    const m = MESAS[id]
    mesa(g, estilo, x0 + m.x, m.y)
    cadeira(g, estilo, x0 + m.x + 9, m.y + 17)
  }
  tripe(g, x0 + MESAS.cinegrafista.x + 33, MESAS.cinegrafista.y - 4)
  microfone(g, x0 + MESAS.narrador.x + 2, MESAS.narrador.y - 6)
  mesinha(g, estilo, x0 + 254, 102)

  // hall: tapete da marca no meio (o nome vai por cima), cofrinho e plantas
  r(g, '#1f2330', x0 + 107, 179, 106, 36)
  r(g, estilo.rodape, x0 + 108, 180, 104, 34)
  r(g, misturar(estilo.rodape, '#ffffff', 0.3), x0 + 111, 183, 98, 1)
  r(g, misturar(estilo.rodape, '#ffffff', 0.3), x0 + 111, 210, 98, 1)
  cofrinho(g, x0 + COFRINHO.x, COFRINHO.y)
  kitDecorar(g, x0 + DECORAR.x, DECORAR.y, estilo)
  gaveteiro(g, x0 + GAVETA.x, GAVETA.y, estilo, quadros.gaveta ?? 0)
  planta(g, x0 + 4, 216)
  planta(g, x0 + 302, 216)
  planta(g, x0 + 300, 160)
  // parede de baixo, com a porta principal
  r(g, '#1f2330', x0, SALA_H - 5, PORTA_X - 18, 5)
  r(g, '#1f2330', x0 + PORTA_X + 18, SALA_H - 5, SALA_W - PORTA_X - 18, 5)
  r(g, estilo.rodape, x0 + PORTA_X - 18, SALA_H - 2, 36, 2)
}

/** Sua sala, no fim do corredor. */
export function desenharSuaSala(g: Ctx, x0: number) {
  // escritório executivo: assoalho de madeira escura, lambri, tapete persa, sofá de couro e bar
  piso(g, VOCE, x0, VOCE_W, PAREDE_H, SALA_H - PAREDE_H, 'tabua')
  parede(g, VOCE, x0, VOCE_W)
  lambri(g, x0, VOCE_W, '#4a2f1c')
  janela(g, x0 + 104, 7, 40, false)
  cortina(g, x0 + 100, 4, '#7a2e2e')
  cortina(g, x0 + 144, 4, '#7a2e2e')
  estante(g, x0 + 62, 2)
  tapetePersa(g, x0 + 30, 62, 100, 58, '#7a2e2e', '#d9b25f', '#1e3d66')
  luminariaDePe(g, x0 + 140, 54)
  globo(g, x0 + 132, 126)
  // canto de estar: sofá chesterfield, mesinha de centro e quadro
  mesaDeCentro(g, x0 + 16, 176, 34)
  sofa(g, x0 + 6, 198, 56, '#6b3a22')
  carrinhoBar(g, x0 + 110, 196)
  planta(g, x0 + 4, 138)
  planta(g, x0 + 140, 216)
  r(g, '#1f2330', x0, SALA_H - 5, PORTA_X - 18 - 32, 5)
  r(g, '#1f2330', x0 + 96, SALA_H - 5, VOCE_W - 96, 5)
  r(g, VOCE.rodape, x0 + 62, SALA_H - 2, 34, 2)
}
export const PORTA_VOCE_X = 80

export function desenharCorredor(g: Ctx, largura: number) {
  r(g, '#ddd6c8', 0, CORREDOR_Y, largura, CORREDOR_H)
  for (let x = 0; x < largura; x += 16) r(g, '#d2cab9', x, CORREDOR_Y, 1, CORREDOR_H)
  // corredor estreito: só uma passadeira para quem leva pastas de uma sala a outra
  r(g, '#2a5288', 8, CORREDOR_Y + 6, largura - 16, 14)
  r(g, '#3969a8', 8, CORREDOR_Y + 7, largura - 16, 1)
  r(g, '#3969a8', 8, CORREDOR_Y + 18, largura - 16, 1)
}

export function desenharParedeEntre(g: Ctx, x: number) {
  r(g, '#1f2330', x, 0, 16, SALA_H)
  r(g, '#3a3f4f', x + 2, 0, 12, SALA_H - 2)
}

export function desenharMesaVoce(g: Ctx, x0: number) {
  const { x, y, w } = MESA_VOCE
  // mesa de nogueira com tampo de couro verde, abajur de banqueiro, notebook e bandeja de entrada
  r(g, 'rgba(0,0,0,.2)', x0 + x + 2, y + 16, w, 3)
  r(g, '#1f2330', x0 + x - 1, y - 1, w + 2, 18)
  r(g, '#5a3a24', x0 + x, y, w, 12)
  r(g, '#2f5d47', x0 + x + 2, y + 2, w - 4, 8)
  r(g, '#3d2817', x0 + x, y + 12, w, 4)
  r(g, '#b88a3a', x0 + x + w / 2 - 1, y + 13, 2, 1)
  r(g, '#d9dde6', x0 + x + 4, y + 4, 10, 6) // notebook
  r(g, '#9fb3d6', x0 + x + 5, y + 5, 8, 3)
  r(g, '#1e3d66', x0 + x + 20, y + 3, 10, 6) // bandeja de entrada
  r(g, '#ffffff', x0 + x + 21, y + 4, 8, 2)
  r(g, '#1f2330', x0 + x + w - 4, y - 5, 1, 7) // abajur
  r(g, '#1f2330', x0 + x + w - 8, y - 8, 9, 4)
  r(g, '#2f7a52', x0 + x + w - 7, y - 7, 7, 2)
  r(g, '#f2d27a', x0 + x + w - 6, y - 5, 5, 1)
}

/** Lambri de madeira na base da parede, com friso dourado. */
function lambri(g: Ctx, x0: number, w: number, cor: string) {
  r(g, cor, x0, PAREDE_H - 12, w, 8)
  for (let x = x0 + 4; x < x0 + w; x += 12) r(g, misturar(cor, '#000000', 0.25), x, PAREDE_H - 11, 1, 6)
  r(g, '#d9b25f', x0, PAREDE_H - 13, w, 1)
}

function cortina(g: Ctx, x: number, y: number, cor: string) {
  r(g, '#1f2330', x - 1, y - 1, 6, 26)
  r(g, cor, x, y, 4, 24)
  r(g, misturar(cor, '#000000', 0.3), x + 2, y, 1, 24)
  r(g, '#d9b25f', x - 1, y + 14, 6, 1)
}

/** Tapete persa: borda dourada, campo vinho e um medalhão no meio. */
function tapetePersa(g: Ctx, x: number, y: number, w: number, h: number, campo: string, borda: string, detalhe: string) {
  r(g, 'rgba(0,0,0,.15)', x + 1, y + 1, w, h)
  r(g, borda, x, y, w, h)
  r(g, campo, x + 3, y + 3, w - 6, h - 6)
  const pontilhado = misturar(borda, '#ffffff', 0.25)
  for (let i = x + 4; i < x + w - 4; i += 4) {
    r(g, pontilhado, i, y + 1, 2, 1)
    r(g, pontilhado, i, y + h - 2, 2, 1)
  }
  r(g, borda, x + 6, y + 6, w - 12, 1)
  r(g, borda, x + 6, y + h - 7, w - 12, 1)
  const cx = x + w / 2
  const cy = y + h / 2
  for (let k = 0; k < 7; k++) r(g, k % 2 ? borda : detalhe, cx - 14 + k * 2, cy - 7 + Math.abs(3 - k), 28 - k * 4 > 0 ? 28 - k * 4 : 2, 14 - Math.abs(3 - k) * 2)
  r(g, borda, cx - 2, cy - 2, 4, 4)
  for (const [a, b] of [[x + 10, y + 10], [x + w - 14, y + 10], [x + 10, y + h - 14], [x + w - 14, y + h - 14]]) {
    r(g, detalhe, a, b, 4, 4)
    r(g, borda, a + 1, b + 1, 2, 2)
  }
  // franjas
  for (let i = x + 2; i < x + w - 2; i += 3) {
    r(g, '#efe3c4', i, y - 2, 1, 2)
    r(g, '#efe3c4', i, y + h, 1, 2)
  }
}

function luminariaDePe(g: Ctx, x: number, y: number) {
  r(g, 'rgba(0,0,0,.15)', x - 3, y + 30, 10, 2)
  r(g, '#1f2330', x - 4, y - 1, 12, 9)
  r(g, '#efe3c4', x - 3, y, 10, 7)
  r(g, '#fff6d8', x - 2, y + 1, 4, 2)
  r(g, '#b88a3a', x + 1, y + 8, 2, 21)
  r(g, '#1f2330', x - 2, y + 29, 8, 2)
}

function globo(g: Ctx, x: number, y: number) {
  r(g, 'rgba(0,0,0,.15)', x, y + 22, 14, 2)
  r(g, '#1f2330', x + 1, y - 1, 12, 14)
  r(g, '#3d77b0', x + 2, y, 10, 12)
  r(g, '#5aa06b', x + 3, y + 2, 4, 3)
  r(g, '#5aa06b', x + 7, y + 6, 3, 4)
  r(g, '#9fc6ea', x + 3, y + 1, 2, 1)
  r(g, '#b88a3a', x, y + 4, 1, 6)
  r(g, '#b88a3a', x + 6, y + 12, 2, 6)
  r(g, '#1f2330', x + 3, y + 18, 8, 3)
  r(g, '#5a3a24', x + 4, y + 18, 6, 2)
}

/** Sofá chesterfield de couro, visto de frente (encosto em cima). */
function sofa(g: Ctx, x: number, y: number, w: number, cor: string) {
  const claro = misturar(cor, '#ffffff', 0.18)
  const escuro = misturar(cor, '#000000', 0.3)
  r(g, 'rgba(0,0,0,.18)', x + 2, y + 20, w, 3)
  r(g, '#1f2330', x - 1, y - 1, w + 2, 22)
  r(g, cor, x, y, w, 20)
  r(g, escuro, x, y + 8, w, 1)
  for (let i = x + 4; i < x + w - 3; i += 6) {
    r(g, escuro, i, y + 3, 1, 1)
    r(g, claro, i + 1, y + 2, 1, 1)
  }
  r(g, claro, x + 5, y + 10, w / 2 - 6, 6)
  r(g, claro, x + w / 2 + 1, y + 10, w / 2 - 6, 6)
  r(g, escuro, x, y, 4, 20)
  r(g, escuro, x + w - 4, y, 4, 20)
  r(g, '#1f2330', x + 2, y + 20, 2, 2)
  r(g, '#1f2330', x + w - 4, y + 20, 2, 2)
}

function mesaDeCentro(g: Ctx, x: number, y: number, w: number) {
  r(g, 'rgba(0,0,0,.15)', x + 2, y + 10, w, 2)
  r(g, '#1f2330', x - 1, y - 1, w + 2, 11)
  r(g, '#5a3a24', x, y, w, 7)
  r(g, '#3d2817', x, y + 7, w, 2)
  r(g, '#d9dde6', x + 4, y + 2, 8, 4) // revistas
  r(g, '#b74e45', x + 5, y + 3, 6, 1)
  r(g, '#ffffff', x + w - 10, y + 1, 4, 4) // xícara
  r(g, '#6b4f36', x + w - 9, y + 2, 2, 2)
}

/** Carrinho de bar dourado com garrafas e copos. */
function carrinhoBar(g: Ctx, x: number, y: number) {
  r(g, 'rgba(0,0,0,.15)', x + 1, y + 20, 26, 2)
  r(g, '#b88a3a', x, y + 6, 26, 2)
  r(g, '#b88a3a', x, y + 16, 26, 2)
  r(g, '#b88a3a', x, y + 6, 2, 14)
  r(g, '#b88a3a', x + 24, y + 6, 2, 14)
  const garrafas = ['#3f7650', '#976822', '#7a2e2e']
  garrafas.forEach((c, i) => {
    r(g, '#1f2330', x + 3 + i * 6, y - 3, 5, 9)
    r(g, c, x + 4 + i * 6, y - 1, 3, 7)
    r(g, c, x + 5 + i * 6, y - 4, 1, 3)
  })
  r(g, '#cfe6f2', x + 21, y + 2, 3, 4)
  r(g, '#cfe6f2', x + 6, y + 12, 3, 4)
  r(g, '#cfe6f2', x + 11, y + 12, 3, 4)
  r(g, '#1f2330', x + 1, y + 20, 3, 3)
  r(g, '#1f2330', x + 22, y + 20, 3, 3)
}

export function desenharCalendario(g: Ctx, x0: number, marcados: Set<number>, hoje: number, q: { x: number; y: number; w: number; h: number } = CALENDARIO) {
  const { x, y, w, h } = q
  r(g, '#1f2330', x0 + x - 1, y - 1, w + 2, h + 2)
  r(g, '#ffffff', x0 + x, y, w, h)
  r(g, '#b74e45', x0 + x, y, w, 5)
  const passoX = (w - 4) / 7
  const passoY = (h - 8) / 5
  for (let d = 1; d <= 31; d++) {
    const c = (d - 1) % 7
    const l = Math.floor((d - 1) / 7)
    const cor = d === hoje ? '#1e3d66' : marcados.has(d) ? '#f2b233' : '#d9dde6'
    r(g, cor, x0 + x + 2 + c * passoX, y + 7 + l * passoY, Math.max(3, passoX - 1.4), Math.max(2, passoY - 1.4))
  }
}

// ───────── sala do Financeiro, depois da sua sala ─────────

export const FIN_W = 128
const FIN: Estilo = { nome: 'Financeiro', piso: '#e9e6df', pisoLinha: '#c9c3b6', parede: '#2f5d47', paredeDetalhe: '#28503d', rodape: '#3f7650', mesa: '#ffffff', mesaSombra: '#c9ccd6', cadeira: '#3f7650', tapete: '#cfe0d2' }
/** Mesa do Financeiro (ele senta atrás, de frente para nós) e o gráfico na parede, que abre o painel. */
export const MESA_FIN = { x: 46, y: 82, w: 36 }
export const GRAFICO_FIN = { x: 40, y: 3, w: 48, h: 28 }
export const PORTA_FIN_X = 64

/** O gráfico da parede: barras dos gastos dos últimos dias (redesenhado quando os números chegam). */
export function desenharGraficoFin(g: Ctx, x0: number, barras: number[], alerta: boolean) {
  const { x, y, w, h } = GRAFICO_FIN
  r(g, '#1f2330', x0 + x - 1, y - 1, w + 2, h + 2)
  r(g, '#fbfaf6', x0 + x, y, w, h)
  r(g, alerta ? '#b74e45' : '#3f7650', x0 + x, y, w, 4)
  const n = Math.max(1, barras.length)
  const max = Math.max(...barras, 0.0001)
  const larg = Math.max(1, Math.floor((w - 6) / n) - 1)
  barras.forEach((v, i) => {
    const alt = Math.max(1, Math.round((v / max) * (h - 10)))
    r(g, i === n - 1 ? (alerta ? '#b74e45' : '#3f7650') : '#9fb8a6', x0 + x + 3 + i * (larg + 1), y + h - 3 - alt, larg, alt)
  })
  r(g, '#c9c3b4', x0 + x + 2, y + h - 3, w - 4, 1)
}

function relogio(g: Ctx, x: number, y: number) {
  r(g, '#1f2330', x - 1, y - 1, 16, 16)
  r(g, '#b88a3a', x, y, 14, 14)
  r(g, '#fbf7ee', x + 2, y + 2, 10, 10)
  r(g, '#1f2330', x + 6, y + 3, 1, 4)
  r(g, '#1f2330', x + 7, y + 6, 3, 1)
}

/** Arquivo de aço com três gavetas. */
function arquivo(g: Ctx, x: number, y: number) {
  r(g, 'rgba(0,0,0,.15)', x + 1, y + 30, 16, 2)
  r(g, '#1f2330', x - 1, y - 1, 18, 32)
  r(g, '#8a929e', x, y, 16, 30)
  for (let i = 0; i < 3; i++) {
    r(g, '#6f7783', x + 1, y + 1 + i * 10, 14, 1)
    r(g, '#1f2330', x + 6, y + 4 + i * 10, 4, 2)
    r(g, '#ffffff', x + 3, y + 3 + i * 10, 2, 2)
  }
}

/** Poltrona de couro para quem visita, de costas para nós. */
function poltrona(g: Ctx, x: number, y: number, cor: string) {
  const escuro = misturar(cor, '#000000', 0.3)
  r(g, 'rgba(0,0,0,.18)', x + 1, y + 14, 16, 2)
  r(g, '#1f2330', x - 1, y - 1, 18, 16)
  r(g, cor, x, y, 16, 14)
  r(g, escuro, x, y, 3, 14)
  r(g, escuro, x + 13, y, 3, 14)
  r(g, misturar(cor, '#ffffff', 0.2), x + 4, y + 2, 8, 2)
  for (let i = x + 5; i < x + 12; i += 3) r(g, escuro, i, y + 6, 1, 1)
}

/** Mesinha com pilhas de moedas de ouro. */
function moedas(g: Ctx, x: number, y: number) {
  r(g, '#1f2330', x - 1, y + 9, 22, 8)
  r(g, '#5a3a24', x, y + 10, 20, 5)
  r(g, '#1f2330', x + 2, y + 15, 2, 6)
  r(g, '#1f2330', x + 16, y + 15, 2, 6)
  for (const [a, h] of [[2, 8], [8, 5], [14, 7]]) {
    r(g, '#1f2330', x + a - 1, y + 9 - h, 6, h + 1)
    for (let k = 0; k < h; k += 2) r(g, k % 4 ? '#f2b233' : '#ffd36b', x + a, y + 9 - h + k, 4, 2)
  }
}

function cofre(g: Ctx, x: number, y: number) {
  r(g, '#1f2330', x - 1, y - 1, 22, 24)
  r(g, '#5d6470', x, y, 20, 22)
  r(g, '#737b88', x + 2, y + 2, 16, 18)
  r(g, '#1f2330', x + 8, y + 8, 5, 5)
  r(g, '#f2b233', x + 9, y + 9, 3, 3)
}

export function desenharSalaFin(g: Ctx, x0: number) {
  // banco suíço: piso de mármore, lambri, cofre forte, arquivos, poltronas de couro e moedas de ouro
  piso(g, FIN, x0, FIN_W, PAREDE_H, SALA_H - PAREDE_H, 'ladrilho')
  for (let i = 0; i < 9; i++) r(g, '#d6d0c3', x0 + 6 + ((i * 37) % 110), PAREDE_H + 14 + ((i * 53) % 190), 6 + (i % 3) * 3, 1) // veios do mármore
  parede(g, FIN, x0, FIN_W)
  lambri(g, x0, FIN_W, '#3d2817')
  relogio(g, x0 + 14, 6)
  janela(g, x0 + 98, 7, 22, false)
  cortina(g, x0 + 94, 4, '#2f5d47')
  tapetePersa(g, x0 + 24, 68, 80, 62, '#2f5d47', '#d9b25f', '#7a2e2e')
  cofre(g, x0 + 8, 40)
  arquivo(g, x0 + 4, 150)
  arquivo(g, x0 + 22, 150)
  poltrona(g, x0 + 40, 112, '#6b3a22')
  poltrona(g, x0 + 72, 112, '#6b3a22')
  moedas(g, x0 + 100, 150)
  planta(g, x0 + 108, 40)
  planta(g, x0 + 108, 200)
  planta(g, x0 + 6, 200)
  // parede de baixo, com a porta
  r(g, '#1f2330', x0, SALA_H - 5, PORTA_FIN_X - 18, 5)
  r(g, '#1f2330', x0 + PORTA_FIN_X + 18, SALA_H - 5, FIN_W - PORTA_FIN_X - 18, 5)
  r(g, FIN.rodape, x0 + PORTA_FIN_X - 18, SALA_H - 2, 36, 2)
}

/** A mesa por cima do boneco sentado: monitor com gráfico e calculadora. */
export function desenharMesaFin(g: Ctx, x0: number) {
  const { x, y, w } = MESA_FIN
  r(g, 'rgba(0,0,0,.15)', x0 + x + 2, y + 16, w, 3)
  r(g, '#1f2330', x0 + x - 1, y - 1, w + 2, 18)
  r(g, '#ffffff', x0 + x, y, w, 12)
  r(g, '#c9ccd6', x0 + x, y + 12, w, 4)
  r(g, '#2a2d36', x0 + x + 3, y + 2, 9, 8) // calculadora
  r(g, '#9fd3a8', x0 + x + 4, y + 3, 7, 2)
  r(g, '#d9dde6', x0 + x + 22, y + 3, 10, 7) // relatório
  r(g, '#3f7650', x0 + x + 24, y + 5, 6, 1)
  r(g, '#3f7650', x0 + x + 24, y + 7, 4, 1)
}
