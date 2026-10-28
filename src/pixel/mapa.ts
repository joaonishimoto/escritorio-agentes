// Planta do andar em pixel art (1 unidade = 1 pixel antes da escala) e o desenho do cenário parado.
import type { AgenteId } from '../agents/catalogo'

export const T = 16
export const SALA_W = 224 // 14 blocos
export const PASSO_SALA = 240 // sala + parede de 1 bloco
export const PAREDE_H = 34 // faixa da parede do fundo
export const SALA_H = 160
export const CORREDOR_Y = 160
export const CORREDOR_H = 64
export const ANDAR_H = CORREDOR_Y + CORREDOR_H
export const VOCE_W = 160
export const PORTA_X = 112 // centro da porta de cada sala
export const COLUNA_X = 156 // corredorzinho entre as mesas por onde se anda dentro da sala
export const LINHA_FUNDO = 92 // altura dos pés no corredor entre as fileiras
export const LINHA_FRENTE = 144
export const CORREDOR_PES = 196

/** Mesas da sala (canto de cima à esquerda da mesa). O boneco senta embaixo, de costas para nós. */
export const MESAS: Record<AgenteId, { x: number; y: number }> = {
  chefe: { x: 16, y: 50 },
  pesquisador: { x: 64, y: 50 },
  redator: { x: 112, y: 50 },
  curador: { x: 176, y: 50 },
  publicador: { x: 16, y: 100 },
  revisor: { x: 64, y: 100 },
  designer: { x: 112, y: 100 },
  cinegrafista: { x: 176, y: 100 },
}
export const MESA_W = 30

/** Onde ficam os pés do boneco sentado. */
export const assento = (m: { x: number; y: number }) => ({ x: m.x + MESA_W / 2, y: m.y + 27 })
export const linhaDaMesa = (m: { y: number }) => (m.y < 80 ? LINHA_FUNDO : LINHA_FRENTE)

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
}

export const ESTILOS: Record<string, Estilo> = {
  d: { nome: 'Agência moderna', piso: '#e8d5b0', pisoLinha: '#d2ba90', parede: '#f3efe6', paredeDetalhe: '#e3ddd0', rodape: '#2a5288', mesa: '#ffffff', mesaSombra: '#c9ccd6', cadeira: '#2a5288', tapete: '#dce6f5' },
  e: { nome: 'Executivo noturno', piso: '#6b4a32', pisoLinha: '#57392a', parede: '#2c4a3e', paredeDetalhe: '#24403a', rodape: '#c9a45c', mesa: '#8a5a3a', mesaSombra: '#5e3d27', cadeira: '#1a1f1d', tapete: '#8a2f2a' },
  f: { nome: 'Loft criativo', piso: '#cfcac2', pisoLinha: '#bbb4aa', parede: '#b8654a', paredeDetalhe: '#9c513a', rodape: '#3a3a36', mesa: '#fbfaf7', mesaSombra: '#d6d1c7', cadeira: '#2f6f73', tapete: '#f2b233', tijolo: true },
}
export const ORDEM_ESTILOS = ['d', 'e', 'f']

/** Onde fica a placa com o nome da marca na parede (o texto é HTML por cima, para ficar nítido). */
export const PLACA = { x: 106, y: 8 }

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

const VOCE: Estilo = { nome: 'Sua sala', piso: '#ece1cc', pisoLinha: '#ddcfb5', parede: '#1e3d66', paredeDetalhe: '#1a3559', rodape: '#976822', mesa: '#ffffff', mesaSombra: '#c9ccd6', cadeira: '#976822', tapete: '#dce6f5' }

/** Sua mesa, na sua sala (coordenadas locais). Você senta atrás dela, de frente para nós. */
export const MESA_VOCE = { x: 64, y: 78, w: 34 }
export const CALENDARIO = { x: 18, y: 6, w: 34, h: 24 }

type Ctx = CanvasRenderingContext2D
const r = (g: Ctx, cor: string, x: number, y: number, w: number, h: number) => {
  g.fillStyle = cor
  g.fillRect(Math.round(x), Math.round(y), w, h)
}

function piso(g: Ctx, e: Estilo, x0: number, w: number, y0: number, h: number, tipo: 'tabua' | 'xadrez' | 'concreto') {
  r(g, e.piso, x0, y0, w, h)
  if (tipo === 'tabua') {
    for (let y = y0; y < y0 + h; y += 8) {
      r(g, e.pisoLinha, x0, y, w, 1)
      const desloc = ((y / 8) * 37) % 48
      for (let x = x0 + desloc; x < x0 + w; x += 48) r(g, e.pisoLinha, x, y, 1, 8)
    }
  } else if (tipo === 'xadrez') {
    for (let y = y0; y < y0 + h; y += 16) for (let x = x0; x < x0 + w; x += 16) if (((x - x0) / 16 + (y - y0) / 16) % 2 === 0) r(g, e.pisoLinha, x, y, 16, 16)
  } else {
    for (let y = y0; y < y0 + h; y += 32) r(g, e.pisoLinha, x0, y, w, 1)
    for (let x = x0; x < x0 + w; x += 32) r(g, e.pisoLinha, x, y0, 1, h)
    for (let i = 0; i < (w * h) / 90; i++) r(g, e.pisoLinha, x0 + ((i * 97) % w), y0 + ((i * 53) % h), 1, 1)
  }
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

function sofa(g: Ctx, x: number, y: number, cor: string) {
  r(g, '#1f2330', x - 1, y - 1, 42, 20)
  r(g, cor, x, y, 40, 18)
  r(g, 'rgba(0,0,0,.18)', x, y, 40, 6)
  r(g, 'rgba(255,255,255,.35)', x + 4, y + 8, 15, 7)
  r(g, 'rgba(255,255,255,.35)', x + 21, y + 8, 15, 7)
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

function cafe(g: Ctx, x: number, y: number) {
  r(g, '#1f2330', x - 1, y - 1, 34, 18)
  r(g, '#f4efe4', x, y, 32, 16)
  r(g, '#3d2c1e', x, y, 32, 3)
  r(g, '#2a2d36', x + 3, y - 10, 10, 13)
  r(g, '#f2b233', x + 5, y - 7, 6, 2)
  r(g, '#b74e45', x + 18, y - 3, 3, 4)
  r(g, '#2a5288', x + 23, y - 3, 3, 4)
}

function quadro(g: Ctx, x: number, y: number) {
  r(g, '#1f2330', x - 1, y - 1, 42, 22)
  r(g, '#ffffff', x, y, 40, 20)
  const notas = ['#f2b233', '#9fd3a8', '#f3a6a0', '#a9c4ef', '#f2b233']
  notas.forEach((c, i) => r(g, c, x + 3 + (i % 3) * 9, y + 3 + Math.floor(i / 3) * 8, 6, 6))
  r(g, '#2a5288', x + 31, y + 4, 1, 12)
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

/** Desenha uma sala de marca inteira (sem os bonecos). */
export function desenharSala(g: Ctx, x0: number, estilo: Estilo, noite: boolean) {
  piso(g, estilo, x0, SALA_W, PAREDE_H, SALA_H - PAREDE_H, estilo.tijolo ? 'concreto' : 'tabua')
  parede(g, estilo, x0, SALA_W)
  janela(g, x0 + 150, 7, 30, noite)
  janela(g, x0 + 186, 7, 30, noite)
  estante(g, x0 + 8, 2)
  quadro(g, x0 + 60, 5)
  cafe(g, x0 + 186, 74)
  tripe(g, x0 + 210, 98)
  planta(g, x0 + 204, 138)
  planta(g, x0 + 204, 36)
  planta(g, x0 + 4, 138)
  for (const id of Object.keys(MESAS) as AgenteId[]) {
    const m = MESAS[id]
    mesa(g, estilo, x0 + m.x, m.y)
    cadeira(g, estilo, x0 + m.x + 9, m.y + 17)
  }
  // parede de baixo, com a porta
  r(g, '#1f2330', x0, SALA_H - 5, PORTA_X - 18, 5)
  r(g, '#1f2330', x0 + PORTA_X + 18, SALA_H - 5, SALA_W - PORTA_X - 18, 5)
  r(g, estilo.rodape, x0 + PORTA_X - 18, SALA_H - 2, 36, 2)
}

/** Sua sala, no fim do corredor. */
export function desenharSuaSala(g: Ctx, x0: number) {
  piso(g, VOCE, x0, VOCE_W, PAREDE_H, SALA_H - PAREDE_H, 'xadrez')
  parede(g, VOCE, x0, VOCE_W)
  janela(g, x0 + 104, 7, 40, false)
  estante(g, x0 + 62, 2)
  r(g, VOCE.tapete, x0 + 40, 66, 82, 52)
  r(g, '#2a5288', x0 + 42, 68, 78, 1)
  sofa(g, x0 + 104, 128, '#2a5288')
  planta(g, x0 + 140, 36)
  planta(g, x0 + 4, 138)
  r(g, '#1f2330', x0, SALA_H - 5, PORTA_X - 18 - 32, 5)
  r(g, '#1f2330', x0 + 96, SALA_H - 5, VOCE_W - 96, 5)
  r(g, VOCE.rodape, x0 + 62, SALA_H - 2, 34, 2)
}
export const PORTA_VOCE_X = 80

export function desenharCorredor(g: Ctx, largura: number) {
  r(g, '#ddd6c8', 0, CORREDOR_Y, largura, CORREDOR_H)
  for (let x = 0; x < largura; x += 16) r(g, '#d2cab9', x, CORREDOR_Y, 1, CORREDOR_H)
  r(g, '#2a5288', 8, CORREDOR_Y + 26, largura - 16, 18)
  r(g, '#3969a8', 8, CORREDOR_Y + 27, largura - 16, 1)
  r(g, '#3969a8', 8, CORREDOR_Y + 42, largura - 16, 1)
  for (let x = 40; x < largura; x += 120) planta(g, x, CORREDOR_Y + 46)
}

export function desenharParedeEntre(g: Ctx, x: number) {
  r(g, '#1f2330', x, 0, 16, SALA_H)
  r(g, '#3a3f4f', x + 2, 0, 12, SALA_H - 2)
}

export function desenharMesaVoce(g: Ctx, x0: number) {
  const { x, y, w } = MESA_VOCE
  r(g, 'rgba(0,0,0,.15)', x0 + x + 2, y + 16, w, 3)
  r(g, '#1f2330', x0 + x - 1, y - 1, w + 2, 18)
  r(g, '#ffffff', x0 + x, y, w, 12)
  r(g, '#c9ccd6', x0 + x, y + 12, w, 4)
  r(g, '#1e3d66', x0 + x + 20, y + 3, 10, 6) // bandeja de entrada
  r(g, '#d9dde6', x0 + x + 4, y + 4, 10, 6)
}

export function desenharCalendario(g: Ctx, x0: number, marcados: Set<number>, hoje: number) {
  const { x, y, w, h } = CALENDARIO
  r(g, '#1f2330', x0 + x - 1, y - 1, w + 2, h + 2)
  r(g, '#ffffff', x0 + x, y, w, h)
  r(g, '#b74e45', x0 + x, y, w, 5)
  for (let d = 1; d <= 31; d++) {
    const c = (d - 1) % 7
    const l = Math.floor((d - 1) / 7)
    const cor = d === hoje ? '#1e3d66' : marcados.has(d) ? '#f2b233' : '#d9dde6'
    r(g, cor, x0 + x + 2 + c * 4.4, y + 7 + l * 3.4, 3, 2)
  }
}
