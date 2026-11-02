// O andar como uma maquete 3D clara: o andar da equipe (uma sala por time em volta de um hall com café e recepção,
// mais a sua sala e o Financeiro) e, à esquerda, a ala das marcas. O trabalho passa de mesa em mesa por e-mail: um envelope voa de quem terminou até quem recebe.
// Arrastar passeia pelo andar, a roda aproxima, o botão direito (ou dois dedos) gira.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { tocarAviso } from '../lib/som'
import { useTema } from '../lib/tema'
import { AGENTES, agentePorId, type AgenteId } from '../agents/catalogo'
import { COR_ESTADO, selecionarEsperandoVoce, useEscritorio, type Entrega, type Estado } from '../store/escritorio'
import { BarraSalas, type AlvoDaBarra } from '../andar/BarraSalas'
import { VISUAL, VISUAL_FIN } from '../andar/visual'
import { comprimento, noCaminho, type Ponto } from '../andar/caminho'
import {
  ANDAR_H, CAFE, CALENDARIO, COFRINHO, CORREDOR_Y, DEPTOS, ENTRADA, EQUIPE_H, EQUIPE_W, GAVETA, GRAFICO_FIN, HALL, INSTAGRAM, MARCA_W, MESA_FIN, MESA_VOCE, MESAS, NOVO_POST,
  PAREDE_H, PAREDES_ALTAS, PAREDES_BAIXAS, PASSO_MARCA, PLACA, PORTA, PORTA_MARCA, PORTAS, QUADROS, RECEPCAO, SALA_FIN, SALA_H, SALA_VOCE, VAO_ALA, VISTA_MIN,
  GATOS, caminhoAteOCafe, portaDe, type MarcaNoAndar, type Parede, type Quadro, type Sala,
} from '../andar/planta'
import { COR_EQUIPE, COR_FINANCEIRO, COR_VOCE, PADRAO, misturar } from '../andar/cores'
import { contarRecebidos } from '../lib/emails'
import { type Acao, type Boneco, type Gato3D, boneco, descartar, fundir, gato, cadeira, caixa, chao, cilindro, envelope, envelopeAberto, K, mat, corDoChao, usarChaoEscuro, mesaDeTrabalho, PALETA, planta, quadroNaParede, sofa, textura, wx, wz } from './cena'


const VELOCIDADE = 58
/** tempo trabalhando no e-mail que chegou antes de mandar o próximo */
const TEMPO_MINIMO_NA_MESA = 1600
const PRIORIDADE: Estado[] = ['erro', 'esperando_voce', 'trabalhando', 'na_fila', 'concluido', 'ocioso']
const ALTURA_PAREDE = 2.4
/** salas do andar da equipe, na ordem das placas: os times, a sua sala e o Financeiro */
const SALAS_DO_ANDAR: Sala[] = [...DEPTOS, SALA_VOCE, SALA_FIN]
const corDaSala = (s: Sala) => (s.id === 'voce' ? COR_VOCE : s.id === 'financeiro' ? COR_FINANCEIRO : COR_EQUIPE)
/** piso de cada sala da equipe: Pauta e texto, Design, Estúdio (carpete grafite), Revisão e Publicação */

export interface Props {
  marcas: MarcaNoAndar[]
  marcaAtiva: string | null
  aoEscolherMarca: (id: string) => void
  /** o que aparece nos quadros da parede de cada sala: dias com post neste mês e quantas regras estão ativas */
  quadros?: Record<string, { dias: number[]; regras: number; referencias?: number; gaveta?: number }>
  /** clique nas referências, no calendário, no branding ou no mural de regras de uma sala */
  aoAbrirQuadro?: (marcaId: string, quadro: Quadro) => void
  /** gastos dos últimos dias (gráfico da parede) e se o Financeiro tem uma dica importante */
  financeiro?: { barras: number[]; alerta: boolean }
  /** o que aparece embaixo do cofrinho de cada sala (gasto do mês), por marca */
  cofres?: Record<string, string>
  /** o que os agentes estão fazendo no post de cada marca */
  porSala?: Record<string, Partial<Record<string, Estado>>>
  /** quantos posts de todas as marcas estão esperando você */
  naSuaMesa?: number
  /** arrastar os nomes da barra muda a ordem das salas (ids da esquerda para a direita) */
  aoReordenar?: (ids: string[]) => void
  /** clique no balcão de pedidos de uma sala: abre um post novo para aquela marca */
  aoNovoPost?: (marcaId: string) => void
  /** clique no celular: conecta (ou mostra) o Instagram daquela marca */
  aoConectarInstagram?: (marcaId: string) => void
}

/** a cor de uma sala em seis tons, do claro ao escuro: livros, post-its e amostras da parede */
const tons = (cor: string) => [misturar(cor, '#ffffff', 0.7), misturar(cor, '#ffffff', 0.45), misturar(cor, '#ffffff', 0.2), cor, misturar(cor, '#1f2330', 0.25), misturar(cor, '#1f2330', 0.5)]

/** Quem foi tomar café: anda até o balcão, para um pouco e volta para a mesa. */
interface Andante {
  id: string
  quem: AgenteId
  ida: Ponto[]
  volta: Ponto[]
  fase: 'ida' | 'parado' | 'volta'
  dist: number
  parouEm: number
}
/** Um e-mail voando em arco da mesa de quem mandou até a de quem recebe. */
interface Envelope {
  id: string
  de: AgenteId | 'voce'
  para: AgenteId | 'voce'
  ida: Ponto[]
  dist: number
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
  aoReordenar,
  aoNovoPost,
  aoConectarInstagram,
}: Props) {
  const caixaRef = useRef<HTMLDivElement>(null)
  const etiquetas = useRef<Map<string, HTMLDivElement>>(new Map())
  const estados = useEscritorio((s) => s.estados)
  const acoes = useEscritorio((s) => s.acaoAtual)
  const aguardando = useEscritorio(selecionarEsperandoVoce)
  const selecionado = useEscritorio((s) => s.selecionado)
  const agenda = useEscritorio((s) => s.agenda)
  const selecionar = useEscritorio((s) => s.selecionar)
  const focar = useEscritorio((s) => s.focar)
  const foco = useEscritorio((s) => s.foco)

  const indiceAtivo = Math.max(0, marcas.findIndex((m) => m.id === marcaAtiva))
  // a ala das marcas fica à esquerda do andar da equipe, com um vão entre os dois
  const xMarca = (i: number) => -VAO_ALA - (marcas.length - i) * PASSO_MARCA
  const origem = xMarca(0)
  const corDe = (m: MarcaNoAndar) => m.cor ?? COR_EQUIPE

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
    /** envelope aberto em cima da mesa de quem acabou de receber um e-mail */
    abertos: Record<string, THREE.Object3D>
    /** bandeja da caixa de entrada de cada mesa, com um envelope por e-mail recebido (até quatro) */
    bandejas: Record<AgenteId, THREE.Mesh[]>
    anel: THREE.Mesh
    cartas: Map<string, THREE.Object3D>
    gatos: Record<string, Gato3D>
    alvoCamera: THREE.Vector3 | null
    tamanho: { w: number; h: number }
    /** última vez que a câmera se mexeu (arrastar, girar, aproximar): parada, a maquete anda a 30 quadros por segundo */
    mexeuEm: number
  } | null>(null)

  const andantes = useRef<Andante[]>([])
  /** Maki e Gojo passeiam pelo hall e entram nas salas; param um pouco e às vezes cochilam */
  const gatos = useRef(GATOS.map((g) => ({ ...g, rota: [] as Ponto[], dist: 0, ate: 0, dormindo: false, sala: null as Sala | null, rumo: 0 })))
  const [miau, setMiau] = useState<Record<string, string>>({})
  const falarGato = (nome: string, texto: string) => {
    setMiau((m) => ({ ...m, [nome]: texto }))
    window.setTimeout(() => setMiau((m) => {
      const resto = { ...m }
      delete resto[nome]
      return resto
    }), 2600)
  }
  // textos por cima da maquete (nomes, placas, balões): dá para esconder, e a escolha fica no aparelho
  const [textos, setTextos] = useState(() => {
    try {
      return localStorage.getItem('escritorio-textos') !== 'ocultos'
    } catch {
      return true
    }
  })
  const trocarTextos = () => {
    setTextos((v) => {
      try {
        localStorage.setItem('escritorio-textos', v ? 'ocultos' : 'visiveis')
      } catch {
        // sem armazenamento local
      }
      return !v
    })
  }
  const envelopes = useRef<Envelope[]>([])
  const pendentes = useRef<Entrega[]>([])
  /** e-mail que acabou de chegar: o envelope fica um tempo aberto em cima da mesa */
  const chegouEm = useRef<Map<string, number>>(new Map())
  const [emailChegouEmVoce, setEmailChegouEmVoce] = useState(true)
  const emailEmVoceRef = useRef(true)
  const [sobre, setSobre] = useState<string | null>(null)
  const eventos = useEscritorio((s) => s.eventos)
  const recebidos = useMemo(() => contarRecebidos(eventos), [eventos])
  const recebidosRef = useRef(recebidos)
  recebidosRef.current = recebidos
  /** o que já está na caixa de entrada de cada um: os recebidos menos os e-mails que ainda vão sair ou estão voando */
  const caixasDeEntrada = (chegando: Set<string>) => {
    const conta: Record<string, number> = { ...recebidosRef.current }
    for (const e of pendentes.current) conta[e.para] = (conta[e.para] ?? 0) - 1
    for (const id of chegando) if (envelopes.current.some((e) => e.para === id)) conta[id] = (conta[id] ?? 0) - envelopes.current.filter((e) => e.para === id).length
    return conta
  }
  const abrirEmails = useEscritorio((s) => s.abrirEmails)

  /** onde o envelope sai e chega: em cima da mesa de cada um (coordenadas do andar) */
  const mesaDe = (quem: AgenteId | 'voce'): Ponto => (quem === 'voce' ? [MESA_VOCE.x + 25, MESA_VOCE.y + 6] : [MESAS[quem].x + 6, MESAS[quem].y + 10])
  const aCaminhoDe = () => new Set(envelopes.current.map((e) => e.para))
  const andando = (quem: AgenteId | 'voce') => andantes.current.some((a) => a.quem === quem)

  useEffect(
    () =>
      useEscritorio.subscribe((s, antes) => {
        if (s.eventos.length === 0 && antes.eventos.length > 0) {
          pendentes.current = []
          envelopes.current = []
          chegouEm.current.clear()
          return
        }
        const novas = s.entregas.filter((e) => !antes.entregas.some((x) => x.id === e.id))
        pendentes.current.push(...novas)
      }),
    [],
  )

  // modo escuro: fundo e chão em tons do Azul Nishi (antes do renderizador, para já nascer escuro)
  const { valendo: tema } = useTema()
  useEffect(() => {
    usarChaoEscuro(tema === 'escuro')
    const fundo = tres.current?.scene.background
    if (fundo instanceof THREE.Color) fundo.set(corDoChao('#eceef3'))
  }, [tema])

  // ── renderizador, câmera e luzes: uma vez ──
  useEffect(() => {
    const el = caixaRef.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    // tela Retina a 2x desenhava quatro vezes mais pixels (com antisserrilhado e sombra) a cada quadro: 1,5x já fica nítido
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.domElement.className = 'tres-tela'
    el.prepend(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(corDoChao('#eceef3'))
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400)
    const alvo = new THREE.Vector3(wx(EQUIPE_W / 2), 0.3, wz(EQUIPE_H / 2))
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
    const abertos: Record<string, THREE.Object3D> = {}
    const bandejas = {} as Record<AgenteId, THREE.Mesh[]>
    for (const a of AGENTES) {
      const m = MESAS[a.id]
      const acao: Acao = { tipo: 'agente', id: a.id }
      const { tela } = mesaDeTrabalho(vivos, wx(m.x + 15), wz(m.y + 8), '#ffffff', acao)
      telas[a.id] = tela
      cadeira(vivos, wx(m.x + 15), wz(m.y + 27), PADRAO.estofado, acao)
      const b = boneco(vivos, VISUAL[a.id], acao, a.emTreinamento)
      b.grupo.position.set(wx(m.x + 15), 0, wz(m.y + 26))
      bonecos[a.id] = b
      filas[a.id] = [0, 1, 2, 3].map((k) => {
        const p = caixa(vivos, 0.22, 0.03, 0.16, '#ffffff', wx(m.x + 27) - k * 0.03, 0.775 + k * 0.03, wz(m.y + 12) - k * 0.02, 0.005)
        p.visible = false
        return p
      })
      // caixa de entrada: bandeja no canto da mesa, com os envelopes que chegaram
      const caixaEntrada: Acao = { tipo: 'caixa', id: a.id }
      const bx = wx(m.x + 4)
      const bz = wz(m.y + 4)
      caixa(vivos, 0.3, 0.05, 0.22, '#2a2f3a', bx, 0.79, bz, 0.01, caixaEntrada)
      bandejas[a.id] = [0, 1, 2, 3].map((k) => {
        const env = caixa(vivos, 0.26, 0.012, 0.18, k % 2 ? '#fbf7ee' : '#ffffff', bx, 0.825 + k * 0.014, bz, 0.002, caixaEntrada)
        env.visible = false
        return env
      })
      abertos[a.id] = envelopeAberto(vivos, wx(m.x + 15), wz(m.y + 13))
    }
    {
      const b = boneco(vivos, VISUAL.voce, { tipo: 'voce' })
      b.grupo.position.set(wx(MESA_VOCE.x + MESA_VOCE.w / 2), 0, wz(MESA_VOCE.y - 10))
      b.grupo.rotation.y = Math.PI
      bonecos.voce = b
      abertos.voce = envelopeAberto(vivos, wx(MESA_VOCE.x + 26), wz(MESA_VOCE.y + 8))
      const f = boneco(vivos, VISUAL_FIN, { tipo: 'financeiro' })
      f.grupo.position.set(wx(MESA_FIN.x + MESA_FIN.w / 2), 0, wz(MESA_FIN.y - 10))
      f.grupo.rotation.y = Math.PI
      bonecos.financeiro = f
    }
    const anel = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 32), mat('#f2b233', { emissive: '#f2b233', emissiveIntensity: 0.4, side: THREE.DoubleSide }))
    anel.rotation.x = -Math.PI / 2
    anel.position.y = 0.012
    anel.visible = false
    vivos.add(anel)

    // Maki e Gojo
    const gatos: Record<string, Gato3D> = {}
    for (const g of GATOS) gatos[g.nome] = gato(vivos, g.mancha, { tipo: 'gato', nome: g.nome })
    tres.current = { renderer, scene, camera, controls, sol, cenario, vivos, bonecos, telas, filas, abertos, bandejas, anel, cartas: new Map(), gatos, alvoCamera: null, tamanho: { w: 1, h: 1 }, mexeuEm: performance.now() }
    const mexeu = () => {
      if (tres.current) tres.current.mexeuEm = performance.now()
    }
    controls.addEventListener('change', mexeu)

    const ajustar = () => {
      const w = el.clientWidth || 1
      const h = el.clientHeight || 1
      const t = tres.current!
      t.tamanho = { w, h }
      renderer.setSize(w, h, false)
      // no computador o andar da equipe inteiro (visto na diagonal); no celular, umas duas salas
      const porMetro = Math.min(52, w / ((w < 760 ? VISTA_MIN : (EQUIPE_W + EQUIPE_H) * 0.72) * K + 2))
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
  }, [])

  // ── cenário parado: refeito quando as salas, os quadros ou o gráfico mudam ──
  useEffect(() => {
    const t = tres.current
    if (!t) return
    const c = t.cenario
    descartar(c)
    const hoje = new Date().getDate()
    /** quadro em pé, num cavalete de duas pernas (nas salas sem parede alta) */
    const quadroEmPe = (cx: number, cz: number, w: number, h: number, tex: THREE.Texture, acao: Acao, moldura: string) => {
      const y = 1.2
      quadroNaParede(c, cx, y, cz, w, h, tex, acao, moldura)
      for (const sx of [-1, 1]) caixa(c, 0.05, y + h / 2, 0.05, PALETA.perna, cx + sx * (w / 2 - 0.08), (y + h / 2) / 2, cz - 0.02, 0, acao)
    }
const zFundo = wz(PAREDE_H)
    const zFrente = wz(SALA_H)
    const zTopo = wz(0)

    // ── ala das marcas: à esquerda, separada do andar da equipe, com o corredor na frente ──
    const inicio = origem - 16
    const fimAla = -VAO_ALA
    if (marcas.length) {
      chao(c, wx(inicio), zTopo, wx(fimAla - inicio), wz(ANDAR_H) - zTopo, '#dfe2e8')
      chao(c, wx(inicio), wz(CORREDOR_Y), wx(fimAla - inicio), wz(ANDAR_H - CORREDOR_Y), '#cfd3dc', 1)
      chao(c, wx(inicio) + 0.3, wz(CORREDOR_Y) + 0.25, wx(fimAla - inicio) - 0.6, wz(ANDAR_H - CORREDOR_Y) - 0.5, COR_EQUIPE, 2)
    }
    const parede = (x0: number, w: number, cor: string) => {
      caixa(c, w, ALTURA_PAREDE, 0.14, cor, x0 + w / 2, ALTURA_PAREDE / 2, zFundo - 0.07)
    }
    const paredeLateral = (x: number, cor = '#f1f2f5') => caixa(c, 0.14, ALTURA_PAREDE, zFrente - zFundo + 0.14, cor, x, ALTURA_PAREDE / 2, (zFundo + zFrente) / 2 - 0.07)
    /** parede entre duas salas: baixa, como numa maquete em corte, para a parede não esconder o que fica do lado dela */
    const paredeEntre = (xPx: number) => {
      const h = 0.9
      const prof = zFrente - zFundo + 0.14
      caixa(c, wx(16), h, prof, '#f1f2f5', wx(xPx + 8), h / 2, (zFundo + zFrente) / 2 - 0.07, 0.02)
      caixa(c, wx(16) + 0.03, 0.04, prof + 0.03, PALETA.madeiraClara, wx(xPx + 8), h + 0.02, (zFundo + zFrente) / 2 - 0.07, 0.015)
      // pilar alto junto da parede do fundo, para a parede do fundo não parecer solta
      caixa(c, wx(16), ALTURA_PAREDE, 0.3, '#f1f2f5', wx(xPx + 8), ALTURA_PAREDE / 2, zFundo + 0.08)
    }
    /** parede baixa da frente, com a porta aberta */
    const frente = (x0: number, w: number, porta: number, cor: string) => {
      const h = 0.9
      const a = porta - 18 - x0
      const b = x0 + w - (porta + 18)
      if (a > 0) caixa(c, wx(a), h, 0.1, cor, wx(x0 + a / 2), h / 2, zFrente - 0.05, 0.02)
      if (b > 0) caixa(c, wx(b), h, 0.1, cor, wx(x0 + w - b / 2), h / 2, zFrente - 0.05, 0.02)
    }
    const rodape = (x0: number, w: number, cor: string) => caixa(c, wx(w), 0.08, 0.03, cor, wx(x0 + w / 2), 0.04, zFundo + 0.015)
    if (marcas.length) paredeLateral(wx(inicio) + 0.07)

    // ── salas das marcas ──
    marcas.forEach((m, i) => {
      const x0 = xMarca(i)
      const q = quadros?.[m.id]
      const cor = corDe(m)
      const tonsDaMarca = tons(cor)
      // a sala é igual às outras; a cor da marca fica só nos tapetes e nos quadros da parede
      chao(c, wx(x0), zFundo, wx(MARCA_W), zFrente - zFundo, PADRAO.piso, 1)
      parede(wx(x0), wx(MARCA_W), PADRAO.parede)
      rodape(x0, MARCA_W, PADRAO.rodape)
      paredeEntre(x0 + MARCA_W)
      frente(x0, MARCA_W, x0 + PORTA_MARCA, PADRAO.parede)
      // quadros da parede: referências, calendário, branding e regras
      const dias = new Set(q?.dias ?? [])
      const texs: Record<Quadro, THREE.Texture> = {
        referencias: textura(256, 192, (g, w, h) => {
          g.fillStyle = '#fbfaf6'
          g.fillRect(0, 0, w, h)
          for (let k = 0; k < 6; k++) {
            g.fillStyle = k < (q?.referencias ?? 0) ? tonsDaMarca[k] : '#e6e6e2'
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
          g.fillStyle = cor
          g.fillRect(0, 0, w, 22)
          const n = q?.regras ?? 0
          for (let k = 0; k < 6; k++) {
            g.fillStyle = k < n ? cor : '#e6e6e2'
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
        quadroNaParede(c, wx(x0 + r.x + r.w / 2), 1.5, zFundo, wx(r.w), wx(r.w) * 0.75, texs[nome], { tipo: 'quadro', marca: m.id, quadro: nome }, cor)
      }
      // tapete da marca com o nome por cima (etiqueta HTML)
      chao(c, wx(x0 + (MARCA_W - 120) / 2), wz(PLACA.y - 17), wx(120), wz(34), cor, 3)
      chao(c, wx(x0 + 6), wz(46), wx(72), wz(40), misturar(cor, '#ffffff', 0.55), 2)
      chao(c, wx(x0 + 98), wz(46), wx(72), wz(40), misturar(cor, '#ffffff', 0.55), 2)
      // escrivaninha de pedidos: mesa com máquina de escrever e a folha
      {
        const a: Acao = { tipo: 'novo', marca: m.id, sala: i }
        const cx = wx(x0 + NOVO_POST.x + NOVO_POST.w / 2)
        const cz = wz(NOVO_POST.y + 18)
        caixa(c, 1.2, 0.05, 0.6, PADRAO.mesa, cx, 0.74, cz, 0.02, a)
        for (const sx of [-1, 1]) caixa(c, 0.05, 0.72, 0.5, PALETA.perna, cx + sx * 0.55, 0.36, cz, 0, a)
        caixa(c, 0.42, 0.18, 0.3, '#2b2f3a', cx, 0.86, cz, 0.03, a)
        caixa(c, 0.3, 0.3, 0.01, '#ffffff', cx, 1.1, cz - 0.1, 0, a)
        caixa(c, 0.12, 0.03, 0.01, '#1f2330', cx, 1.12, cz - 0.095, 0, a)
        caixa(c, 0.03, 0.12, 0.01, '#1f2330', cx, 1.12, cz - 0.095, 0, a)
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
        // cômoda de madeira, para não sumir na parede clara
        caixa(c, 1.0, 0.9, 0.55, PALETA.madeiraClara, cx, 0.45, cz, 0.02, a)
        caixa(c, 0.86, 0.22, 0.4, misturar(PALETA.madeiraClara, '#1f2330', 0.2), cx, 0.72, cz + 0.3, 0.02, a)
        const n = Math.min(5, q?.gaveta ?? 0)
        for (let k = 0; k < n; k++) caixa(c, 0.1, 0.22, 0.3, ['#ffffff', '#e3e6ec', '#c9ccd6', '#ffffff', '#e3e6ec'][k], cx - 0.3 + k * 0.15, 0.9, cz + 0.3, 0.01, a)
        caixa(c, 0.3, 0.03, 0.03, '#1f2330', cx, 0.3, cz + 0.29, 0, a)
      }
      planta(c, wx(x0 + MARCA_W - 20), wz(154), 0.8)
    })

    // ── andar da equipe: salas em volta do hall ──
    {
      // o hall por baixo de tudo e o piso de cada sala por cima
      chao(c, 0, 0, wx(EQUIPE_W), wz(EQUIPE_H), '#e4ded2', 1)
      for (const s of SALAS_DO_ANDAR) chao(c, wx(s.x), wz(s.y), wx(s.w), wz(s.h), PADRAO.piso, 2)
      // paredes: as do fundo (em cima e à esquerda) altas, com janelas; as outras baixas, para ver dentro das salas
      const ESP = 0.12
      const trecho = (x0: number, y0: number, x1: number, y1: number, alta: boolean) => {
        const h = alta ? ALTURA_PAREDE : 1.0
        const horizontal = y0 === y1
        const w = horizontal ? wx(x1 - x0) + ESP : ESP
        const d = horizontal ? ESP : wz(y1 - y0) + ESP
        const cx = wx((x0 + x1) / 2)
        const cz = wz((y0 + y1) / 2)
        caixa(c, w, h, d, '#f1f2f5', cx, h / 2, cz, 0.02)
        if (!alta) caixa(c, w + 0.03, 0.04, d + 0.03, PALETA.madeiraClara, cx, h + 0.02, cz, 0.015)
      }
      const comPortas = ([x0, y0, x1, y1]: Parede, alta: boolean) => {
        const horizontal = y0 === y1
        const vaos = PORTAS.filter(([px, py]) => (horizontal ? py === y0 && px > x0 && px < x1 : px === x0 && py > y0 && py < y1))
          .map(([px, py]) => (horizontal ? px : py))
          .sort((a, b) => a - b)
        let a = horizontal ? x0 : y0
        for (const v of [...vaos, null]) {
          const b = v === null ? (horizontal ? x1 : y1) : v - PORTA / 2
          if (b > a) {
            if (horizontal) trecho(a, y0, b, y0, alta)
            else trecho(x0, a, x0, b, alta)
          }
          if (v !== null) a = v + PORTA / 2
        }
      }
      for (const p of PAREDES_ALTAS) comPortas(p, true)
      for (const p of PAREDES_BAIXAS) comPortas(p, false)
      const vidro = mat('#cfe3f5', { emissive: '#bcd6f0', emissiveIntensity: 0.5, roughness: 0.1 })
      const janela = (xPx: number | null, yPx: number | null) => {
        const naDeCima = yPx === null
        const x = naDeCima ? wx(xPx!) : 0.07
        const z = naDeCima ? 0.07 : wz(yPx!)
        caixa(c, naDeCima ? 1.0 : 0.05, 1.1, naDeCima ? 0.05 : 1.0, '#e3e6ec', x, 1.55, z)
        caixa(c, naDeCima ? 0.9 : 0.06, 1.0, naDeCima ? 0.06 : 0.9, vidro, x + (naDeCima ? 0 : 0.01), 1.55, z + (naDeCima ? 0.01 : 0)).castShadow = false
      }
      for (const x of [72, 196, 368, 476, 616, 728]) janela(x, null)
      for (const y of [60, 124, 252, 300, 440]) janela(null, y)

      // hall: balcão do café, recepção na frente da porta e um canto com sofás
      {
        const cx = wx(CAFE.x + 20)
        const cz = wz(CAFE.y + 6)
        caixa(c, 1.6, 0.95, 0.5, '#e3e6ec', cx, 0.475, cz, 0.03)
        caixa(c, 1.66, 0.05, 0.56, '#ffffff', cx, 0.97, cz, 0.02)
        caixa(c, 0.3, 0.38, 0.28, '#1f2125', cx - 0.4, 1.18, cz, 0.03)
        for (let k = 0; k < 3; k++) cilindro(c, 0.04, 0.035, 0.09, '#ffffff', cx + 0.1 + k * 0.14, 1.04, cz + 0.05, 14)
      }
      {
        const cx = wx(RECEPCAO.x)
        const cz = wz(RECEPCAO.y)
        caixa(c, 2.0, 1.0, 0.6, '#ffffff', cx, 0.5, cz, 0.04)
        caixa(c, 2.02, 0.12, 0.62, COR_EQUIPE, cx, 0.8, cz, 0.02)
        caixa(c, 2.1, 0.05, 0.7, '#e3e6ec', cx, 1.02, cz, 0.02)
      }
      {
        const tx = HALL.x + 150
        const tz = HALL.y + 100
        chao(c, wx(tx - 50), wz(tz - 30), wx(100), wz(60), misturar(COR_EQUIPE, '#ffffff', 0.7), 3)
        sofa(c, wx(tx), wz(tz - 34), 1.8, PADRAO.estofado)
        sofa(c, wx(tx), wz(tz + 34), 1.8, PADRAO.estofado).rotation.y = Math.PI
        caixa(c, 0.9, 0.35, 0.5, PALETA.madeiraClara, wx(tx), 0.175, wz(tz), 0.03)
      }
      // plantas do hall, longe das paredes e das portas
      for (const [x, y] of [[214, 494], [556, 344], [ENTRADA.em - 36, EQUIPE_H - 14], [ENTRADA.em + 36, EQUIPE_H - 14]]) planta(c, wx(x), wz(y), 0.9)

      // móveis das salas, nos cantos livres (as mesas ficam no meio)
      const [pauta, design, estudio, revisao, publicacao] = DEPTOS
      const estante = (x: number, z: number, girada = false) => {
        const g = new THREE.Group()
        c.add(g)
        g.position.set(x, 0, z)
        if (girada) g.rotation.y = Math.PI / 2
        caixa(g, 0.9, 1.6, 0.32, PALETA.madeiraClara, 0, 0.8, 0, 0.02)
        const tons = ['#2a5288', '#e3e6ec', '#5b6270', '#c9ccd6']
        for (let f = 0; f < 3; f++) for (let k = 0; k < 7; k++) caixa(g, 0.08, 0.3 + ((k * 7 + f) % 3) * 0.03, 0.22, tons[(k + f) % 4], -0.32 + k * 0.105, 0.35 + f * 0.48, 0.02)
      }
      const quadroBranco = (x: number, z: number, notas: boolean) => {
        caixa(c, 0.95, 0.65, 0.04, '#ffffff', x, 1.15, z, 0.01)
        for (const sx of [-1, 1]) caixa(c, 0.03, 1.5, 0.03, '#8a8f99', x + sx * 0.42, 0.75, z - 0.01)
        const cores = notas ? ['#ffd36b', '#9fd1ff', '#b6e3a8', '#ff9b85', '#ffd36b', '#d9b8ff'] : ['#2a5288', '#e9a4a4', '#f2b233', '#3f7650', '#9fb7d9', '#c46a2b']
        cores.forEach((cor, k) => caixa(c, 0.16, 0.13, 0.01, cor, x - 0.3 + (k % 3) * 0.3, 1.28 - Math.floor(k / 3) * 0.24, z + 0.025))
      }
      // Pauta e texto: estante na parede do fundo e o quadro da pauta no canto livre
      estante(wx(pauta.x + 270), wz(8))
      quadroBranco(wx(pauta.x + 268), wz(104), true)
      planta(c, wx(pauta.x + 14), wz(pauta.y + 160), 0.75)
      // Design: mural de referências e plantas
      quadroBranco(wx(design.x + 186), wz(120), false)
      planta(c, wx(design.x + 226), wz(design.y + 162), 0.75)
      planta(c, wx(design.x + 14), wz(design.y + 162), 0.75)
      // Estúdio: fundo verde encostado na parede do fundo, refletor, câmera no tripé e microfone do Narrador
      {
        const cx = wx(estudio.x + 128)
        const verde = mat('#3fa66b', { roughness: 0.95 })
        caixa(c, 2.0, 1.9, 0.05, verde, cx, 0.95, 0.1, 0.02)
        caixa(c, 2.0, 0.02, 0.55, verde, cx, 0.01, 0.4)
        const lx = cx - 1.35
        caixa(c, 0.03, 1.6, 0.03, '#222222', lx, 0.8, 0.5)
        const luz = caixa(c, 0.4, 0.3, 0.12, mat('#fff7e0', { emissive: '#fff2cc', emissiveIntensity: 0.8 }), lx, 1.6, 0.5, 0.02)
        luz.rotation.y = -0.7
        const tx = cx
        const tz = wz(150)
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
      // Revisão: estante na parede da esquerda e uma planta
      estante(0.25, wz(revisao.y + 140), true)
      planta(c, wx(revisao.x + 206), wz(revisao.y + 160), 0.75)
      // Publicação: mesinha com o celular e o notebook ao lado do Publicador e uma planta
      {
        const mx = wx(publicacao.x + 150)
        const mz = wz(publicacao.y + 74)
        caixa(c, 0.8, 0.05, 0.5, '#ffffff', mx, 0.5, mz, 0.02)
        caixa(c, 0.06, 0.5, 0.06, PALETA.perna, mx, 0.25, mz)
        caixa(c, 0.32, 0.02, 0.22, '#c7ccd6', mx - 0.1, 0.54, mz)
        caixa(c, 0.12, 0.02, 0.22, '#1d1f25', mx + 0.22, 0.54, mz, 0.01)
        planta(c, wx(publicacao.x + 16), wz(publicacao.y + 160), 0.75)
      }
    }

    // ── sua sala ──
    {
      // calendário num quadro em pé, atrás da sua mesa
      const tex = textura(256, 192, (g, w, h) => {
        g.fillStyle = '#fbfaf6'
        g.fillRect(0, 0, w, h)
        g.fillStyle = COR_VOCE
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
      quadroEmPe(wx(CALENDARIO.x + CALENDARIO.w / 2), wz(CALENDARIO.y), 1.3, 0.95, tex, { tipo: 'calendario' }, COR_VOCE)
      // a sua mesa
      const a: Acao = { tipo: 'voce' }
      const cx = wx(MESA_VOCE.x + MESA_VOCE.w / 2)
      const cz = wz(MESA_VOCE.y + 8)
      caixa(c, 1.5, 0.06, 0.7, PADRAO.mesa, cx, 0.74, cz, 0.02, a)
      for (const sx of [-1, 1]) caixa(c, 0.5, 0.7, 0.6, '#e3e6ec', cx + sx * 0.5, 0.35, cz, 0.02, a)
      caixa(c, 0.5, 0.34, 0.03, PALETA.monitor, cx - 0.1, 0.95, cz - 0.15, 0.015, a)
      caixa(c, 0.06, 0.1, 0.06, PALETA.monitor, cx - 0.1, 0.8, cz - 0.15, 0, a)
      for (let k = 0; k < Math.min(naSuaMesa, 6); k++) caixa(c, 0.3, 0.04, 0.22, k % 2 ? '#ffd36b' : '#f2b233', cx + 0.5, 0.79 + k * 0.045, cz + 0.1, 0.005, a)
      cadeira(c, cx, wz(MESA_VOCE.y - 10), PADRAO.estofado, a).rotation.y = Math.PI
    }

    // ── Financeiro ──
    {
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
      quadroEmPe(wx(GRAFICO_FIN.x + GRAFICO_FIN.w / 2), wz(GRAFICO_FIN.y), 1.8, 1.1, tex, { tipo: 'financeiro' }, COR_FINANCEIRO)
      const a: Acao = { tipo: 'financeiro' }
      const cx = wx(MESA_FIN.x + MESA_FIN.w / 2)
      const cz = wz(MESA_FIN.y + 8)
      caixa(c, 1.5, 0.06, 0.7, '#ffffff', cx, 0.74, cz, 0.02, a)
      for (const sx of [-1, 1]) caixa(c, 0.05, 0.72, 0.6, PALETA.perna, cx + sx * 0.7, 0.36, cz, 0, a)
      caixa(c, 0.5, 0.34, 0.03, PALETA.monitor, cx + 0.1, 0.95, cz - 0.15, 0.015, a)
      caixa(c, 0.06, 0.1, 0.06, PALETA.monitor, cx + 0.1, 0.8, cz - 0.15, 0, a)
      caixa(c, 0.3, 0.2, 0.2, '#e3e6ec', cx - 0.5, 0.86, cz, 0.02, a)
      cadeira(c, cx, wz(MESA_FIN.y - 10), PADRAO.estofado, a).rotation.y = Math.PI
    }
    // tudo o que fica parado vira poucas malhas grandes: é isso que deixa o andar leve
    fundir(c)
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
      // sem ninguém mexendo na câmera, um quadro a cada ~33 ms basta (os bonecos e os gatos andam do mesmo jeito)
      if (agora - t.mexeuEm > 1500 && !t.alvoCamera && agora - anterior < 30) {
        quadroId = requestAnimationFrame(desenhar)
        return
      }
      const dt = Math.min((agora - anterior) / 1000, 0.05)
      anterior = agora
      const seg = agora / 1000
      const v = vivo.current
      const marcas = marcasRef.current
      const { camera, controls, renderer, scene, sol, bonecos, telas, filas, abertos, bandejas, anel, cartas, tamanho } = t

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

      // passeio até o café de vez em quando (o único motivo para alguém levantar da mesa)
      if (agora > proximoPasseio && andantes.current.length === 0) {
        proximoPasseio = agora + 40000 + Math.random() * 40000
        const livres = AGENTES.filter((a) => !['trabalhando', 'na_fila', 'esperando_voce'].includes(estadoNaTela(a.id)))
        const a = livres[Math.floor(Math.random() * livres.length)]
        if (a) {
          const ida = caminhoAteOCafe(MESAS[a.id])
          andantes.current.push({ id: `cafe-${agora}`, quem: a.id, ida, volta: [...ida].reverse(), fase: 'ida', dist: 0, parouEm: 0 })
        }
      }

      // solta os e-mails da fila, na ordem: ninguém manda o próximo antes de receber o anterior
      const chegando = aCaminhoDe()
      pendentes.current = pendentes.current.filter((e) => {
        if (chegando.has(e.de)) return true
        if (pendentes.current.some((x) => x !== e && x.para === e.de && pendentes.current.indexOf(x) < pendentes.current.indexOf(e))) return true
        const recebeu = chegouEm.current.get(e.de)
        if (recebeu !== undefined && agora - recebeu < TEMPO_MINIMO_NA_MESA) return true
        // quem estava no café volta para a mesa antes de mandar
        const noCafe = andantes.current.find((a) => a.quem === e.de)
        if (noCafe) {
          if (noCafe.fase !== 'volta') {
            noCafe.dist = noCafe.fase === 'ida' ? comprimento(noCafe.ida) - noCafe.dist : 0
            noCafe.fase = 'volta'
          }
          return true
        }
        envelopes.current.push({ id: e.id, de: e.de, para: e.para, ida: [mesaDe(e.de), mesaDe(e.para)], dist: 0 })
        chegando.add(e.para)
        return false
      })
      const emailEmVoce = !chegando.has('voce') && !pendentes.current.some((e) => e.para === 'voce')
      if (emailEmVoce !== emailEmVoceRef.current) {
        emailEmVoceRef.current = emailEmVoce
        setEmailChegouEmVoce(emailEmVoce)
      }
      const voceAguardando = v.aguardando && emailEmVoce

      // os e-mails voando
      for (const e of envelopes.current) {
        const total = comprimento(e.ida)
        e.dist += Math.max(170, total / 2.2) * dt
        if (e.dist >= total) {
          chegouEm.current.set(e.para, agora)
          if (e.para === 'voce') tocarAviso()
          e.dist = -1
        }
      }
      envelopes.current = envelopes.current.filter((e) => e.dist >= 0)

      // quem foi ao café
      for (const a of andantes.current) {
        if (a.fase === 'parado') {
          if (agora - a.parouEm > 2200) {
            a.fase = 'volta'
            a.dist = 0
          }
          continue
        }
        const rota = a.fase === 'ida' ? a.ida : a.volta
        a.dist += VELOCIDADE * dt
        if (a.dist >= comprimento(rota)) {
          if (a.fase === 'ida') {
            a.fase = 'parado'
            a.parouEm = agora
          } else a.dist = -1
        }
      }
      andantes.current = andantes.current.filter((a) => a.dist >= 0)

      // envelope aberto na mesa de quem acabou de receber, caixa de entrada e a fila de outras marcas
      for (const [chave, quando] of chegouEm.current) if (agora - quando > 6000) chegouEm.current.delete(chave)
      for (const [chave, o] of Object.entries(abertos)) o.visible = chegouEm.current.has(chave)
      const naCaixa = caixasDeEntrada(chegando)
      for (const a of AGENTES) {
        const n = Math.min(naCaixa[a.id] ?? 0, 4)
        bandejas[a.id].forEach((env, k) => (env.visible = k < n))
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
          b.grupo.position.set(wx(MESA_VOCE.x + MESA_VOCE.w / 2), pulo, wz(MESA_VOCE.y - 10))
          b.grupo.rotation.y = Math.PI
          posicoes.voce = new THREE.Vector3(wx(MESA_VOCE.x + MESA_VOCE.w / 2), 1.75 + pulo, wz(MESA_VOCE.y - 10))
        }
        posicoes.financeiro = new THREE.Vector3(wx(MESA_FIN.x + MESA_FIN.w / 2), 1.75, wz(MESA_FIN.y - 10))
      }

      // quem está a caminho do café
      for (const a of andantes.current) {
        const rota = a.fase === 'volta' ? a.volta : a.ida
        const p = noCaminho(rota, Math.max(0, a.fase === 'parado' ? comprimento(a.ida) : a.dist))
        const b = bonecos[a.quem]
        const parado = a.fase === 'parado'
        const bob = parado ? 0 : Math.abs(Math.sin(seg * 10)) * 0.04
        b.grupo.position.set(wx(p.x), bob, wz(p.y))
        const dir = parado ? 'cima' : p.dir
        b.grupo.rotation.y = dir === 'cima' ? 0 : dir === 'baixo' ? Math.PI : dir === 'esquerda' ? Math.PI / 2 : -Math.PI / 2
        b.pasta.visible = false
        posicoes[a.quem] = new THREE.Vector3(wx(p.x), 1.95, wz(p.y))
        emPe.add(a.quem)
      }

      // os envelopes: sobem por cima das paredes e descem na mesa de quem recebe
      const vistas = new Set<string>()
      for (const e of envelopes.current) {
        vistas.add(e.id)
        let c = cartas.get(e.id)
        if (!c) {
          c = envelope(t.vivos, e.de === 'voce' ? '#f2b233' : (agentePorId(e.de)?.cor ?? COR_EQUIPE))
          c.scale.setScalar(1.8) // maior que o de cima da mesa, para dar para seguir o voo de longe
          cartas.set(e.id, c)
        }
        const total = comprimento(e.ida)
        const k = total ? Math.max(0, e.dist) / total : 1
        const [a, b] = e.ida
        const x = a[0] + (b[0] - a[0]) * k
        const y = a[1] + (b[1] - a[1]) * k
        const altura = 2.1 + Math.min(1.4, total / 500)
        c.position.set(wx(x), 0.85 + Math.sin(k * Math.PI) * altura, wz(y))
        c.rotation.y = Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]))
        c.rotation.z = Math.sin(seg * 12) * 0.18
        c.rotation.x = Math.cos(k * Math.PI) * -0.5
      }
      for (const [id, c] of cartas) {
        if (vistas.has(id)) continue
        t.vivos.remove(c)
        cartas.delete(id)
      }

      // Maki e Gojo: escolhem um lugar no hall ou numa sala, vão pela porta, param um pouco e às vezes cochilam
      for (const g of gatos.current) {
        const m = t.gatos[g.nome]
        if (!g.rota.length) {
          if (agora >= g.ate) {
            const salas = SALAS_DO_ANDAR
            const destino = Math.random() < 0.4 ? salas[Math.floor(Math.random() * salas.length)] : null
            const alvo: Ponto = destino
              ? [destino.x + 24 + Math.random() * (destino.w - 48), destino.y + destino.h - 30 + Math.random() * 12]
              : [HALL.x + 20 + Math.random() * (HALL.w - 40), HALL.y + 20 + Math.random() * (HALL.h - 40)]
            const rota: Ponto[] = [[g.x, g.y]]
            if (g.sala && g.sala !== destino) {
              const p = portaDe(g.sala)
              rota.push(p.dentro, p.fora)
            }
            if (destino && destino !== g.sala) {
              const p = portaDe(destino)
              rota.push(p.fora, p.dentro)
            }
            rota.push(alvo)
            g.rota = rota
            g.dist = 0
            g.sala = destino
            g.dormindo = false
          }
        } else {
          g.dist += 26 * dt
          const p = noCaminho(g.rota, g.dist)
          if (Math.hypot(p.x - g.x, p.y - g.y) > 0.01) g.rumo = Math.atan2(-(p.y - g.y), p.x - g.x)
          g.x = p.x
          g.y = p.y
          if (g.dist >= comprimento(g.rota)) {
            g.rota = []
            g.dormindo = Math.random() < 0.3
            g.ate = agora + (g.dormindo ? 12000 : 2500) + Math.random() * 6000
          }
        }
        const andandoGato = g.rota.length > 0
        m.grupo.position.set(wx(g.x), andandoGato ? Math.abs(Math.sin(seg * 12)) * 0.02 : 0, wz(g.y))
        m.grupo.rotation.y = g.rumo
        m.grupo.scale.set(1.3, g.dormindo ? 0.8 : 1.3, 1.3)
        m.cabeca.rotation.z = g.dormindo ? -0.5 : 0
        m.cauda.rotation.z = g.dormindo ? 1.4 : 0.45 + Math.sin(seg * 3) * 0.15
        m.pernas.forEach((perna, k) => (perna.position.y = 0.05 + (andandoGato ? Math.sin(seg * 14 + k * Math.PI) * 0.015 : 0)))
        posicoes[`gato:${g.nome}`] = new THREE.Vector3(wx(g.x), g.dormindo ? 0.45 : 0.6, wz(g.y))
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
      const esperandoEmail = (id: AgenteId) => chegando.has(id) || pendentes.current.some((e) => e.de === id || e.para === id)
      for (const [chave, el] of etiquetas.current) {
        let pos: THREE.Vector3 | null = null
        let ancora: 'baixo' | 'centro' | 'cima' = 'baixo'
        if (chave.startsWith('placa:')) {
          pos = tmp.set(wx(xMarca(Number(chave.slice(6))) + PLACA.x), 0.05, wz(PLACA.y))
          ancora = 'centro'
        } else if (chave.startsWith('depto:')) {
          const d = SALAS_DO_ANDAR[Number(chave.slice(6))]
          // times: no chão, junto da parede do fundo, entre as mesas; sua sala e Financeiro: no canto da frente
          const pessoal = d.id === 'voce' || d.id === 'financeiro'
          pos = pessoal ? tmp.set(wx(d.x + 44), 0.05, wz(d.y + d.h - 22)) : tmp.set(wx(d.x + d.w / 2), 0.05, wz(d.y + 20))
          ancora = 'centro'
        } else if (chave.startsWith('gato:')) {
          const p = posicoes[chave]
          if (p) pos = tmp.copy(p)
        } else if (chave.startsWith('caixa:')) {
          const id = chave.slice(6) as AgenteId
          const n = naCaixa[id] ?? 0
          const m = MESAS[id]
          if (n > 0) {
            pos = tmp.set(wx(m.x + 4), 1.0, wz(m.y + 4))
            const texto = `✉ ${n}`
            if (el.textContent !== texto) el.textContent = texto
          }
        } else if (/^(cofre|gaveta|novo|instagram):/.test(chave)) {
          const [tipo, n] = chave.split(':')
          const s = Number(n)
          const ref = tipo === 'cofre' ? COFRINHO : tipo === 'gaveta' ? GAVETA : tipo === 'novo' ? NOVO_POST : INSTAGRAM
          pos = tmp.set(wx(xMarca(s) + ref.x + ref.w / 2), 1.4, wz(ref.y + 14))
        } else {
          const nome = chave.startsWith('nome:')
          const id = nome ? chave.slice(5) : chave
          const p = !nome && id !== 'voce' && id !== 'financeiro' && esperandoEmail(id as AgenteId) ? null : posicoes[id]
          if (p) {
            pos = tmp.copy(p)
            if (nome) pos.y -= emPe.has(id) ? 1.95 : 1.75
            ancora = nome ? 'cima' : 'baixo'
          }
        }
        // só escreve o estilo que mudou: reescrever as ~60 etiquetas a cada quadro recalculava a página inteira
        if (!pos) {
          if (el.style.opacity !== '0') el.style.opacity = '0'
          continue
        }
        const s = projetar(pos, camera, w, h)
        const opacidade = s.visivel ? '1' : '0'
        const z = String(chave.startsWith('nome:') ? 100 + Math.round(s.y) : 1000)
        const transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, ${ancora === 'baixo' ? '-100%' : ancora === 'centro' ? '-50%' : '0'})`
        if (el.style.opacity !== opacidade) el.style.opacity = opacidade
        if (el.style.zIndex !== z) el.style.zIndex = z
        if (el.dataset.t !== transform) {
          el.dataset.t = transform
          el.style.transform = transform
        }
      }
      quadroId = requestAnimationFrame(desenhar)
    }
    quadroId = requestAnimationFrame(desenhar)
    return () => cancelAnimationFrame(quadroId)
  }, [marcas.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── cliques: o que está embaixo do ponteiro ──
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const acaoEm = (ev: React.PointerEvent): Acao | null => {
    const t = tres.current
    if (!t) return null
    const rect = t.renderer.domElement.getBoundingClientRect()
    const p = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(p, t.camera)
    // só o que tem clique entra no teste (paredes e chão juntados têm muitos triângulos e nunca respondem ao clique)
    const alvos: THREE.Object3D[] = []
    const juntar = (o: THREE.Object3D, comAcao: boolean) => {
      const tem = comAcao || !!o.userData.acao
      if ((o as THREE.Mesh).isMesh && tem) alvos.push(o)
      for (const f of o.children) juntar(f, tem)
    }
    juntar(t.cenario, false)
    juntar(t.vivos, false)
    const hits = raycaster.intersectObjects(alvos, false)
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
    if (acao.tipo === 'caixa') return abrirEmails(acao.id as AgenteId)
    if (acao.tipo === 'gato') {
      const g = gatos.current.find((x) => x.nome === acao.nome)
      return falarGato(acao.nome, g?.dormindo ? `${acao.nome} está cochilando… zzz` : `Miau! Eu sou ${acao.nome === 'Maki' ? 'a' : 'o'} ${acao.nome}`)
    }
    if (marcas[indiceAtivo]?.id !== acao.marca) aoEscolherMarca(acao.marca)
    if (acao.tipo === 'quadro') {
      selecionar(null)
      return aoAbrirQuadro?.(acao.marca, acao.quadro)
    }
    if (acao.tipo === 'cofre') return focar('cofre')
    if (acao.tipo === 'gaveta') return focar('gaveta')
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
    const s = alvo === 'voce' ? SALA_VOCE : alvo === 'financeiro' ? SALA_FIN : null
    t.alvoCamera = s ? new THREE.Vector3(wx(s.x + s.w / 2), 0.3, wz(s.y + s.h / 2)) : new THREE.Vector3(wx(EQUIPE_W / 2), 0.3, wz(EQUIPE_H / 2))
  }

  const nomes: (AgenteId | 'voce')[] = [...AGENTES.map((a) => a.id), 'voce']
  const ref = (chave: string) => (el: HTMLDivElement | null) => {
    if (el) etiquetas.current.set(chave, el)
    else etiquetas.current.delete(chave)
  }
  return (
    <div
      className={`pixel tres${textos ? '' : ' sem-textos'}`}
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
              {id === 'voce' && aguardando && emailChegouEmVoce && <div className="balao balao-esperando_voce">{naSuaMesa > 1 ? `${naSuaMesa} posts esperando você!` : 'Post esperando você!'}</div>}
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
      {SALAS_DO_ANDAR.map((d, n) => (
        <div key={d.id} className="tres-etiqueta" ref={ref(`depto:${n}`)}>
          <div className="tres-placa" style={{ background: corDaSala(d) }}>
            <span className="so-largo">{d.nome}</span>
            <span className="so-estreito">{d.curto}</span>
          </div>
        </div>
      ))}
      {AGENTES.map((a) => (
        <div key={a.id} className="tres-etiqueta tres-caixa" ref={ref(`caixa:${a.id}`)} title="Caixa de entrada" />
      ))}
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
        </Fragment>
      ))}
      {GATOS.map(({ nome }) => (
        <div key={nome} className="tres-etiqueta" ref={ref(`gato:${nome}`)}>
          {miau[nome] && <div className="balao balao-gato">{miau[nome]}</div>}
        </div>
      ))}
      <div className="tres-dica">Arraste para passear · roda para aproximar · botão direito gira · clique na Maki e no Gojo</div>
      <button type="button" className="tres-textos" onClick={trocarTextos} aria-pressed={!textos} title={textos ? 'Esconder nomes, placas e balões' : 'Mostrar nomes, placas e balões'}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {!textos && <path d="M3 3l18 18" />}
        </svg>
        {textos ? 'Ocultar textos' : 'Mostrar textos'}
      </button>
    </div>
  )
}
