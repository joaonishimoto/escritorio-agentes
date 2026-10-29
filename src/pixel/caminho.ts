// Caminhos dos bonecos: uma lista de pontos e onde se está depois de andar uma distância.
import type { Direcao } from './sprites'

export type Ponto = [number, number]

export const comprimento = (p: Ponto[]) => p.slice(1).reduce((s, b, i) => s + Math.hypot(b[0] - p[i][0], b[1] - p[i][1]), 0)
export function noCaminho(p: Ponto[], d: number): { x: number; y: number; dir: Direcao } {
  let resto = d
  for (let i = 1; i < p.length; i++) {
    const [ax, ay] = p[i - 1]
    const [bx, by] = p[i]
    const seg = Math.hypot(bx - ax, by - ay)
    const dir: Direcao = Math.abs(bx - ax) > Math.abs(by - ay) ? (bx > ax ? 'direita' : 'esquerda') : by > ay ? 'baixo' : 'cima'
    if (resto <= seg || i === p.length - 1) {
      const t = seg ? Math.min(resto / seg, 1) : 1
      return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, dir }
    }
    resto -= seg
  }
  return { x: p[0][0], y: p[0][1], dir: 'baixo' }
}
