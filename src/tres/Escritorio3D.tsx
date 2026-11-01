// O andar como uma maquete 3D clara: as mesmas salas, mesas e caminhos do pixel art, vistos de cima e de lado.
// Arrastar passeia pelo andar, a roda aproxima, o botão direito (ou dois dedos) gira. Clicar funciona como no 2D.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { tocarAviso } from '../lib/som'
import { AGENTES, agentePorId, type AgenteId } from '../agents/catalogo'
import { COR_ESTADO, selecionarEsperandoVoce, useEscritorio, type Entrega, type Estado } from '../store/escritorio'
import { BarraSalas, type AlvoDaBarra } from '../pixel/BarraSalas'
import type { MarcaNoAndar } from '../pixel/EscritorioPixel'
import { VISUAL, VISUAL_FIN } from '../pixel/visual'
import { comprimento, noCaminho, type Ponto } from '../pixel/caminho'
import {
  ANDAR_H, CAFE, CALENDARIO, COFRINHO, CORREDOR_PES, CORREDOR_Y, DECORAR, DEPTOS, FIN_W, GAVETA, GRAFICO_FIN, INSTAGRAM, LINHA_HALL, MARCA_W, MESA_FIN, MESA_VOCE, MESAS,
  MESINHA_PUBLICACAO, NOVO_POST, ORDEM_ESTILOS, PAREDE_DEPTO_Y, PAREDE_H, PASSO_EQUIPE, PASSO_MARCA, PLACA, PORTA_FIN_X, PORTA_MARCA, PORTA_VOCE_X, PORTA_X, QUADRO_PAUTA, QUADROS, SALA_H, SALA_W, VOCE_W,
  assento, ateOHall, dentroDaSala, doHallAte, estiloDaSala, type Quadro,
} from '../pixel/mapa'
import { misturar } from '../pixel/estilos'
import { type Acao, type Boneco, boneco, cadeira, caixa, chao, cilindro, K, mat, mesaDeTrabalho, PALETA, planta, quadroNaParede, sofa, textura, wx, wz } from './cena'

type Props = Parameters<typeof import('../pixel/EscritorioPixel').EscritorioPixel>[0]

const VELOCIDADE = 58
const TEMPO_MINIMO_NA_MESA = 1600
const PRIORIDADE: Estado[] = ['erro', 'esperando_voce', 'trabalhando', 'na_fila', 'concluido', 'ocioso']
const ALTURA_PAREDE = 2.4
const COR_EQUIPE = '#2a5288'
const PISOS_DEPTO = ['#f3e3c2', '#f3d9d2', '#dcdcef', '#d3e8df']

interface Andante {
  id: string
  quem: AgenteId | 'voce'
  ida: Ponto[]
  volta: Ponto[]
  fase: 'ida' | 'parado' | 'volta'
  dist: number
  parouEm: number
  pasta: boolean
  carta?: boolean
  alvo?: AgenteId | 'voce'
}

/** Posição do mundo → pixels da tela do contêiner. */
function projetar(p: THREE.Vector3, camera: THREE.Camera, w: number, h: number) {
  const v = p.clone().project(camera)
  return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visivel: v.z < 1 }
}

export function Escritorio3D({
  marcas,
  marcaAtiva,
  aoEscolherMarca,
  quadros,
  aoAbrirQuadro,
  financeiro,
  cofres,
  porSala,
  naSuaMesa = 0,
  aoEditarSala,
  aoReordenar,
  aoNovoPost,
  aoConectarInstagram,
}: Props) {
  const caixaRef = useRef<HTMLDivElement>(null)
  const etiquetas = useRef<Map<string, HTMLDivElement>>(new Map())
  const estilosAntigos = useMemo<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('estilos-pixel') ?? '{}')
    } catch {
      return {}
    }
  }, [])

  const estados = useEscritorio((s) => s.estados)
  const acoes = useEscritorio((s) => s.acaoAtual)
  const aguardando = useEscritorio(selecionarEsperandoVoce)
  const selecionado = useEscritorio((s) => s.selecionado)
  const agenda = useEscritorio((s) => s.agenda)
  const selecionar = useEscritorio((s) => s.selecionar)
  const focar = useEscritorio((s) => s.focar)
  const foco = useEscritorio((s) => s.foco)

  const indiceAtivo = Math.max(0, marcas.findIndex((m) => m.id === marcaAtiva))
  const xMarca = (i: number) => -(marcas.length - i) * PASSO_MARCA
  const origem = xMarca(0)
  const xVoce = PASSO_EQUIPE
  const xFin = xVoce + VOCE_W + 16
  const largura = xFin + FIN_W
  const corDe = (m: MarcaNoAndar) => m.cor ?? COR_EQUIPE
  const estiloDe = (m: MarcaNoAndar, i: number) => estiloDaSala(estilosAntigos[m.id] ?? ORDEM_ESTILOS[(m.ordem ?? i) % ORDEM_ESTILOS.length], corDe(m), m.sala)

  const diasMarcados = useMemo(() => {
    const hoje = new Date()
    return new Set(
      agenda
        .map((a) => new Date(a.data))
        .filter((d) => d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear())
        .map((d) => d.getDate()),
    )
  }, [agenda])

  // estado que o laço de desenho lê sem renderizar o React de novo
  const vivo = useRef({ estados, aguardando, selecionado, indiceAtivo, foco, porSala, acoes, mudouEm: {} as Record<string, number>, ultimoEstado: {} as Record<string, Estado> })
  vivo.current.porSala = porSala
  vivo.current.estados = estados
  vivo.current.aguardando = aguardando
  vivo.current.selecionado = selecionado
  vivo.current.indiceAtivo = indiceAtivo
  vivo.current.foco = foco
  vivo.current.acoes = acoes
  for (const a of AGENTES) {
    if (vivo.current.ultimoEstado[a.id] !== estados[a.id]) {
      vivo.current.ultimoEstado[a.id] = estados[a.id]
      vivo.current.mudouEm[a.id] = performance.now()
    }
  }
  const marcasRef = useRef(marcas)
  marcasRef.current = marcas

  // ── a cena, o renderizador e o que se mexe ──
  const tres = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.OrthographicCamera
    controls: OrbitControls
    sol: THREE.DirectionalLight
    cenario: THREE.Group
    vivos: THREE.Group
    bonecos: Record<AgenteId | 'voce' | 'financeiro', Boneco>
    telas: Record<AgenteId, THREE.Mesh>
    filas: Record<AgenteId, THREE.Mesh[]>
    pastasMesa: Record<string, THREE.Mesh>
    anel: THREE.Mesh
    cartas: Map<string, THREE.Mesh>
    alvoCamera: THREE.Vector3 | null
    tamanho: { w: number; h: number }
  } | null>(null)

  const andantes = useRef<Andante[]>([])
  const pendentes = useRef<Entrega[]>([])
  const pastasNaMesa = useRef<Map<string, number>>(new Map())
  const recebeuEm = useRef<Map<string, number>>(new Map())
  const [pastaChegouEmVoce, setPastaChegouEmVoce] = useState(true)
  const pastaEmVoceRef = useRef(true)
  const [sobre, setSobre] = useState<string | null>(null)

  // ── caminhos (coordenadas da planta, como no 2D) ──
  const pes = (quem: AgenteId | 'voce'): Ponto => {
    if (quem === 'voce') return [xVoce + MESA_VOCE.x + MESA_VOCE.w / 2, MESA_VOCE.y - 2]
    const a = assento(MESAS[quem])
    return [a.x, a.y]
  }
  const daSuaMesaAtePorta = (): Ponto[] => {
    const [x, y] = pes('voce')
    return [[x, y], [xVoce + 50, y], [xVoce + 50, 124], [xVoce + PORTA_VOCE_X, 124], [xVoce + PORTA_VOCE_X, CORREDOR_PES]]
  }
  const caminho = (de: AgenteId | 'voce', para: AgenteId | 'voce'): Ponto[] => {
    if (de !== 'voce' && para !== 'voce') return dentroDaSala(MESAS[de], MESAS[para])
    const saida: Ponto[] = de === 'voce' ? daSuaMesaAtePorta() : [...ateOHall(MESAS[de]), [PORTA_X, LINHA_HALL], [PORTA_X, CORREDOR_PES]]
    const chegada: Ponto[] =
      para === 'voce'
        ? [...daSuaMesaAtePorta()].reverse().slice(0, -1).concat([[pes('voce')[0], MESA_VOCE.y + 24]])
        : [[PORTA_X, CORREDOR_PES], [PORTA_X, LINHA_HALL], ...doHallAte(MESAS[para])]
    return [...saida, ...chegada]
  }
  const aCaminhoDe = () => new Set(andantes.current.filter((a) => (a.pasta || a.carta) && a.fase === 'ida' && a.alvo).map((a) => a.alvo!))
  const andando = (quem: AgenteId | 'voce') => andantes.current.some((a) => a.quem === quem && !a.carta)

  useEffect(
    () =>
      useEscritorio.subscribe((s, antes) => {
        if (s.eventos.length === 0 && antes.eventos.length > 0) {
          pendentes.current = []
          andantes.current = andantes.current.filter((a) => !a.pasta)
          pastasNaMesa.current.clear()
          recebeuEm.current.clear()
          return
        }
        const novas = s.entregas.filter((e) => !antes.entregas.some((x) => x.id === e.id))
        pendentes.current.push(...novas)
      }),
    [],
  )

  // ── renderizador, câmera e luzes: uma vez ──
  useEffect(() => {
    const el = caixaRef.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.domElement.className = 'tres-tela'
    el.prepend(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#eceef3')
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400)
    const alvo = new THREE.Vector3(wx(SALA_W / 2), 0.3, wz(140))
    camera.position.copy(alvo).add(new THREE.Vector3(26, 25, 26))
    camera.lookAt(alvo)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.copy(alvo)
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    controls.minZoom = 0.45
    controls.maxZoom = 3.2
    controls.minPolarAngle = 0.35
    controls.maxPolarAngle = 1.25
    controls.screenSpacePanning = false
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }
    controls.update()

    scene.add(new THREE.HemisphereLight('#ffffff', '#d8d2c8', 1.4))
    const sol = new THREE.DirectionalLight('#fff3e0', 2.4)
    sol.castShadow = true
    sol.shadow.mapSize.set(2048, 2048)
    Object.assign(sol.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 80 })
    sol.shadow.radius = 5
    sol.shadow.bias = -0.0005
    sol.shadow.normalBias = 0.02
    scene.add(sol, sol.target)

    const cenario = new THREE.Group()
    const vivos = new THREE.Group()
    scene.add(cenario, vivos)

    // bonecos: os da equipe nas cadeiras, você e o Financeiro atrás das mesas deles
    const bonecos = {} as Record<AgenteId | 'voce' | 'financeiro', Boneco>
    const telas = {} as Record<AgenteId, THREE.Mesh>
    const filas = {} as Record<AgenteId, THREE.Mesh[]>
    const pastasMesa: Record<string, THREE.Mesh> = {}
    for (const a of AGENTES) {
      const m = MESAS[a.id]
      const acao: Acao = { tipo: 'agente', id: a.id }
      const { tela } = mesaDeTrabalho(vivos, wx(m.x + 15), wz(m.y + 8), '#ffffff', acao)
      telas[a.id] = tela
      cadeira(vivos, wx(m.x + 15), wz(m.y + 27), misturar(a.cor, '#1f2330', 0.15), acao)
      const b = boneco(vivos, VISUAL[a.id], acao, a.emTreinamento)
      b.grupo.position.set(wx(m.x + 15), 0, wz(m.y + 26))
      bonecos[a.id] = b
      filas[a.id] = [0, 1, 2, 3].map((k) => {
        const p = caixa(vivos, 0.22, 0.03, 0.16, '#ffffff', wx(m.x + 27) - k * 0.03, 0.775 + k * 0.03, wz(m.y + 12) - k * 0.02, 0.005)
        p.visible = false
        return p
      })
      const pasta = caixa(vivos, 0.3, 0.04, 0.22, '#f2b233', wx(m.x + 5), 0.78, wz(m.y + 12), 0.005)
      pasta.visible = false
      pastasMesa[a.id] = pasta
    }
    {
      const b = boneco(vivos, VISUAL.voce, { tipo: 'voce' })
      b.grupo.position.set(wx(xVoce + MESA_VOCE.x + MESA_VOCE.w / 2), 0, wz(MESA_VOCE.y - 10))
      b.grupo.rotation.y = Math.PI
      bonecos.voce = b
      const pasta = caixa(vivos, 0.3, 0.04, 0.22, '#f2b233', wx(xVoce + MESA_VOCE.x + 26), 0.78, wz(MESA_VOCE.y + 8), 0.005)
      pasta.visible = false
      pastasMesa.voce = pasta
      const f = boneco(vivos, VISUAL_FIN, { tipo: 'financeiro' })
      f.grupo.position.set(wx(xFin + MESA_FIN.x + MESA_FIN.w / 2), 0, wz(MESA_FIN.y - 10))
      f.grupo.rotation.y = Math.PI
      bonecos.financeiro = f
    }
    const anel = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 32), mat('#f2b233', { emissive: '#f2b233', emissiveIntensity: 0.4, side: THREE.DoubleSide }))
    anel.rotation.x = -Math.PI / 2
    anel.position.y = 0.012
    anel.visible = false
    vivos.add(anel)

    tres.current = { renderer, scene, camera, controls, sol, cenario, vivos, bonecos, telas, filas, pastasMesa, anel, cartas: new Map(), alvoCamera: null, tamanho: { w: 1, h: 1 } }

    const ajustar = () => {
      const w = el.clientWidth || 1
      const h = el.clientHeight || 1
      const t = tres.current!
      t.tamanho = { w, h }
      renderer.setSize(w, h, false)
      // no celular a sala da equipe cabe na largura
      const porMetro = Math.min(52, w / (SALA_W * K + 2))
      camera.left = -w / 2 / porMetro
      camera.right = w / 2 / porMetro
      camera.top = h / 2 / porMetro
      camera.bottom = -h / 2 / porMetro
      camera.updateProjectionMatrix()
    }
    ajustar()
    const obs = new ResizeObserver(ajustar)
    obs.observe(el)

    return () => {
      obs.disconnect()
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      tres.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── cenário parado: refeito quando as salas, os quadros ou o gráfico mudam ──
  useEffect(() => {
    const t = tres.current
    if (!t) return
    const c = t.cenario
    c.clear()
    const hoje = new Date().getDate()
    const inicio = origem - 16
    const fim = largura + 16
    const zFundo = wz(PAREDE_H)
    const zFrente = wz(SALA_H)
    const zTopo = wz(0)

    // chão do andar inteiro, o corredor e a parede do fundo, contínuos de ponta a ponta
    chao(c, wx(inicio), zTopo, wx(fim - inicio), wz(ANDAR_H) - zTopo, '#dfe2e8')
    chao(c, wx(inicio), wz(CORREDOR_Y), wx(fim - inicio), wz(ANDAR_H - CORREDOR_Y), '#cfd3dc', 1)
    chao(c, wx(inicio) + 0.3, wz(CORREDOR_Y) + 0.25, wx(fim - inicio) - 0.6, wz(ANDAR_H - CORREDOR_Y) - 0.5, COR_EQUIPE, 2)
    const parede = (x0: number, w: number, cor: string) => {
      caixa(c, w, ALTURA_PAREDE, 0.14, cor, x0 + w / 2, ALTURA_PAREDE / 2, zFundo - 0.07)
    }
    const paredeLateral = (x: number, cor = '#f1f2f5') => caixa(c, 0.14, ALTURA_PAREDE, zFrente - zFundo + 0.14, cor, x, ALTURA_PAREDE / 2, (zFundo + zFrente) / 2 - 0.07)
    const paredeEntre = (xPx: number) => caixa(c, wx(16), ALTURA_PAREDE, zFrente - zFundo + 0.14, '#f1f2f5', wx(xPx + 8), ALTURA_PAREDE / 2, (zFundo + zFrente) / 2 - 0.07)
    /** parede baixa da frente, com a porta aberta */
    const frente = (x0: number, w: number, porta: number, cor: string) => {
      const h = 0.9
      const a = porta - 18 - x0
      const b = x0 + w - (porta + 18)
      if (a > 0) caixa(c, wx(a), h, 0.1, cor, wx(x0 + a / 2), h / 2, zFrente - 0.05, 0.02)
      if (b > 0) caixa(c, wx(b), h, 0.1, cor, wx(x0 + w - b / 2), h / 2, zFrente - 0.05, 0.02)
    }
    const rodape = (x0: number, w: number, cor: string) => caixa(c, wx(w), 0.08, 0.03, cor, wx(x0 + w / 2), 0.04, zFundo + 0.015)
    const janela = (cx: number) => {
      const y = 1.55
      caixa(c, 1.0, 1.1, 0.05, '#e3e6ec', cx, y, zFundo + 0.02)
      const vidro = caixa(c, 0.9, 1.0, 0.06, mat('#cfe3f5', { emissive: '#bcd6f0', emissiveIntensity: 0.5, roughness: 0.1 }), cx, y, zFundo + 0.03)
      vidro.castShadow = false
      caixa(c, 0.03, 1.0, 0.07, '#e3e6ec', cx, y, zFundo + 0.04)
    }
    const divisoriaBaixa = (xa: number, za: number, xb: number, zb: number) => {
      const comp = Math.hypot(xb - xa, zb - za)
      const vert = Math.abs(xb - xa) < 0.01
      const h = 0.9
      caixa(c, vert ? 0.08 : comp, h, vert ? comp : 0.08, '#ffffff', (xa + xb) / 2, h / 2, (za + zb) / 2, 0.03)
      caixa(c, (vert ? 0.08 : comp) + 0.03, 0.04, (vert ? comp : 0.08) + 0.03, PALETA.madeiraClara, (xa + xb) / 2, h + 0.02, (za + zb) / 2, 0.015)
    }
    paredeLateral(wx(inicio) + 0.07)
    paredeLateral(wx(fim) - 0.07)

    // ── sala da equipe ──
    {
      const zHall = wz(PAREDE_DEPTO_Y)
      chao(c, wx(0), zFundo, wx(SALA_W), zFrente - zFundo, '#f4f1ea', 1)
      DEPTOS.forEach((d, i) => chao(c, wx(d.x), zFundo, wx(d.w), zHall - zFundo, i === 2 ? '#4a4f5c' : PISOS_DEPTO[i], 2))
      parede(wx(0), wx(SALA_W), '#ffffff')
      rodape(0, SALA_W, COR_EQUIPE)
      for (const d of [DEPTOS[0], DEPTOS[1], DEPTOS[3]]) {
        if (d !== DEPTOS[0]) janela(wx(d.x + 24))
        janela(wx(d.x + 70))
      }
      // espuma acústica do estúdio
      caixa(c, wx(DEPTOS[2].w - 12), 0.9, 0.05, mat('#3a3e49', { roughness: 1 }), wx(DEPTOS[2].x + DEPTOS[2].w / 2), 1.6, zFundo + 0.02)
      for (const d of DEPTOS.slice(1)) divisoriaBaixa(wx(d.x - 2), zFundo, wx(d.x - 2), zHall)
      let ult = 0
      for (const d of DEPTOS) {
        divisoriaBaixa(wx(ult), zHall, wx(d.porta - 15), zHall)
        ult = d.porta + 15
      }
      divisoriaBaixa(wx(ult), zHall, wx(SALA_W), zHall)
      frente(0, SALA_W, PORTA_X, '#ffffff')
      // estante do Planejamento
      {
        const cx = wx(18)
        caixa(c, 0.9, 1.6, 0.32, PALETA.madeiraClara, cx, 0.8, zFundo + 0.18, 0.02)
        const cores = ['#b74e45', '#2a5288', '#f2b233', '#3f7650', '#6d4f8f', '#c46a2b']
        for (let f = 0; f < 3; f++) for (let k = 0; k < 7; k++) caixa(c, 0.08, 0.3 + ((k * 7 + f) % 3) * 0.03, 0.22, cores[(k + f) % 6], cx - 0.32 + k * 0.105, 0.35 + f * 0.48, zFundo + 0.2)
      }
      // quadro da pauta
      {
        const cx = wx(QUADRO_PAUTA.x + 13)
        const cz = wz(QUADRO_PAUTA.y + 16)
        caixa(c, 0.9, 0.62, 0.04, '#ffffff', cx, 1.15, cz, 0.01)
        for (const sx of [-1, 1]) caixa(c, 0.03, 1.5, 0.03, '#8a8f99', cx + sx * 0.4, 0.75, cz + 0.02)
        const cores = ['#ffd36b', '#ff9b85', '#9fd1ff', '#b6e3a8', '#ffd36b', '#d9b8ff']
        cores.forEach((cor, k) => caixa(c, 0.14, 0.12, 0.01, cor, cx - 0.3 + (k % 3) * 0.3, 1.27 - Math.floor(k / 3) * 0.22, cz + 0.03))
      }
      // estúdio: fundo verde, refletor, tripé e microfone
      {
        const d = DEPTOS[2]
        const cx = wx(d.x + 26)
        const cz = wz(108)
        caixa(c, 1.5, 1.7, 0.05, mat('#3fa66b', { roughness: 0.95 }), cx, 0.85, cz - 0.2, 0.02)
        caixa(c, 1.5, 0.02, 0.9, mat('#3fa66b', { roughness: 0.95 }), cx, 0.01, cz + 0.25)
        const lx = wx(d.x + 70)
        caixa(c, 0.03, 1.6, 0.03, '#222222', lx, 0.8, cz)
        const luz = caixa(c, 0.4, 0.3, 0.12, mat('#fff7e0', { emissive: '#fff2cc', emissiveIntensity: 0.8 }), lx, 1.6, cz, 0.02)
        luz.rotation.y = -0.7
        const tx = wx(d.x + 58)
        const tz = wz(132)
        for (let k = 0; k < 3; k++) {
          const p = caixa(c, 0.025, 1.1, 0.025, '#222222', tx + Math.cos(k * 2.1) * 0.12, 0.53, tz + Math.sin(k * 2.1) * 0.12)
          p.rotation.z = Math.cos(k * 2.1) * 0.2
          p.rotation.x = -Math.sin(k * 2.1) * 0.2
        }
        caixa(c, 0.22, 0.15, 0.3, '#1b1d22', tx, 1.1, tz, 0.02)
        const nm = MESAS.narrador
        caixa(c, 0.02, 0.3, 0.02, '#222222', wx(nm.x + 4), 0.9, wz(nm.y + 4))
        caixa(c, 0.07, 0.12, 0.07, '#444444', wx(nm.x + 4), 1.08, wz(nm.y + 4), 0.03)
      }
      // mesinha da publicação
      {
        const cx = wx(MESINHA_PUBLICACAO.x + 15)
        const cz = wz(MESINHA_PUBLICACAO.y + 8)
        caixa(c, 0.8, 0.05, 0.5, '#ffffff', cx, 0.5, cz, 0.02)
        caixa(c, 0.06, 0.5, 0.06, PALETA.perna, cx, 0.25, cz)
        caixa(c, 0.32, 0.02, 0.22, '#c7ccd6', cx - 0.1, 0.54, cz)
        caixa(c, 0.12, 0.02, 0.22, '#1d1f25', cx + 0.22, 0.54, cz, 0.01)
      }
      // hall: tapete da equipe, sofá, mesa de centro, café e plantas
      chao(c, wx(PORTA_X - 53), wz(185), wx(106), wz(28), COR_EQUIPE, 3)
      sofa(c, wx(48), wz(204), 2.1, '#3d5a80')
      caixa(c, 1.2, 0.05, 0.55, '#ffffff', wx(48), 0.38, wz(204) - 1.0, 0.02)
      for (const k of [-1, 1]) caixa(c, 0.04, 0.36, 0.4, PALETA.perna, wx(48) + k * 0.5, 0.18, wz(204) - 1.0)
      {
        const cx = wx(CAFE.x + 20)
        const cz = wz(CAFE.y + 6)
        caixa(c, 1.6, 0.95, 0.5, '#6b4a32', cx, 0.475, cz, 0.03)
        caixa(c, 1.66, 0.05, 0.56, '#e9e2d6', cx, 0.97, cz, 0.02)
        caixa(c, 0.3, 0.38, 0.28, '#1f2125', cx - 0.4, 1.18, cz, 0.03)
        for (let k = 0; k < 3; k++) cilindro(c, 0.04, 0.035, 0.09, '#ffffff', cx + 0.1 + k * 0.14, 1.04, cz + 0.05, 14)
      }
      planta(c, wx(10), wz(228), 0.9)
      planta(c, wx(SALA_W - 12), wz(228), 0.9)
      planta(c, wx(SALA_W - 12), wz(170), 0.8)
      planta(c, wx(DEPTOS[3].x + 82), wz(46), 0.7)
    }

    // ── salas das marcas ──
    marcas.forEach((m, i) => {
      const x0 = xMarca(i)
      const e = estiloDe(m, i)
      const q = quadros?.[m.id]
      const cor = corDe(m)
      chao(c, wx(x0), zFundo, wx(MARCA_W), zFrente - zFundo, e.piso, 1)
      parede(wx(x0), wx(MARCA_W), e.parede)
      rodape(x0, MARCA_W, e.rodape)
      paredeEntre(x0 + MARCA_W)
      frente(x0, MARCA_W, x0 + PORTA_MARCA, e.parede)
      // quadros da parede: referências, calendário, branding e regras
      const dias = new Set(q?.dias ?? [])
      const texs: Record<Quadro, THREE.Texture> = {
        referencias: textura(256, 192, (g, w, h) => {
          g.fillStyle = '#fbfaf6'
          g.fillRect(0, 0, w, h)
          const cores = ['#e8c9a0', '#9fb7d9', '#b8d8b0', '#e9a4a4', '#d9c3e8', '#f2d9a0']
          for (let k = 0; k < 6; k++) {
            g.fillStyle = k < (q?.referencias ?? 0) ? cores[k] : '#e6e6e2'
            g.fillRect(14 + (k % 3) * 80, 14 + Math.floor(k / 3) * 86, 68, 74)
          }
          g.fillStyle = '#1f2330'
          g.font = 'bold 22px Inter, sans-serif'
          g.textAlign = 'right'
          g.fillText(String(q?.referencias ?? 0), w - 10, h - 8)
        }),
        calendario: textura(256, 192, (g, w, h) => {
          g.fillStyle = '#fbfaf6'
          g.fillRect(0, 0, w, h)
          g.fillStyle = cor
          g.fillRect(0, 0, w, 26)
          const pw = (w - 16) / 7
          const ph = (h - 40) / 5
          for (let d = 1; d <= 31; d++) {
            const cx = 8 + ((d - 1) % 7) * pw
            const cy = 32 + Math.floor((d - 1) / 7) * ph
            g.fillStyle = dias.has(d) ? cor : '#e9e9e4'
            g.fillRect(cx + 2, cy + 2, pw - 4, ph - 4)
            if (d === hoje) {
              g.strokeStyle = '#1f2330'
              g.lineWidth = 3
              g.strokeRect(cx + 2, cy + 2, pw - 4, ph - 4)
            }
          }
        }),
        branding: textura(256, 192, (g, w, h) => {
          g.fillStyle = '#fbfaf6'
          g.fillRect(0, 0, w, h)
          g.fillStyle = cor
          g.beginPath()
          g.arc(w / 2, 74, 46, 0, Math.PI * 2)
          g.fill()
          const tons = [misturar(cor, '#ffffff', 0.55), cor, misturar(cor, '#1f2330', 0.4)]
          tons.forEach((t, k) => {
            g.fillStyle = t
            g.fillRect(40 + k * 62, 136, 54, 34)
          })
        }),
        regras: textura(256, 192, (g, w, h) => {
          g.fillStyle = '#fbfaf6'
          g.fillRect(0, 0, w, h)
          g.fillStyle = '#1f2330'
          g.fillRect(0, 0, w, 22)
          const n = q?.regras ?? 0
          for (let k = 0; k < 6; k++) {
            g.fillStyle = k < n ? '#3f7650' : '#e6e6e2'
            g.fillRect(16, 36 + k * 24, 10, 10)
            g.fillStyle = k < n ? '#c9c3b4' : '#ededea'
            g.fillRect(36, 38 + k * 24, 120 + ((k * 37) % 70), 6)
          }
          g.fillStyle = '#1f2330'
          g.font = 'bold 22px Inter, sans-serif'
          g.textAlign = 'right'
          g.fillText(String(n), w - 10, h - 8)
        }),
      }
      for (const [nome, r] of Object.entries(QUADROS) as [Quadro, (typeof QUADROS)[Quadro]][]) {
        quadroNaParede(c, wx(x0 + r.x + r.w / 2), 1.5, zFundo, wx(r.w), wx(r.w) * 0.75, texs[nome], { tipo: 'quadro', marca: m.id, quadro: nome })
      }
      // tapete da marca com o nome por cima (etiqueta HTML)
      chao(c, wx(x0 + (MARCA_W - 120) / 2), wz(PLACA.y - 17), wx(120), wz(34), e.rodape, 3)
      chao(c, wx(x0 + 6), wz(46), wx(72), wz(40), misturar(e.tapete, '#ffffff', 0.2), 2)
      chao(c, wx(x0 + 98), wz(46), wx(72), wz(40), misturar(e.tapete, '#ffffff', 0.2), 2)
      // escrivaninha de pedidos: mesa com máquina de escrever e a folha
      {
        const a: Acao = { tipo: 'novo', marca: m.id, sala: i }
        const cx = wx(x0 + NOVO_POST.x + NOVO_POST.w / 2)
        const cz = wz(NOVO_POST.y + 18)
        caixa(c, 1.2, 0.05, 0.6, e.mesa, cx, 0.74, cz, 0.02, a)
        for (const sx of [-1, 1]) caixa(c, 0.05, 0.72, 0.5, PALETA.perna, cx + sx * 0.55, 0.36, cz, 0, a)
        caixa(c, 0.42, 0.18, 0.3, '#2b2f3a', cx, 0.86, cz, 0.03, a)
        caixa(c, 0.3, 0.3, 0.01, '#ffffff', cx, 1.1, cz - 0.1, 0, a)
        caixa(c, 0.12, 0.03, 0.01, cor, cx, 1.12, cz - 0.095, 0, a)
        caixa(c, 0.03, 0.12, 0.01, cor, cx, 1.12, cz - 0.095, 0, a)
      }
      // celular no suporte: tela colorida quando o Instagram está ligado
      {
        const a: Acao = { tipo: 'instagram', marca: m.id, sala: i }
        const cx = wx(x0 + INSTAGRAM.x + INSTAGRAM.w / 2)
        const cz = wz(INSTAGRAM.y + 24)
        caixa(c, 0.4, 0.5, 0.3, '#ffffff', cx, 0.25, cz, 0.02, a)
        caixa(c, 0.22, 0.44, 0.03, '#1f2330', cx, 0.78, cz, 0.02, a)
        const telaCor = m.instagram ? (m.instagramAviso ? '#ffd84d' : '#ee2a7b') : '#5a6070'
        const tl = caixa(c, 0.18, 0.38, 0.01, mat(telaCor, { emissive: telaCor, emissiveIntensity: m.instagram ? 0.7 : 0.1 }), cx, 0.78, cz + 0.02, 0, a)
        tl.castShadow = false
      }
      // cofrinho
      {
        const a: Acao = { tipo: 'cofre', marca: m.id, sala: i }
        const cx = wx(x0 + COFRINHO.x + COFRINHO.w / 2)
        const cz = wz(COFRINHO.y + 14)
        caixa(c, 0.7, 0.5, 0.5, '#ffffff', cx, 0.25, cz, 0.02, a)
        caixa(c, 0.5, 0.36, 0.34, '#f2a6b8', cx, 0.7, cz, 0.12, a)
        caixa(c, 0.12, 0.1, 0.1, '#f2a6b8', cx + 0.27, 0.66, cz, 0.03, a)
        caixa(c, 0.16, 0.02, 0.05, '#c96a85', cx, 0.89, cz, 0, a)
      }
      // gaveta de posts: cômoda com uma gaveta aberta
      {
        const a: Acao = { tipo: 'gaveta', marca: m.id, sala: i }
        const cx = wx(x0 + GAVETA.x + GAVETA.w / 2)
        const cz = wz(GAVETA.y + 16)
        caixa(c, 1.0, 0.9, 0.55, e.mesa, cx, 0.45, cz, 0.02, a)
        caixa(c, 0.86, 0.22, 0.4, misturar(e.mesa, '#1f2330', 0.15), cx, 0.72, cz + 0.3, 0.02, a)
        const n = Math.min(5, q?.gaveta ?? 0)
        for (let k = 0; k < n; k++) caixa(c, 0.1, 0.22, 0.3, [cor, '#f2b233', '#3f7650', '#b74e45', '#6d4f8f'][k], cx - 0.3 + k * 0.15, 0.9, cz + 0.3, 0.01, a)
        caixa(c, 0.3, 0.03, 0.03, '#1f2330', cx, 0.3, cz + 0.29, 0, a)
      }
      // kit de decoração: cavalete com a sala pintada
      {
        const a: Acao = { tipo: 'decorar', marca: m.id, sala: i }
        const cx = wx(x0 + DECORAR.x + DECORAR.w / 2)
        const cz = wz(DECORAR.y + 14)
        for (const sx of [-1, 1]) {
          const p = caixa(c, 0.04, 1.3, 0.04, PALETA.madeiraClara, cx + sx * 0.3, 0.65, cz, 0, a)
          p.rotation.z = -sx * 0.12
        }
        const p = caixa(c, 0.04, 1.3, 0.04, PALETA.madeiraClara, cx, 0.65, cz + 0.3, 0, a)
        p.rotation.x = -0.25
        caixa(c, 0.6, 0.5, 0.03, '#ffffff', cx, 0.95, cz - 0.02, 0.01, a)
        caixa(c, 0.5, 0.18, 0.01, e.piso, cx, 0.86, cz, 0, a)
        caixa(c, 0.5, 0.2, 0.01, e.parede, cx, 1.05, cz, 0, a)
      }
      planta(c, wx(x0 + MARCA_W - 20), wz(154), 0.8)
    })

    // ── sua sala ──
    {
      paredeEntre(SALA_W)
      chao(c, wx(xVoce), zFundo, wx(VOCE_W), zFrente - zFundo, '#c9a27a', 1)
      parede(wx(xVoce), wx(VOCE_W), '#1e3d66')
      rodape(xVoce, VOCE_W, '#b88a3a')
      frente(xVoce, VOCE_W, xVoce + PORTA_VOCE_X, '#1e3d66')
      // calendário da parede
      const tex = textura(256, 192, (g, w, h) => {
        g.fillStyle = '#fbfaf6'
        g.fillRect(0, 0, w, h)
        g.fillStyle = '#1e3d66'
        g.fillRect(0, 0, w, 26)
        const pw = (w - 16) / 7
        const ph = (h - 40) / 5
        for (let d = 1; d <= 31; d++) {
          const cx = 8 + ((d - 1) % 7) * pw
          const cy = 32 + Math.floor((d - 1) / 7) * ph
          g.fillStyle = diasMarcados.has(d) ? '#f2b233' : '#e9e9e4'
          g.fillRect(cx + 2, cy + 2, pw - 4, ph - 4)
          if (d === hoje) {
            g.strokeStyle = '#1f2330'
            g.lineWidth = 3
            g.strokeRect(cx + 2, cy + 2, pw - 4, ph - 4)
          }
        }
      })
      quadroNaParede(c, wx(xVoce + CALENDARIO.x + CALENDARIO.w / 2), 1.55, zFundo, 1.3, 0.95, tex, { tipo: 'calendario' })
      janela(wx(xVoce + 118))
      // a sua mesa, de madeira escura
      const a: Acao = { tipo: 'voce' }
      const cx = wx(xVoce + MESA_VOCE.x + MESA_VOCE.w / 2)
      const cz = wz(MESA_VOCE.y + 8)
      caixa(c, 1.5, 0.06, 0.7, '#5a3a24', cx, 0.74, cz, 0.02, a)
      for (const sx of [-1, 1]) caixa(c, 0.5, 0.7, 0.6, '#3d2817', cx + sx * 0.5, 0.35, cz, 0.02, a)
      caixa(c, 0.5, 0.34, 0.03, PALETA.monitor, cx - 0.1, 0.95, cz - 0.15, 0.015, a)
      caixa(c, 0.06, 0.1, 0.06, PALETA.monitor, cx - 0.1, 0.8, cz - 0.15, 0, a)
      for (let k = 0; k < Math.min(naSuaMesa, 6); k++) caixa(c, 0.3, 0.04, 0.22, k % 2 ? '#ffd36b' : '#f2b233', cx + 0.5, 0.79 + k * 0.045, cz + 0.1, 0.005, a)
      cadeira(c, cx, wz(MESA_VOCE.y - 10), '#7a3b2a', a).rotation.y = Math.PI
      chao(c, wx(xVoce + 20), wz(130), wx(120), wz(60), '#7a2e2e', 2)
      sofa(c, wx(xVoce + 36), wz(190), 1.6, '#8a2f2a')
      planta(c, wx(xVoce + VOCE_W - 14), wz(226), 0.9)
    }

    // ── Financeiro ──
    {
      paredeEntre(xVoce + VOCE_W)
      chao(c, wx(xFin), zFundo, wx(FIN_W), zFrente - zFundo, '#e9e6df', 1)
      parede(wx(xFin), wx(FIN_W), '#2f5d47')
      rodape(xFin, FIN_W, '#3f7650')
      frente(xFin, FIN_W, xFin + PORTA_FIN_X, '#2f5d47')
      const barras = financeiro?.barras ?? []
      const alerta = !!financeiro?.alerta
      const tex = textura(256, 160, (g, w, h) => {
        g.fillStyle = '#fbfaf6'
        g.fillRect(0, 0, w, h)
        g.fillStyle = alerta ? '#b74e45' : '#3f7650'
        g.fillRect(0, 0, w, 20)
        const n = Math.max(1, barras.length)
        const max = Math.max(...barras, 0.0001)
        const larg = (w - 24) / n
        barras.forEach((v, i) => {
          const alt = Math.max(3, ((v / max) * (h - 50)) | 0)
          g.fillStyle = i === n - 1 ? (alerta ? '#b74e45' : '#3f7650') : '#9fb8a6'
          g.fillRect(12 + i * larg + 2, h - 16 - alt, larg - 4, alt)
        })
        g.fillStyle = '#c9c3b4'
        g.fillRect(10, h - 16, w - 20, 2)
      })
      quadroNaParede(c, wx(xFin + GRAFICO_FIN.x + GRAFICO_FIN.w / 2), 1.55, zFundo, 1.8, 1.1, tex, { tipo: 'financeiro' })
      const a: Acao = { tipo: 'financeiro' }
      const cx = wx(xFin + MESA_FIN.x + MESA_FIN.w / 2)
      const cz = wz(MESA_FIN.y + 8)
      caixa(c, 1.5, 0.06, 0.7, '#ffffff', cx, 0.74, cz, 0.02, a)
      for (const sx of [-1, 1]) caixa(c, 0.05, 0.72, 0.6, PALETA.perna, cx + sx * 0.7, 0.36, cz, 0, a)
      caixa(c, 0.5, 0.34, 0.03, PALETA.monitor, cx + 0.1, 0.95, cz - 0.15, 0.015, a)
      caixa(c, 0.06, 0.1, 0.06, PALETA.monitor, cx + 0.1, 0.8, cz - 0.15, 0, a)
      caixa(c, 0.3, 0.2, 0.2, '#3f7650', cx - 0.5, 0.86, cz, 0.02, a)
      cadeira(c, cx, wz(MESA_FIN.y - 10), '#3f7650', a).rotation.y = Math.PI
      chao(c, wx(xFin + 14), wz(130), wx(100), wz(60), '#cfe0d2', 2)
      planta(c, wx(xFin + FIN_W - 14), wz(226), 0.9)
      planta(c, wx(xFin + 12), wz(226), 0.9)
    }
  }, [marcas, quadros, financeiro?.barras.join(','), financeiro?.alerta, diasMarcados, naSuaMesa]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── laço de animação ──
  useEffect(() => {
    const t = tres.current
    if (!t) return
    let quadroId = 0
    let anterior = performance.now()
    let proximoPasseio = performance.now() + 30000
    const tmp = new THREE.Vector3()
    const posicoes: Record<string, THREE.Vector3 | null> = {}
    const corTela = new THREE.Color()

    const desenhar = (agora: number) => {
      const dt = Math.min((agora - anterior) / 1000, 0.05)
      anterior = agora
      const seg = agora / 1000
      const v = vivo.current
      const marcas = marcasRef.current
      const { camera, controls, renderer, scene, sol, bonecos, telas, filas, pastasMesa, anel, cartas, tamanho } = t

      const marcaAberta = marcas[v.indiceAtivo]?.id
      const chegandoAgora = aCaminhoDe()
      const estadoNaTela = (id: AgenteId): Estado => {
        if (chegandoAgora.has(id) || pendentes.current.some((e) => e.de === id || e.para === id)) return 'na_fila'
        let melhor: Estado = v.estados[id] ?? 'ocioso'
        for (const m of marcas) {
          if (m.id === marcaAberta) continue
          const e = v.porSala?.[m.id]?.[id]
          if (e && e !== 'concluido' && PRIORIDADE.indexOf(e) < PRIORIDADE.indexOf(melhor)) melhor = e
        }
        return melhor
      }
      const outrosTrabalhos = (id: AgenteId) => marcas.filter((m) => m.id !== marcaAberta && ['trabalhando', 'na_fila', 'esperando_voce'].includes(v.porSala?.[m.id]?.[id] ?? ''))

      // passeio até o café de vez em quando
      if (agora > proximoPasseio && !andantes.current.some((a) => !a.pasta)) {
        proximoPasseio = agora + 40000 + Math.random() * 40000
        const livres = AGENTES.filter((a) => !andando(a.id) && !['trabalhando', 'na_fila', 'esperando_voce'].includes(estadoNaTela(a.id)))
        const a = livres[Math.floor(Math.random() * livres.length)]
        if (a) {
          const ida: Ponto[] = [...ateOHall(MESAS[a.id]), [CAFE.x + 16, LINHA_HALL]]
          andantes.current.push({ id: `cafe-${agora}`, quem: a.id, ida, volta: [...ida].reverse(), fase: 'ida', dist: 0, parouEm: 0, pasta: false })
        }
      }

      // solta as entregas da fila, na ordem
      const chegando = aCaminhoDe()
      pendentes.current = pendentes.current.filter((e) => {
        if (chegando.has(e.de)) return true
        if (pendentes.current.some((x) => x !== e && x.para === e.de && pendentes.current.indexOf(x) < pendentes.current.indexOf(e))) return true
        const recebeu = recebeuEm.current.get(e.de)
        if (recebeu !== undefined && agora - recebeu < TEMPO_MINIMO_NA_MESA) return true
        const emPe = andantes.current.find((a) => a.quem === e.de && !a.carta)
        if (emPe) {
          if (!emPe.pasta && emPe.fase !== 'volta') {
            emPe.dist = emPe.fase === 'ida' ? comprimento(emPe.ida) - emPe.dist : 0
            emPe.fase = 'volta'
          }
          return true
        }
        if (e.de === 'voce' && e.para !== 'voce') {
          const m = MESAS[e.para]
          const ida: Ponto[] = [[xVoce + MESA_VOCE.x + 25, MESA_VOCE.y + 4], [m.x + 15, m.y + 2]]
          andantes.current.push({ id: e.id, quem: 'voce', ida, volta: ida, fase: 'ida', dist: 0, parouEm: 0, pasta: false, carta: true, alvo: e.para })
          chegando.add(e.para)
          return false
        }
        const ida = caminho(e.de, e.para)
        andantes.current.push({ id: e.id, quem: e.de, ida, volta: [...ida].reverse(), fase: 'ida', dist: 0, parouEm: 0, pasta: true, alvo: e.para })
        chegando.add(e.para)
        return false
      })
      const pastaEmVoce = !chegando.has('voce') && !pendentes.current.some((e) => e.para === 'voce')
      if (pastaEmVoce !== pastaEmVoceRef.current) {
        pastaEmVoceRef.current = pastaEmVoce
        setPastaChegouEmVoce(pastaEmVoce)
      }
      const voceAguardando = v.aguardando && pastaEmVoce

      // anda com quem está andando
      for (const a of andantes.current) {
        if (a.fase === 'parado') {
          if (agora - a.parouEm > (a.pasta ? 700 : 2200)) {
            a.fase = 'volta'
            a.dist = 0
            a.pasta = false
          }
          continue
        }
        const rota = a.fase === 'ida' ? a.ida : a.volta
        a.dist += (a.carta ? Math.max(120, comprimento(rota) / 1.8) : Math.max(VELOCIDADE, comprimento(rota) / 6)) * dt
        if (a.dist >= comprimento(rota)) {
          if (a.carta) {
            pastasNaMesa.current.set(a.alvo!, agora)
            recebeuEm.current.set(a.alvo!, agora)
            a.dist = -1
          } else if (a.fase === 'ida') {
            a.fase = 'parado'
            a.parouEm = agora
            if (a.alvo) {
              pastasNaMesa.current.set(a.alvo, agora)
              recebeuEm.current.set(a.alvo, agora)
              if (a.alvo === 'voce') tocarAviso()
            }
          } else a.dist = -1
        }
      }
      andantes.current = andantes.current.filter((a) => a.dist >= 0)

      // pastas em cima das mesas (acabou de chegar) e a fila de outras marcas
      for (const [chave, quando] of pastasNaMesa.current) if (agora - quando > 6000) pastasNaMesa.current.delete(chave)
      for (const [chave, p] of Object.entries(pastasMesa)) p.visible = pastasNaMesa.current.has(chave)
      for (const a of AGENTES) {
        const outros = outrosTrabalhos(a.id).slice(0, 4)
        filas[a.id].forEach((p, k) => {
          const m = outros[k]
          p.visible = !!m
          if (m && p.material !== mat(corDe(m))) p.material = mat(corDe(m))
        })
      }

      // bonecos sentados, telas e etiquetas
      const emPe = new Set<string>()
      for (const a of AGENTES) {
        const b = bonecos[a.id]
        const m = MESAS[a.id]
        const est = estadoNaTela(a.id)
        const desde = (agora - (v.mudouEm[a.id] ?? 0)) / 1000
        const andandoAgora = andando(a.id)
        b.sentado.visible = !andandoAgora
        b.emPe.visible = andandoAgora
        if (!andandoAgora) {
          let dy = 0
          if (est === 'trabalhando') dy = Math.sin(seg * 9) * 0.01
          if (est === 'concluido' && desde < 0.6) dy = Math.sin((desde / 0.6) * Math.PI) * 0.25
          b.grupo.position.set(wx(m.x + 15), dy, wz(m.y + 26))
          b.grupo.rotation.y = 0
          posicoes[a.id] = new THREE.Vector3(wx(m.x + 15), 1.75, wz(m.y + 26))
        }
        // a tela do monitor conta o que ele está fazendo
        const tela = telas[a.id].material as THREE.MeshStandardMaterial
        if (est === 'trabalhando') {
          corTela.set(a.cor)
          tela.emissiveIntensity = 0.6 + Math.sin(seg * 6) * 0.25
        } else if (est === 'concluido') {
          corTela.set('#7fd197')
          tela.emissiveIntensity = 0.6
        } else if (est === 'erro') {
          corTela.set('#e05a4f')
          tela.emissiveIntensity = Math.floor(seg * 3) % 2 ? 0.9 : 0.2
        } else if (est === 'esperando_voce') {
          corTela.set('#f2b233')
          tela.emissiveIntensity = 0.6
        } else {
          corTela.set(PALETA.tela)
          tela.emissiveIntensity = 0.35
        }
        tela.color.copy(corTela)
        tela.emissive.copy(corTela)
      }
      {
        const b = bonecos.voce
        const andandoVoce = andando('voce')
        b.sentado.visible = !andandoVoce
        b.emPe.visible = andandoVoce
        if (!andandoVoce) {
          const pulo = voceAguardando ? Math.abs(Math.sin(seg * 7)) * 0.12 : 0
          b.grupo.position.set(wx(xVoce + MESA_VOCE.x + MESA_VOCE.w / 2), pulo, wz(MESA_VOCE.y - 10))
          b.grupo.rotation.y = Math.PI
          posicoes.voce = new THREE.Vector3(wx(xVoce + MESA_VOCE.x + MESA_VOCE.w / 2), 1.75 + pulo, wz(MESA_VOCE.y - 10))
        }
        posicoes.financeiro = new THREE.Vector3(wx(xFin + MESA_FIN.x + MESA_FIN.w / 2), 1.75, wz(MESA_FIN.y - 10))
      }

      // quem está andando e as cartas voando
      const vistas = new Set<string>()
      for (const a of andantes.current) {
        if (a.carta) {
          vistas.add(a.id)
          let c = cartas.get(a.id)
          if (!c) {
            c = caixa(t.vivos, 0.3, 0.02, 0.2, '#ffffff', 0, 0, 0, 0.005)
            caixa(c, 0.3, 0.025, 0.04, '#b74e45', 0, 0, 0)
            cartas.set(a.id, c)
          }
          const total = comprimento(a.ida)
          const k = total ? Math.max(0, a.dist) / total : 1
          const p = noCaminho(a.ida, k * total)
          const altura = Math.min(2.5, 0.9 + total / 320)
          c.position.set(wx(p.x), 0.9 + Math.sin(k * Math.PI) * altura, wz(p.y))
          c.rotation.z = Math.sin(seg * 14) * 0.15
          continue
        }
        const rota = a.fase === 'volta' ? a.volta : a.ida
        const p = noCaminho(rota, Math.max(0, a.fase === 'parado' ? comprimento(a.ida) : a.dist))
        const b = bonecos[a.quem]
        const parado = a.fase === 'parado'
        const bob = parado ? 0 : Math.abs(Math.sin(seg * 10)) * 0.04
        b.grupo.position.set(wx(p.x), bob, wz(p.y))
        const dir = parado ? 'cima' : p.dir
        b.grupo.rotation.y = dir === 'cima' ? 0 : dir === 'baixo' ? Math.PI : dir === 'esquerda' ? Math.PI / 2 : -Math.PI / 2
        b.pasta.visible = a.pasta
        posicoes[a.quem] = new THREE.Vector3(wx(p.x), 1.95, wz(p.y))
        emPe.add(a.quem)
      }
      for (const [id, c] of cartas) {
        if (vistas.has(id)) continue
        t.vivos.remove(c)
        cartas.delete(id)
      }

      // anel embaixo de quem está selecionado
      const sel = v.selecionado
      anel.visible = !!sel
      if (sel) {
        const p = bonecos[sel].grupo.position
        anel.position.set(p.x, 0.012, p.z)
        anel.rotation.z = seg * 0.8
      }

      // câmera: vai até a sala pedida na barra; o sol acompanha para a sombra cobrir o que está na tela
      if (t.alvoCamera) {
        tmp.copy(t.alvoCamera).sub(controls.target)
        if (tmp.length() < 0.02) t.alvoCamera = null
        else {
          tmp.multiplyScalar(Math.min(1, dt * 6))
          controls.target.add(tmp)
          camera.position.add(tmp)
        }
      }
      controls.update()
      sol.position.copy(controls.target).add(new THREE.Vector3(-6, 12, 7))
      sol.target.position.copy(controls.target)
      renderer.render(scene, camera)

      // etiquetas em HTML por cima dos bonecos, das placas e dos objetos
      const { w, h } = tamanho
      const esperandoPasta = (id: AgenteId) => chegando.has(id) || pendentes.current.some((e) => e.de === id || e.para === id)
      for (const [chave, el] of etiquetas.current) {
        let pos: THREE.Vector3 | null = null
        let ancora: 'baixo' | 'centro' | 'cima' = 'baixo'
        if (chave.startsWith('placa:')) {
          const equipe = chave === 'placa:equipe'
          pos = equipe ? tmp.set(wx(SALA_W / 2), 0.05, wz(199)) : tmp.set(wx(xMarca(Number(chave.slice(6))) + PLACA.x), 0.05, wz(PLACA.y))
          ancora = 'centro'
        } else if (chave.startsWith('depto:')) {
          const d = DEPTOS[Number(chave.slice(6))]
          pos = tmp.set(wx(d.x + d.w / 2), ALTURA_PAREDE + 0.2, wz(PAREDE_H))
        } else if (/^(cofre|decorar|gaveta|novo|instagram):/.test(chave)) {
          const [tipo, n] = chave.split(':')
          const s = Number(n)
          const ref = tipo === 'cofre' ? COFRINHO : tipo === 'gaveta' ? GAVETA : tipo === 'novo' ? NOVO_POST : tipo === 'instagram' ? INSTAGRAM : DECORAR
          pos = tmp.set(wx(xMarca(s) + ref.x + ref.w / 2), 1.4, wz(ref.y + 14))
        } else {
          const nome = chave.startsWith('nome:')
          const id = nome ? chave.slice(5) : chave
          const p = !nome && id !== 'voce' && id !== 'financeiro' && esperandoPasta(id as AgenteId) ? null : posicoes[id]
          if (p) {
            pos = tmp.copy(p)
            if (nome) pos.y -= emPe.has(id) ? 1.95 : 1.75
            ancora = nome ? 'cima' : 'baixo'
          }
        }
        if (!pos) {
          el.style.opacity = '0'
          continue
        }
        const s = projetar(pos, camera, w, h)
        el.style.opacity = s.visivel ? '1' : '0'
        el.style.zIndex = String(chave.startsWith('nome:') ? 100 + Math.round(s.y) : 1000)
        el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, ${ancora === 'baixo' ? '-100%' : ancora === 'centro' ? '-50%' : '0'})`
      }
      quadroId = requestAnimationFrame(desenhar)
    }
    quadroId = requestAnimationFrame(desenhar)
    return () => cancelAnimationFrame(quadroId)
  }, [xVoce, xFin, marcas.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── cliques: o que está embaixo do ponteiro ──
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const acaoEm = (ev: React.PointerEvent): Acao | null => {
    const t = tres.current
    if (!t) return null
    const rect = t.renderer.domElement.getBoundingClientRect()
    const p = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(p, t.camera)
    const hits = raycaster.intersectObjects([t.cenario, t.vivos], true)
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object
      while (o) {
        if (o.userData.acao) return o.userData.acao as Acao
        o = o.parent
      }
    }
    return null
  }
  const clicar = (acao: Acao | null) => {
    if (!acao) {
      focar(null)
      return selecionar(null)
    }
    if (acao.tipo === 'agente') return selecionar(acao.id as AgenteId)
    if (acao.tipo === 'voce') return focar('voce')
    if (acao.tipo === 'calendario') return focar('calendario')
    if (acao.tipo === 'financeiro') return focar('financeiro')
    if (marcas[indiceAtivo]?.id !== acao.marca) aoEscolherMarca(acao.marca)
    if (acao.tipo === 'quadro') {
      selecionar(null)
      return aoAbrirQuadro?.(acao.marca, acao.quadro)
    }
    if (acao.tipo === 'cofre') return focar('cofre')
    if (acao.tipo === 'gaveta') return focar('gaveta')
    if (acao.tipo === 'decorar') return aoEditarSala?.(acao.marca)
    if (acao.tipo === 'novo') return aoNovoPost?.(acao.marca)
    if (acao.tipo === 'instagram') return aoConectarInstagram?.(acao.marca)
  }
  const apertou = useRef<{ x: number; y: number } | null>(null)

  const irPara = (alvo: AlvoDaBarra) => {
    focar(null)
    const t = tres.current
    if (!t) return
    if (typeof alvo === 'object') {
      const i = marcas.findIndex((m) => m.id === alvo.marca)
      if (i >= 0) t.alvoCamera = new THREE.Vector3(wx(xMarca(i) + MARCA_W / 2), 0.3, wz(140))
      return aoEscolherMarca(alvo.marca)
    }
    const cx = alvo === 'equipe' ? SALA_W / 2 : alvo === 'voce' ? xVoce + VOCE_W / 2 : xFin + FIN_W / 2
    t.alvoCamera = new THREE.Vector3(wx(cx), 0.3, wz(140))
  }

  const nomes: (AgenteId | 'voce')[] = [...AGENTES.map((a) => a.id), 'voce']
  const ref = (chave: string) => (el: HTMLDivElement | null) => {
    if (el) etiquetas.current.set(chave, el)
    else etiquetas.current.delete(chave)
  }
  return (
    <div
      className="pixel tres"
      ref={caixaRef}
      onPointerDown={(e) => {
        apertou.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse' || apertou.current) return
        const a = acaoEm(e)
        const chave = a && 'sala' in a ? `${a.tipo}:${a.sala}` : null
        if (chave !== sobre) setSobre(chave)
        const t = tres.current
        if (t) t.renderer.domElement.style.cursor = a ? 'pointer' : ''
      }}
      onPointerUp={(e) => {
        const a = apertou.current
        apertou.current = null
        if (!a || Math.hypot(e.clientX - a.x, e.clientY - a.y) > 5) return
        if ((e.target as HTMLElement).tagName !== 'CANVAS') return
        clicar(acaoEm(e))
      }}
    >
      <BarraSalas marcas={marcas} indiceAtivo={indiceAtivo} estados={estados} porSala={porSala} naSuaMesa={naSuaMesa} aoReordenar={aoReordenar} irPara={irPara} corDe={corDe} />
      {nomes.map((id) => {
        const est = id === 'voce' ? null : estados[id]
        const acao = id !== 'voce' && (est === 'trabalhando' || est === 'esperando_voce' || est === 'na_fila') ? acoes[id] : null
        const ag = id === 'voce' ? null : agentePorId(id)
        return (
          <Fragment key={id}>
            <div className="tres-etiqueta" ref={ref(id)}>
              {id === 'voce' && aguardando && pastaChegouEmVoce && <div className="balao balao-esperando_voce">{naSuaMesa > 1 ? `${naSuaMesa} posts esperando você!` : 'Post esperando você!'}</div>}
              {acao && <div key={acao} className="balao">{acao}</div>}
            </div>
            <div className="tres-etiqueta" ref={ref(`nome:${id}`)}>
              <div className={`nome${est ? ` nome-${est}` : ''}${selecionado === id ? ' ativo' : ''}`} style={{ ['--cor' as string]: ag?.cor ?? '#1e3d66' }}>
                <span className="ponto" style={{ background: est ? COR_ESTADO[est] : '#f2b233' }} />
                {ag ? (
                  <>
                    <span className="so-largo">{ag.nome}</span>
                    <span className="so-estreito">{ag.curto}</span>
                    {ag.emTreinamento && <small>em treinamento</small>}
                  </>
                ) : (
                  'Você'
                )}
              </div>
            </div>
          </Fragment>
        )
      })}
      <div className="tres-etiqueta" ref={ref('nome:financeiro')}>
        <div className={`nome${foco === 'financeiro' ? ' ativo' : ''}`} style={{ ['--cor' as string]: '#3f7650' }}>
          <span className="ponto" style={{ background: '#3f7650' }} />
          Financeiro
        </div>
      </div>
      {DEPTOS.map((d, n) => (
        <div key={d.id} className="tres-etiqueta" ref={ref(`depto:${n}`)}>
          <div className="tres-depto">
            <span className="so-largo">{d.nome}</span>
            <span className="so-estreito">{d.curto}</span>
          </div>
        </div>
      ))}
      <div className="tres-etiqueta" ref={ref('placa:equipe')}>
        <div className="tres-placa" style={{ background: COR_EQUIPE }}>Equipe</div>
      </div>
      {marcas.map((m, s) => (
        <Fragment key={m.id}>
          <div className="tres-etiqueta" ref={ref(`placa:${s}`)}>
            <div className="tres-placa" style={{ background: corDe(m) }}>{m.nome}</div>
          </div>
          <div className="tres-etiqueta" ref={ref(`cofre:${s}`)}>
            {cofres?.[m.id] && (sobre === `cofre:${s}` || (foco === 'cofre' && s === indiceAtivo)) && <div className={`nome${foco === 'cofre' && s === indiceAtivo ? ' ativo' : ''}`}>{cofres[m.id]}</div>}
          </div>
          <div className="tres-etiqueta" ref={ref(`gaveta:${s}`)}>
            {(sobre === `gaveta:${s}` || (foco === 'gaveta' && s === indiceAtivo)) && <div className={`nome${foco === 'gaveta' && s === indiceAtivo ? ' ativo' : ''}`}>Gaveta · {quadros?.[m.id]?.gaveta ?? 0}</div>}
          </div>
          <div className="tres-etiqueta" ref={ref(`novo:${s}`)}>
            {sobre === `novo:${s}` && <div className="nome">Novo post</div>}
          </div>
          <div className="tres-etiqueta" ref={ref(`instagram:${s}`)}>
            {sobre === `instagram:${s}` && <div className={`nome${m.instagram ? (m.instagramAviso ? ' instagram-aviso' : ' instagram') : ''}`}>{m.instagram ? (m.instagramAviso ?? 'Instagram conectado') : 'Conectar Instagram'}</div>}
          </div>
          <div className="tres-etiqueta" ref={ref(`decorar:${s}`)}>
            {(sobre === `decorar:${s}` || (foco === 'sala' && s === indiceAtivo)) && <div className={`nome${foco === 'sala' && s === indiceAtivo ? ' ativo' : ''}`}>Editar sala</div>}
          </div>
        </Fragment>
      ))}
      <div className="tres-dica">Arraste para passear · roda para aproximar · botão direito gira</div>
    </div>
  )
}
