// Objetos que se mexem por cima do cenário: pastas, cartas, os gatos e os avisos em cima das mesas.
import type { Ponto } from './caminho'

/** Pastinha na cor da marca em cima da mesa: um post daquela marca na fila deste agente. */
export function pastaDaMarca(g: CanvasRenderingContext2D, x: number, y: number, cor: string) {
  g.fillStyle = '#1f2330'
  g.fillRect(x - 1, y - 1, 8, 6)
  g.fillStyle = cor
  g.fillRect(x, y, 6, 4)
  g.fillStyle = 'rgba(255,255,255,.45)'
  g.fillRect(x, y, 3, 1)
}

export function pasta(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = '#1f2330'
  g.fillRect(x - 1, y - 1, 10, 8)
  g.fillStyle = '#f2b233'
  g.fillRect(x, y, 8, 6)
  g.fillStyle = '#ffd36b'
  g.fillRect(x, y, 4, 2)
}

export interface Gato {
  nome: string
  mancha: string
  sala: number
  /** -1 no hall, senão o índice do departamento */
  area: number
  x: number
  y: number
  rota: Ponto[]
  dist: number
  ate: number
  dormindo: boolean
  dir: 1 | -1
}
/** Maki e Gojo: branquinhos, com manchas e olhos azuis. */
export const GATOS = [
  { nome: 'Maki', mancha: '#8a7a6c' },
  { nome: 'Gojo', mancha: '#3b3f4a' },
]

/** Gatinho visto de lado; passo -1 é parado (sentado ou deitado, se estiver dormindo). Pés em (x, y). */
export function gato(g: CanvasRenderingContext2D, x: number, y: number, gt: Gato, passo: number, t: number) {
  const c = '#1f2330'
  const b = '#ffffff'
  g.save()
  g.translate(x, y)
  if (gt.dir < 0) g.scale(-1, 1)
  const f = (cor: string, a: number, bb: number, w: number, h: number) => {
    g.fillStyle = cor
    g.fillRect(a, bb, w, h)
  }
  f('rgba(0,0,0,.18)', -6, -1, 13, 2)
  if (gt.dormindo && passo < 0) {
    // enroladinho dormindo
    f(c, -6, -6, 12, 6)
    f(c, -5, -7, 10, 1)
    f(b, -5, -6, 10, 5)
    f(gt.mancha, -3, -6, 3, 2)
    f(gt.mancha, 2, -4, 2, 2)
    f(c, 2, -3, 2, 1) // olho fechado
    f(b, -7, -3, 2, 2) // rabo
    f(c, -8, -3, 1, 2)
    g.restore()
    const z = Math.floor(t * 1.5) % 3
    g.fillStyle = '#ffffff'
    for (let i = 0; i <= z; i++) g.fillRect(x + 5 + i * 3, y - 10 - i * 4, 2, 2)
    return
  }
  const sentado = passo < 0
  // rabo
  f(c, -8, sentado ? -9 : -11, 3, sentado ? 7 : 6)
  f(b, -7, sentado ? -8 : -10, 1, sentado ? 5 : 5)
  // corpo
  f(c, -6, sentado ? -8 : -8, 10, sentado ? 7 : 6)
  f(b, -5, -7, 8, sentado ? 5 : 4)
  f(gt.mancha, -4, -7, 3, 2)
  // patas
  const pa = passo === 1 ? 1 : 0
  if (sentado) f(c, -4, -2, 8, 2)
  else {
    f(c, -5 + pa, -2, 2, 2)
    f(c, 1 - pa, -2, 2, 2)
  }
  // cabeça e orelhas
  f(c, 2, -12, 7, 6)
  f(b, 3, -11, 5, 4)
  f(c, 2, -14, 2, 2)
  f(c, 7, -14, 2, 2)
  f('#f2a6b8', 7, -13, 1, 1)
  f(gt.mancha, 3, -11, 2, 1)
  // olho azul e focinho
  f('#4aa3ff', 6, -10, 1, 1)
  f('#f2a6b8', 8, -8, 1, 1)
  g.restore()
}

/** Envelope branco com o selo da marca: o "e-mail" que você manda. */
export function carta(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = '#1f2330'
  g.fillRect(x - 1, y - 1, 14, 10)
  g.fillStyle = '#ffffff'
  g.fillRect(x, y, 12, 8)
  g.fillStyle = '#c9ced8'
  for (let i = 0; i < 6; i++) {
    g.fillRect(x + i, y + i * 0.6, 1, 1)
    g.fillRect(x + 11 - i, y + i * 0.6, 1, 1)
  }
  g.fillStyle = '#e05a4f'
  g.fillRect(x + 5, y + 3, 2, 2)
}

export function exclamacao(g: CanvasRenderingContext2D, x: number, y: number, cor: string) {
  g.fillStyle = '#1f2330'
  g.fillRect(x - 1, y - 1, 6, 12)
  g.fillStyle = cor
  g.fillRect(x, y, 4, 6)
  g.fillRect(x, y + 7, 4, 3)
}

export function seta(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = '#f2b233'
  g.fillRect(x, y, 6, 2)
  g.fillRect(x + 1, y + 2, 4, 2)
  g.fillRect(x + 2, y + 4, 2, 2)
}

export function faiscas(g: CanvasRenderingContext2D, x: number, y: number, desde: number) {
  const r = desde * 22
  g.fillStyle = desde < 0.4 ? '#ffffff' : '#f2b233'
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    g.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.7), 2, 2)
  }
}

export function reticencias(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  g.fillStyle = '#1f2330'
  g.fillRect(x - 1, y - 1, 13, 6)
  g.fillStyle = '#ffffff'
  g.fillRect(x, y, 11, 4)
  g.fillStyle = '#1f2330'
  const n = Math.floor(t * 3) % 4
  for (let i = 0; i < n; i++) g.fillRect(x + 2 + i * 3, y + 1, 2, 2)
}
