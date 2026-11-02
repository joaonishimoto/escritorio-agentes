// Peças da maquete 3D: materiais, caixas, texturas desenhadas e os bonecos.
// A planta é a mesma do pixel art (planta.ts): 1 pixel da planta = K metros.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Visual } from '../andar/visual'

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

/**
 * Modo escuro: o fundo e os chãos claros viram tons escuros do Azul Nishi (#1e3d66).
 * Use estas cores claras para fundo e chão; outra cor de chão nova precisa entrar aqui.
 */
export const CHAO_ESCURO: Record<string, string> = {
  '#eceef3': '#0b1524', // fundo em volta do andar
  '#dfe2e8': '#162843', // chão do andar
  '#cfd3dc': '#12223a', // corredor
  '#ece3d3': '#1f3556', // piso das salas (PADRAO.piso)
  '#e4ded2': '#1a2e4c', // hall do andar da equipe
}
let chaoEscuro = false
/** A cor de fundo ou de chão no tema que está valendo. */
export const corDoChao = (cor: string) => (chaoEscuro && CHAO_ESCURO[cor.toLowerCase()]) || cor

const materiais = new Map<string, THREE.MeshStandardMaterial>()
/** Um material por cor (e opções), para a maquete inteira compartilhar poucos materiais. */
export function mat(cor: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const chave = cor + JSON.stringify(o)
  let m = materiais.get(chave)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: corDoChao(cor), roughness: 0.78, metalness: 0, ...o })
    m.userData.cor = cor
    materiais.set(chave, m)
  }
  return m
}

/** Liga ou desliga o chão escuro e repinta os materiais já criados. */
export function usarChaoEscuro(escuro: boolean) {
  if (escuro === chaoEscuro) return
  chaoEscuro = escuro
  for (const m of materiais.values()) if (m.userData.cor && !m.map) m.color.set(corDoChao(m.userData.cor))
}

const formas = new Map<string, THREE.BufferGeometry>()
/**
 * Uma forma por medida, para a maquete inteira reaproveitar as mesmas (antes cada caixa criava a sua, e o andar
 * passava de 4.000 buffers na placa de vídeo). As compartilhadas nunca são descartadas.
 */
export function forma<G extends THREE.BufferGeometry>(chave: string, criar: () => G): G {
  let g = formas.get(chave)
  if (!g) {
    g = criar()
    g.userData.compartilhada = true
    formas.set(chave, g)
  }
  return g as G
}
const n4 = (n: number) => Math.round(n * 1e4) / 1e4

export type Acao =
  | { tipo: 'agente'; id: string }
  | { tipo: 'caixa'; id: string }
  | { tipo: 'voce' }
  | { tipo: 'calendario' }
  | { tipo: 'financeiro' }
  | { tipo: 'quadro'; marca: string; quadro: 'referencias' | 'calendario' | 'branding' | 'regras' }
  | { tipo: 'cofre' | 'gaveta' | 'novo' | 'instagram'; marca: string; sala: number }
  | { tipo: 'gato'; nome: string }

/** Caixa (arredondada se tiver raio) já na posição, com sombra. */
export function caixa(pai: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material | string, x: number, y: number, z: number, raio = 0, acao?: Acao) {
  const r = raio > 0 ? Math.min(raio, w / 2, h / 2, d / 2) : 0
  const geo = forma(`caixa:${n4(w)}:${n4(h)}:${n4(d)}:${n4(r)}`, () => (r > 0 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d)))
  const me = new THREE.Mesh(geo, typeof m === 'string' ? mat(m) : m)
  me.position.set(x, y, z)
  me.castShadow = true
  me.receiveShadow = true
  if (acao) me.userData.acao = acao
  pai.add(me)
  return me
}

export function cilindro(pai: THREE.Object3D, rTopo: number, rBase: number, h: number, m: THREE.Material | string, x: number, y: number, z: number, lados = 18) {
  const me = new THREE.Mesh(forma(`cil:${n4(rTopo)}:${n4(rBase)}:${n4(h)}:${lados}`, () => new THREE.CylinderGeometry(rTopo, rBase, h, lados)), typeof m === 'string' ? mat(m) : m)
  me.position.set(x, y, z)
  me.castShadow = true
  me.receiveShadow = true
  pai.add(me)
  return me
}

/** Chão de uma área (plano deitado), um pouco acima do anterior para não brigar. */
export function chao(pai: THREE.Object3D, x0: number, z0: number, w: number, d: number, cor: string, nivel = 0) {
  const p = new THREE.Mesh(forma(`plano:${n4(w)}:${n4(d)}`, () => new THREE.PlaneGeometry(w, d)), mat(cor))
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
  const m = new THREE.Mesh(forma(`plano:${n4(w)}:${n4(h)}`, () => new THREE.PlaneGeometry(w, h)), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }))
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
  const tela = new THREE.Mesh(forma('plano:tela', () => new THREE.PlaneGeometry(0.57, 0.33)), new THREE.MeshStandardMaterial({ color: PALETA.tela, emissive: PALETA.tela, emissiveIntensity: 0.35, roughness: 0.2 }))
  tela.position.set(0, h + 0.39, -0.08)
  if (acao) tela.userData.acao = acao
  tela.userData.manter = true // a cor da tela muda com o estado de quem trabalha ali
  g.add(tela)
  caixa(g, 0.42, 0.015, 0.13, '#e6e8ee', 0, h + 0.035, 0.12, 0.005, acao)
  fundir(g)
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
  fundir(g)
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
    const f = new THREE.Mesh(forma(`ico:${n4(r * s)}`, () => new THREE.IcosahedronGeometry(r * s, 0)), mat(k % 2 ? '#3f8f5a' : '#2f7448', { flatShading: true }))
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

export interface Gato3D {
  grupo: THREE.Group
  cabeca: THREE.Group
  cauda: THREE.Mesh
  pernas: THREE.Mesh[]
}
/** Gatinho branco com manchas e olhos azuis (a Maki e o Gojo). Olha para +x; pés no chão. */
export function gato(pai: THREE.Object3D, mancha: string, acao: Acao): Gato3D {
  const branco = '#f7f5f0'
  const grupo = new THREE.Group()
  caixa(grupo, 0.36, 0.16, 0.18, branco, 0, 0.17, 0, 0.06, acao)
  caixa(grupo, 0.16, 0.02, 0.13, mancha, -0.05, 0.25, 0.01, 0.01, acao)
  const pernas = [
    [0.12, 0.05], [0.12, -0.05], [-0.12, 0.05], [-0.12, -0.05],
  ].map(([x, z]) => caixa(grupo, 0.05, 0.1, 0.05, branco, x, 0.05, z, 0.015, acao))
  const cabeca = new THREE.Group()
  cabeca.position.set(0.2, 0.3, 0)
  caixa(cabeca, 0.16, 0.14, 0.16, branco, 0, 0, 0, 0.05, acao)
  for (const [z, cor] of [[0.045, mancha], [-0.045, branco]] as const) {
    const orelha = caixa(cabeca, 0.04, 0.06, 0.04, cor, -0.01, 0.085, z, 0.01, acao)
    orelha.rotation.x = z > 0 ? -0.25 : 0.25
  }
  for (const z of [0.035, -0.035]) caixa(cabeca, 0.012, 0.03, 0.026, '#4a9be8', 0.081, 0.015, z, 0.004, acao)
  caixa(cabeca, 0.012, 0.015, 0.02, '#e89aa6', 0.083, -0.02, 0, 0.003, acao)
  grupo.add(cabeca)
  const cauda = caixa(grupo, 0.04, 0.22, 0.04, mancha, -0.21, 0.3, 0, 0.015, acao)
  cauda.rotation.z = 0.45
  pai.add(grupo)
  return { grupo, cabeca, cauda, pernas }
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
  const capsula = (r: number, l: number, c: number, rs: number) => forma(`capsula:${r}:${l}:${c}:${rs}`, () => new THREE.CapsuleGeometry(r, l, c, rs))
  const calca = v.calca ?? '#2e3240'
  // sentado: tronco na cadeira, pernas dobradas para a frente (-z), braços no teclado
  const sentado = new THREE.Group()
  const corpo = add(sentado, capsula(0.17, 0.26, 6, 16), v.camisa, 0, 0.82, 0.05)
  for (const sx of [-1, 1]) {
    const b = add(sentado, capsula(0.055, 0.28, 4, 10), v.camisa, sx * 0.2, 0.86, -0.08)
    b.rotation.x = Math.PI / 2.4
    const coxa = add(sentado, capsula(0.065, 0.3, 4, 10), calca, sx * 0.09, 0.55, -0.12)
    coxa.rotation.x = Math.PI / 2
    add(sentado, capsula(0.06, 0.3, 4, 10), calca, sx * 0.09, 0.3, -0.3)
  }
  const cabeca = (dest: THREE.Object3D, y: number) => {
    add(dest, forma('cabeca', () => new THREE.SphereGeometry(0.15, 24, 18)), v.pele, 0, y, 0.03)
    const cab = add(dest, forma('cabelo', () => new THREE.SphereGeometry(0.16, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55)), v.cabelo, 0, y + 0.005, 0.05)
    cab.rotation.x = 0.35
    if (capelo) {
      add(dest, forma('capelo:aba', () => new THREE.BoxGeometry(0.34, 0.02, 0.34)), '#1f2330', 0, y + 0.16, 0.02)
      add(dest, forma('capelo:copa', () => new THREE.CylinderGeometry(0.11, 0.13, 0.08, 12)), '#1f2330', 0, y + 0.12, 0.02)
      add(dest, forma('capelo:borla', () => new THREE.BoxGeometry(0.03, 0.1, 0.03)), '#f2b233', 0.16, y + 0.12, 0.16)
    }
  }
  cabeca(sentado, 1.22)
  // em pé: pernas retas, braços para baixo (segurando a pasta na frente quando entrega)
  const emPe = new THREE.Group()
  add(emPe, capsula(0.17, 0.26, 6, 16), v.camisa, 0, 0.98, 0)
  for (const sx of [-1, 1]) {
    add(emPe, capsula(0.055, 0.3, 4, 10), v.camisa, sx * 0.23, 0.9, 0)
    add(emPe, capsula(0.065, 0.42, 4, 10), calca, sx * 0.09, 0.4, 0)
  }
  cabeca(emPe, 1.38)
  const pasta = add(emPe, forma('pasta', () => new THREE.BoxGeometry(0.3, 0.22, 0.04)), '#f2b233', 0, 0.9, -0.22)
  pasta.visible = false
  pasta.userData.manter = true
  // cada pose vira poucas malhas (uma por cor): o boneco só se mexe inteiro
  fundir(sentado)
  fundir(emPe)
  emPe.visible = false
  g.add(sentado, emPe)
  pai.add(g)
  return { grupo: g, sentado, emPe, pasta, corpo }
}

/** Envelope fechado, com a aba na cor dada: é o "e-mail" que voa de uma mesa para outra. */
export function envelope(pai: THREE.Object3D, cor = '#b74e45') {
  const g = new THREE.Group()
  caixa(g, 0.34, 0.025, 0.24, '#ffffff', 0, 0, 0, 0.004)
  // aba em triângulo por cima
  const aba = new THREE.Mesh(forma('aba', () => new THREE.CircleGeometry(0.17, 3)), mat(cor))
  aba.rotation.x = -Math.PI / 2
  aba.rotation.z = -Math.PI / 2
  aba.scale.set(0.72, 1, 1)
  aba.position.set(0, 0.014, -0.03)
  g.add(aba)
  pai.add(g)
  return g
}

/** Envelope aberto com a folha saindo, em cima da mesa: o e-mail que acabou de chegar. Começa escondido. */
export function envelopeAberto(pai: THREE.Object3D, x: number, z: number) {
  const g = new THREE.Group()
  g.position.set(x, 0.78, z)
  caixa(g, 0.3, 0.02, 0.21, '#f2b233', 0, 0, 0, 0.004)
  const folha = caixa(g, 0.24, 0.01, 0.2, '#ffffff', 0.02, 0.018, -0.06, 0.002)
  folha.rotation.y = 0.12
  for (let k = 0; k < 3; k++) caixa(g, 0.16, 0.004, 0.012, '#c9ced8', 0.02, 0.026, -0.12 + k * 0.035)
  g.visible = false
  pai.add(g)
  return g
}

/**
 * Junta as peças paradas de um grupo: todas as do mesmo material, da mesma sombra e do mesmo clique viram uma só malha.
 * O andar tinha umas 2.000 peças soltas (mais de mil desenhos por quadro, contando a sombra), e isso travava o navegador.
 * O que não dá para juntar, ou que se mexe sozinho (userData.manter), continua solto, na mesma posição.
 */
export function fundir(grupo: THREE.Object3D) {
  grupo.updateMatrixWorld(true)
  const base = grupo.matrixWorld.clone().invert()
  const baldes = new Map<string, { material: THREE.Material; acao?: Acao; sombra: boolean; partes: THREE.BufferGeometry[] }>()
  const soltos: { obj: THREE.Mesh; matriz: THREE.Matrix4 }[] = []
  grupo.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const matriz = base.clone().multiply(m.matrixWorld)
    const geo = m.geometry
    const atributos = Object.keys(geo.attributes).sort().join(',')
    const juntavel = !m.userData.manter && !Array.isArray(m.material) && m.visible && atributos === 'normal,position,uv' && geo.morphAttributes.position === undefined
    if (!juntavel) {
      soltos.push({ obj: m, matriz })
      return
    }
    const material = m.material as THREE.Material
    const acao = m.userData.acao as Acao | undefined
    const chave = `${material.uuid}|${acao ? JSON.stringify(acao) : ''}|${m.castShadow}|${geo.index ? 'i' : 'n'}`
    let b = baldes.get(chave)
    if (!b) baldes.set(chave, (b = { material, acao, sombra: m.castShadow, partes: [] }))
    b.partes.push(geo.clone().applyMatrix4(matriz))
  })
  grupo.clear()
  for (const b of baldes.values()) {
    const geo = b.partes.length === 1 ? b.partes[0] : mergeGeometries(b.partes)
    if (b.partes.length > 1) for (const p of b.partes) p.dispose()
    if (!geo) continue
    geo.computeBoundingSphere()
    const me = new THREE.Mesh(geo, b.material)
    me.castShadow = b.sombra
    me.receiveShadow = true
    if (b.acao) me.userData.acao = b.acao
    grupo.add(me)
  }
  for (const { obj, matriz } of soltos) {
    matriz.decompose(obj.position, obj.quaternion, obj.scale)
    grupo.add(obj)
  }
}

/** Joga fora o que só este grupo usava (formas juntadas, quadros desenhados), antes de montar de novo. */
export function descartar(grupo: THREE.Object3D) {
  grupo.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    if (!m.geometry.userData.compartilhada) m.geometry.dispose()
    for (const mt of Array.isArray(m.material) ? m.material : [m.material]) {
      if (mt.userData.cor) continue // material do cache, compartilhado
      const mapa = (mt as THREE.MeshStandardMaterial).map
      if (mapa) mapa.dispose()
      mt.dispose()
    }
  })
  grupo.clear()
}
