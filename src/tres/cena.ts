// Peças da maquete 3D: materiais, caixas, texturas desenhadas e os bonecos.
// A planta é a mesma do pixel art (planta.ts): 1 pixel da planta = K metros.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Visual } from '../pixel/sprites'

export const K = 0.0375
/** x da planta (pixels do andar) em metros */
export const wx = (px: number) => px * K
/** y da planta em metros, no eixo z (para o fundo é menor) */
export const wz = (py: number) => py * K

export const PALETA = {
  escuro: '#1f2330',
  perna: '#c9ced8',
  monitor: '#2a2f3a',
  tela: '#9fb7d9',
  madeiraClara: '#d8c4a4',
  branco: '#ffffff',
}

const materiais = new Map<string, THREE.MeshStandardMaterial>()
/** Um material por cor (e opções), para a maquete inteira compartilhar poucos materiais. */
export function mat(cor: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const chave = cor + JSON.stringify(o)
  let m = materiais.get(chave)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.78, metalness: 0, ...o })
    materiais.set(chave, m)
  }
  return m
}

export type Acao =
  | { tipo: 'agente'; id: string }
  | { tipo: 'voce' }
  | { tipo: 'calendario' }
  | { tipo: 'financeiro' }
  | { tipo: 'quadro'; marca: string; quadro: 'referencias' | 'calendario' | 'branding' | 'regras' }
  | { tipo: 'cofre' | 'gaveta' | 'decorar' | 'novo' | 'instagram'; marca: string; sala: number }

/** Caixa (arredondada se tiver raio) já na posição, com sombra. */
export function caixa(pai: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material | string, x: number, y: number, z: number, raio = 0, acao?: Acao) {
  const geo = raio > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(raio, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d)
  const me = new THREE.Mesh(geo, typeof m === 'string' ? mat(m) : m)
  me.position.set(x, y, z)
  me.castShadow = true
  me.receiveShadow = true
  if (acao) me.userData.acao = acao
  pai.add(me)
  return me
}

export function cilindro(pai: THREE.Object3D, rTopo: number, rBase: number, h: number, m: THREE.Material | string, x: number, y: number, z: number, lados = 18) {
  const me = new THREE.Mesh(new THREE.CylinderGeometry(rTopo, rBase, h, lados), typeof m === 'string' ? mat(m) : m)
  me.position.set(x, y, z)
  me.castShadow = true
  me.receiveShadow = true
  pai.add(me)
  return me
}

/** Chão de uma área (plano deitado), um pouco acima do anterior para não brigar. */
export function chao(pai: THREE.Object3D, x0: number, z0: number, w: number, d: number, cor: string, nivel = 0) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(cor))
  p.rotation.x = -Math.PI / 2
  p.position.set(x0 + w / 2, 0.001 + nivel * 0.003, z0 + d / 2)
  p.receiveShadow = true
  pai.add(p)
  return p
}

/** Textura desenhada num canvas (para quadros da parede, calendário e gráfico). */
export function textura(w: number, h: number, desenhar: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  desenhar(g, w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Quadro na parede do fundo: moldura branca e a imagem desenhada, de frente para a sala (+z). */
export function quadroNaParede(pai: THREE.Object3D, cx: number, cy: number, z: number, w: number, h: number, tex: THREE.Texture, acao?: Acao, moldura = '#ffffff') {
  const g = new THREE.Group()
  g.position.set(cx, cy, z)
  caixa(g, w + 0.06, h + 0.06, 0.035, moldura, 0, 0, 0.0175, 0.01, acao)
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }))
  m.position.z = 0.037
  if (acao) m.userData.acao = acao
  g.add(m)
  pai.add(g)
  return g
}

/** Mesa de trabalho com monitor e teclado. Centro em (cx, cz); o monitor fica para o lado de -z (parede do fundo). */
export function mesaDeTrabalho(pai: THREE.Object3D, cx: number, cz: number, corMesa: string, acao?: Acao) {
  const w = 30 * K + 0.1
  const d = 17 * K + 0.1
  const h = 0.74
  const g = new THREE.Group()
  g.position.set(cx, 0, cz)
  caixa(g, w, 0.05, d, corMesa, 0, h, 0, 0.02, acao)
  for (const sx of [-1, 1]) caixa(g, 0.05, h, d - 0.08, PALETA.perna, sx * (w / 2 - 0.06), h / 2, 0, 0, acao)
  caixa(g, 0.06, 0.22, 0.06, PALETA.monitor, 0, h + 0.13, -0.12, 0, acao)
  caixa(g, 0.2, 0.015, 0.14, PALETA.monitor, 0, h + 0.03, -0.12, 0, acao)
  caixa(g, 0.62, 0.38, 0.035, PALETA.monitor, 0, h + 0.39, -0.1, 0.015, acao)
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.57, 0.33), new THREE.MeshStandardMaterial({ color: PALETA.tela, emissive: PALETA.tela, emissiveIntensity: 0.35, roughness: 0.2 }))
  tela.position.set(0, h + 0.39, -0.08)
  if (acao) tela.userData.acao = acao
  g.add(tela)
  caixa(g, 0.42, 0.015, 0.13, '#e6e8ee', 0, h + 0.035, 0.12, 0.005, acao)
  pai.add(g)
  return { grupo: g, tela }
}

/** Cadeira de escritório na cor dada. Centro em (cx, cz); o encosto fica para +z. */
export function cadeira(pai: THREE.Object3D, cx: number, cz: number, cor: string, acao?: Acao) {
  const g = new THREE.Group()
  g.position.set(cx, 0, cz)
  caixa(g, 0.46, 0.08, 0.44, cor, 0, 0.46, 0, 0.04, acao)
  caixa(g, 0.46, 0.5, 0.07, cor, 0, 0.74, 0.22, 0.04, acao)
  caixa(g, 0.05, 0.42, 0.05, '#9aa0aa', 0, 0.21, 0, 0, acao)
  caixa(g, 0.5, 0.03, 0.5, '#9aa0aa', 0, 0.03, 0, 0.01, acao)
  pai.add(g)
  return g
}

/** Vaso de planta. */
export function planta(pai: THREE.Object3D, cx: number, cz: number, s = 1) {
  const g = new THREE.Group()
  g.position.set(cx, 0, cz)
  cilindro(g, 0.2 * s, 0.15 * s, 0.4 * s, '#ffffff', 0, 0.2 * s, 0)
  const pontos = [
    [0, 0.6, 0, 0.22],
    [0.12, 0.75, 0.06, 0.17],
    [-0.1, 0.8, -0.08, 0.18],
    [0.04, 0.95, 0.1, 0.15],
    [-0.06, 0.98, -0.06, 0.14],
  ]
  pontos.forEach(([x, y, z, r], k) => {
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 0), mat(k % 2 ? '#3f8f5a' : '#2f7448', { flatShading: true }))
    f.position.set(x * s, y * s, z * s)
    f.castShadow = true
    g.add(f)
  })
  pai.add(g)
  return g
}

/** Sofá de dois lugares, encosto para +z. */
export function sofa(pai: THREE.Object3D, cx: number, cz: number, w: number, cor: string) {
  const g = new THREE.Group()
  g.position.set(cx, 0, cz)
  caixa(g, w, 0.4, 0.8, cor, 0, 0.2, 0, 0.08)
  caixa(g, w, 0.45, 0.2, cor, 0, 0.55, 0.32, 0.08)
  for (const k of [-1, 1]) caixa(g, 0.2, 0.55, 0.8, cor, k * (w / 2 - 0.1), 0.28, 0, 0.08)
  pai.add(g)
  return g
}

export interface Boneco {
  grupo: THREE.Group
  sentado: THREE.Group
  emPe: THREE.Group
  pasta: THREE.Mesh
  /** o chapéu de formatura (quem está em treinamento) */
  corpo: THREE.Mesh
}

/** Boneco de maquete: corpo em cápsula, cabeça redonda e cabelo. Olha para -z; o cabelo fica atrás (+z). */
export function boneco(pai: THREE.Object3D, v: Visual, acao?: Acao, capelo = false): Boneco {
  const g = new THREE.Group()
  const add = (dest: THREE.Object3D, geo: THREE.BufferGeometry, cor: string, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat(cor))
    m.position.set(x, y, z)
    m.castShadow = true
    m.receiveShadow = true
    if (acao) m.userData.acao = acao
    dest.add(m)
    return m
  }
  const calca = v.calca ?? '#2e3240'
  // sentado: tronco na cadeira, pernas dobradas para a frente (-z), braços no teclado
  const sentado = new THREE.Group()
  const corpo = add(sentado, new THREE.CapsuleGeometry(0.17, 0.26, 6, 16), v.camisa, 0, 0.82, 0.05)
  for (const sx of [-1, 1]) {
    const b = add(sentado, new THREE.CapsuleGeometry(0.055, 0.28, 4, 10), v.camisa, sx * 0.2, 0.86, -0.08)
    b.rotation.x = Math.PI / 2.4
    const coxa = add(sentado, new THREE.CapsuleGeometry(0.065, 0.3, 4, 10), calca, sx * 0.09, 0.55, -0.12)
    coxa.rotation.x = Math.PI / 2
    add(sentado, new THREE.CapsuleGeometry(0.06, 0.3, 4, 10), calca, sx * 0.09, 0.3, -0.3)
  }
  const cabeca = (dest: THREE.Object3D, y: number) => {
    add(dest, new THREE.SphereGeometry(0.15, 24, 18), v.pele, 0, y, 0.03)
    const cab = add(dest, new THREE.SphereGeometry(0.16, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), v.cabelo, 0, y + 0.005, 0.05)
    cab.rotation.x = 0.35
    if (capelo) {
      add(dest, new THREE.BoxGeometry(0.34, 0.02, 0.34), '#1f2330', 0, y + 0.16, 0.02)
      add(dest, new THREE.CylinderGeometry(0.11, 0.13, 0.08, 12), '#1f2330', 0, y + 0.12, 0.02)
      add(dest, new THREE.BoxGeometry(0.03, 0.1, 0.03), '#f2b233', 0.16, y + 0.12, 0.16)
    }
  }
  cabeca(sentado, 1.22)
  // em pé: pernas retas, braços para baixo (segurando a pasta na frente quando entrega)
  const emPe = new THREE.Group()
  add(emPe, new THREE.CapsuleGeometry(0.17, 0.26, 6, 16), v.camisa, 0, 0.98, 0)
  for (const sx of [-1, 1]) {
    add(emPe, new THREE.CapsuleGeometry(0.055, 0.3, 4, 10), v.camisa, sx * 0.23, 0.9, 0)
    add(emPe, new THREE.CapsuleGeometry(0.065, 0.42, 4, 10), calca, sx * 0.09, 0.4, 0)
  }
  cabeca(emPe, 1.38)
  const pasta = add(emPe, new THREE.BoxGeometry(0.3, 0.22, 0.04), '#f2b233', 0, 0.9, -0.22)
  pasta.visible = false
  emPe.visible = false
  g.add(sentado, emPe)
  pai.add(g)
  return { grupo: g, sentado, emPe, pasta, corpo }
}
