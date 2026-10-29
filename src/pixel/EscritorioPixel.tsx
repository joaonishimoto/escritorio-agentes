import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { tocarAviso } from '../lib/som'
import { AGENTES, agentePorId, type AgenteId } from '../agents/catalogo'
import { selecionarEsperandoVoce, useEscritorio, type Entrega, type Estado } from '../store/escritorio'
import { quadro, BONECO, type Direcao, type Visual } from './sprites'
import {
  ANDAR_H, CAFE, CALENDARIO, DEPTOS, PLACA, QUADROS, CORREDOR_PES, LINHA_DEPTO, LINHA_HALL, MESAS, MESA_VOCE, ORDEM_ESTILOS, PAREDE_DEPTO_Y, PASSO_SALA,
  PORTA_VOCE_X, PORTA_X, SALA_W, VOCE_W, assento, ateOHall, dentroDaSala, desenharCalendario, desenharCorredor, desenharMesaVoce,
  desenharParedeEntre, desenharSala, desenharSuaSala, doHallAte, estiloDaSala, type Quadro, type SalaCustom,
  COFRINHO, DECORAR, GAVETA, FIN_W, GRAFICO_FIN, MESA_FIN, desenharGraficoFin, desenharMesaFin, desenharSalaFin,
} from './mapa'

export interface MarcaNoAndar {
  id: string
  nome: string
  /** cor que representa a marca na sala */
  cor?: string
  /** ordem em que a sala foi criada: decide o estilo padrão, mesmo com a sala mudando de lugar no andar */
  ordem?: number
  /** o que o dono personalizou na sala: pisos, paredes, móveis */
  sala?: SalaCustom | null
}

const VISUAL_FIN: Visual = { cabelo: '#4a4a4a', pele: '#c98e66', camisa: '#3f7650' }

// cada agente tem um cabelo e um tom de pele, para dar para reconhecer de longe
const VISUAL: Record<AgenteId | 'voce', Visual> = {
  chefe: { cabelo: '#2b2420', pele: '#e9b98f', camisa: agentePorId('chefe').cor },
  pesquisador: { cabelo: '#7a4a2a', pele: '#f3cfa8', camisa: agentePorId('pesquisador').cor },
  redator: { cabelo: '#e3b85a', pele: '#f3cfa8', camisa: agentePorId('redator').cor },
  designer: { cabelo: '#d9667a', pele: '#c98e66', camisa: agentePorId('designer').cor },
  cinegrafista: { cabelo: '#3b2a4a', pele: '#e0a87c', camisa: agentePorId('cinegrafista').cor },
  narrador: { cabelo: '#5a3a22', pele: '#a86f4c', camisa: agentePorId('narrador').cor },
  revisor: { cabelo: '#9a9a9a', pele: '#f0c7a0', camisa: agentePorId('revisor').cor },
  publicador: { cabelo: '#1c1c1c', pele: '#8d5a3c', camisa: agentePorId('publicador').cor },
  curador: { cabelo: '#b5462f', pele: '#f3cfa8', camisa: agentePorId('curador').cor },
  voce: { cabelo: '#1c1c1c', pele: '#e9c39a', camisa: '#1e3d66', calca: '#262820' },
}

const VELOCIDADE = 58 // pixels por segundo
const DEPURAR = typeof location !== 'undefined' && new URLSearchParams(location.search).has('depurar')
const TEMPO_MINIMO_NA_MESA = 1600 // ms trabalhando na pasta antes de levantar com a próxima
type Ponto = [number, number]

interface Andante {
  id: string
  quem: AgenteId | 'voce'
  sala: number // índice da sala de origem (-1 para você)
  ida: Ponto[]
  volta: Ponto[]
  fase: 'ida' | 'parado' | 'volta'
  dist: number
  parouEm: number
  pasta: boolean
  /** você não levanta: manda uma cartinha que voa da sua mesa até a mesa de quem recebe */
  carta?: boolean
  alvo?: { sala: number; quem: AgenteId | 'voce' }
}

const comprimento = (p: Ponto[]) => p.slice(1).reduce((s, b, i) => s + Math.hypot(b[0] - p[i][0], b[1] - p[i][1]), 0)
function noCaminho(p: Ponto[], d: number): { x: number; y: number; dir: Direcao } {
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

/**
 * O andar em pixel art: salas das marcas lado a lado, corredor embaixo e a sua sala no fim.
 * Quem entrega trabalho levanta e leva a pasta andando até a mesa de quem recebe.
 */
export function EscritorioPixel({
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
}: {
  marcas: MarcaNoAndar[]
  marcaAtiva: string | null
  aoEscolherMarca: (id: string) => void
  /** o que aparece nos quadros da parede de cada sala: dias com post neste mês e quantas regras estão ativas */
  quadros?: Record<string, { dias: number[]; regras: number; referencias?: number; gaveta?: number }>
  /** clique nas referências, no calendário, no branding ou no mural de regras de uma sala */
  aoAbrirQuadro?: (marcaId: string, quadro: Quadro) => void
  /** gastos dos últimos dias (gráfico da parede) e quantas dicas o Financeiro tem para você */
  financeiro?: { barras: number[]; dicas: number; alerta: boolean }
  /** o que aparece embaixo do cofrinho de cada sala (gasto do mês), por marca */
  cofres?: Record<string, string>
  /** o que os agentes de cada sala estão fazendo no post dela (a sala aberta usa o post aberto, com as pastas andando) */
  porSala?: Record<string, Partial<Record<string, Estado>>>
  /** quantos posts de todas as marcas estão esperando você */
  naSuaMesa?: number
  /** clique no kit de decoração de uma sala */
  aoEditarSala?: (marcaId: string) => void
  /** arrastar os nomes da barra muda a ordem das salas (ids da esquerda para a direita) */
  aoReordenar?: (ids: string[]) => void
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const tela = useRef<HTMLCanvasElement>(null)
  /** camada só com quem está andando, por cima dos nomes e balões */
  const frente = useRef<HTMLCanvasElement>(null)
  const etiquetas = useRef<Map<string, HTMLDivElement>>(new Map())
  // estilo escolhido antes, quando ficava só neste navegador: vale até o dono personalizar a sala
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
  const xVoce = marcas.length * PASSO_SALA
  // sala do Financeiro depois da sua, separada por uma parede
  const xFin = xVoce + VOCE_W + 16
  const largura = xFin + FIN_W
  const corDe = (m: MarcaNoAndar) => m.cor ?? '#2a5288'
  const padraoDe = (m: MarcaNoAndar, i: number) => estilosAntigos[m.id] ?? ORDEM_ESTILOS[(m.ordem ?? i) % ORDEM_ESTILOS.length]
  const estiloDe = (m: MarcaNoAndar, i: number) => estiloDaSala(padraoDe(m, i), corDe(m), m.sala)

  // estado que o laço de desenho lê sem precisar renderizar o React de novo
  const vivo = useRef({ estados, aguardando, selecionado, indiceAtivo, foco, porSala, irPara: null as number | null, mudouEm: {} as Record<string, number>, ultimoEstado: {} as Record<string, Estado> })
  vivo.current.porSala = porSala
  vivo.current.estados = estados
  vivo.current.aguardando = aguardando
  vivo.current.selecionado = selecionado
  vivo.current.indiceAtivo = indiceAtivo
  vivo.current.foco = foco
  for (const a of AGENTES) {
    if (vivo.current.ultimoEstado[a.id] !== estados[a.id]) {
      vivo.current.ultimoEstado[a.id] = estados[a.id]
      vivo.current.mudouEm[a.id] = performance.now()
    }
  }

  // cenário parado, desenhado uma vez por mudança de salas ou estilos
  const cenario = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = largura
    c.height = ANDAR_H
    const g = c.getContext('2d')!
    desenharCorredor(g, largura)
    const hoje = new Date().getDate()
    marcas.forEach((m, i) => {
      const q = quadros?.[m.id]
      desenharSala(g, i * PASSO_SALA, estiloDe(m, i), (m.sala?.base ?? padraoDe(m, i)) === 'e', { dias: new Set(q?.dias ?? []), hoje, regras: q?.regras ?? 0, referencias: q?.referencias ?? 0, gaveta: q?.gaveta ?? 0 })
      desenharParedeEntre(g, i * PASSO_SALA + SALA_W)
    })
    desenharSuaSala(g, xVoce)
    desenharParedeEntre(g, xVoce + VOCE_W)
    desenharSalaFin(g, xFin)
    desenharGraficoFin(g, xFin, financeiro?.barras ?? [], !!financeiro?.alerta)
    return c
  }, [marcas, largura, xVoce, quadros, financeiro?.barras.join(','), financeiro?.alerta]) // eslint-disable-line react-hooks/exhaustive-deps

  const diasMarcados = useMemo(() => {
    const hoje = new Date()
    return new Set(
      agenda
        .map((a) => new Date(a.data))
        .filter((d) => d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear())
        .map((d) => d.getDate()),
    )
  }, [agenda])
  const diasRef = useRef(diasMarcados)
  diasRef.current = diasMarcados

  /** retângulo do dia no calendário da parede da sua sala (mesma conta do desenharCalendario) */
  const celulaDoDia = (d: number): [number, number, number, number] => {
    const { x, y, w, h } = CALENDARIO
    const passoX = (w - 4) / 7
    const passoY = (h - 8) / 5
    return [Math.round(xVoce + x + 2 + ((d - 1) % 7) * passoX), Math.round(y + 7 + Math.floor((d - 1) / 7) * passoY), Math.max(3, Math.round(passoX - 1.4)), Math.max(2, Math.round(passoY - 1.4))]
  }
  // post que acabou de ser agendado ou publicado: uma folhinha sai da sala da marca e voa até o dia no calendário da sua sala
  const folhas = useRef<{ de: Ponto; dia: number; cor: string; inicio: number }[]>([])
  const pousou = useRef<Map<number, number>>(new Map())
  const vistos = useRef<Set<string> | null>(null)
  useEffect(() => {
    // sem nada com data ao abrir: depois de uns segundos, o primeiro post agendado já anima
    const id = window.setTimeout(() => {
      if (vistos.current === null) vistos.current = new Set(useEscritorio.getState().agenda.map((a) => `${a.id}:${a.status}`))
    }, 5000)
    return () => window.clearTimeout(id)
  }, [])
  useEffect(() => {
    const chaves = new Set(agenda.map((a) => `${a.id}:${a.status}`))
    // a primeira lista que chega (ao abrir o app) não anima; o que mudar depois, sim
    if (vistos.current === null) {
      if (agenda.length) vistos.current = chaves
      return
    }
    const hoje = new Date()
    for (const a of agenda) {
      if (vistos.current.has(`${a.id}:${a.status}`) || a.status === 'falhou') continue
      const d = new Date(a.data)
      if (d.getMonth() !== hoje.getMonth() || d.getFullYear() !== hoje.getFullYear()) continue
      const i = marcas.findIndex((m) => m.id === a.marcaId)
      const de: Ponto = i >= 0 ? [i * PASSO_SALA + PLACA.x, PLACA.y - 10] : [xVoce + MESA_VOCE.x + 17, MESA_VOCE.y]
      folhas.current.push({ de, dia: d.getDate(), cor: a.cor ?? (a.status === 'publicado' ? '#3f7650' : '#f2b233'), inicio: performance.now() + folhas.current.length * 250 })
    }
    vistos.current = chaves
  }, [agenda]) // eslint-disable-line react-hooks/exhaustive-deps

  const andantes = useRef<Andante[]>([])
  const gatos = useRef<Gato[]>(GATOS.map((x, n) => ({ ...x, sala: n, area: -1, x: 60 + n * 150, y: 200, rota: [], dist: 0, ate: 0, dormindo: false, dir: 1 })))
  const [miau, setMiau] = useState<Record<string, string>>({})
  /** objeto do hall sob o mouse: o nome dele só aparece assim (ou quando está aberto) */
  const [sobre, setSobre] = useState<string | null>(null)
  const falarGato = (nome: string, texto: string) => {
    setMiau((m) => ({ ...m, [nome]: texto }))
    window.setTimeout(() => setMiau((m) => {
      const resto = { ...m }
      delete resto[nome]
      return resto
    }), 2600)
  }
  const pastasNaMesa = useRef<Map<string, number>>(new Map())
  /** quando cada um recebeu a última pasta: só levanta para entregar depois de um tempo trabalhando nela */
  const recebeuEm = useRef<Map<string, number>>(new Map())
  const [pastaChegouEmVoce, setPastaChegouEmVoce] = useState(true)
  const pastaEmVoceRef = useRef(true)
  const camera = useRef({ x: 0, arrasto: 0, soltouEm: 0 })
  /** para onde a câmera olhava antes de abrir o calendário */
  const alvoAntes = useRef<number | null>(null)
  const geom = useRef({ escala: 3, offY: 0, larguraVista: 0 })

  // ── caminhos ──
  const pes = (sala: number, quem: AgenteId | 'voce'): Ponto => {
    if (quem === 'voce') return [xVoce + MESA_VOCE.x + MESA_VOCE.w / 2, MESA_VOCE.y - 2]
    const a = assento(MESAS[quem])
    return [sala * PASSO_SALA + a.x, a.y]
  }
  const naSala = (sala: number, pontos: Ponto[]): Ponto[] => pontos.map(([x, y]) => [sala * PASSO_SALA + x, y])
  const daSuaMesaAtePorta = (): Ponto[] => {
    const [x, y] = pes(-1, 'voce')
    return [[x, y], [xVoce + 50, y], [xVoce + 50, 124], [xVoce + PORTA_VOCE_X, 124], [xVoce + PORTA_VOCE_X, CORREDOR_PES]]
  }
  const caminho = (de: { sala: number; quem: AgenteId | 'voce' }, para: { sala: number; quem: AgenteId | 'voce' }): Ponto[] => {
    // mesma sala: sai pela porta do departamento se precisar e para ao lado da cadeira de quem recebe
    if (de.quem !== 'voce' && para.quem !== 'voce' && de.sala === para.sala) return naSala(de.sala, dentroDaSala(MESAS[de.quem], MESAS[para.quem]))
    const saida: Ponto[] =
      de.quem === 'voce'
        ? daSuaMesaAtePorta()
        : naSala(de.sala, [...ateOHall(MESAS[de.quem]), [PORTA_X, LINHA_HALL], [PORTA_X, CORREDOR_PES]])
    const chegada: Ponto[] =
      para.quem === 'voce'
        ? [...daSuaMesaAtePorta()].reverse().slice(0, -1).concat([[pes(-1, 'voce')[0], MESA_VOCE.y + 24]])
        : naSala(para.sala, [[PORTA_X, CORREDOR_PES], [PORTA_X, LINHA_HALL], ...doHallAte(MESAS[para.quem])])
    return [...saida, ...chegada]
  }

  const pendentes = useRef<Entrega[]>([])
  /** Quem está esperando uma pasta que ainda está a caminho: na tela continua "na fila", mesmo que o servidor já tenha andado. */
  const aCaminhoDe = () => new Set(andantes.current.filter((a) => (a.pasta || a.carta) && a.fase === 'ida' && a.alvo).map((a) => a.alvo!.quem))

  const andando = (quem: AgenteId | 'voce', sala: number) => andantes.current.some((a) => a.quem === quem && a.sala === sala && !a.carta)

  // cada entrega nova vira alguém levantando e levando a pasta
  useEffect(
    () =>
      useEscritorio.subscribe((s, antes) => {
        // trocou de post: quem estava levando pasta do post anterior volta para a mesa na hora
        if (s.eventos.length === 0 && antes.eventos.length > 0) {
          pendentes.current = []
          andantes.current = andantes.current.filter((a) => !a.pasta)
          pastasNaMesa.current.clear()
          recebeuEm.current.clear()
          return
        }
        const novas = s.entregas.filter((e) => !antes.entregas.some((x) => x.id === e.id))
        // não sai andando na hora: entra na fila e só sai quando a pasta anterior chegar até quem entrega
        pendentes.current.push(...novas)
      }),
    [marcas.length],
  )

  // dois dedos no touchpad (ou a roda do mouse) passeiam pelo andar, sem precisar clicar e arrastar
  useEffect(() => {
    const c = tela.current
    if (!c) return
    const rolar = (e: WheelEvent) => {
      if (e.ctrlKey) return // pinça de zoom do navegador
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (!delta) return
      e.preventDefault() // evita o "voltar página" do gesto horizontal
      const passo = e.deltaMode === 1 ? delta * 16 : delta
      const dpr = window.devicePixelRatio || 1
      camera.current.arrasto += (passo * dpr) / geom.current.escala
      camera.current.soltouEm = performance.now()
    }
    c.addEventListener('wheel', rolar, { passive: false })
    return () => c.removeEventListener('wheel', rolar)
  }, [])

  // laço de desenho
  useEffect(() => {
    const c = tela.current!
    const g = c.getContext('2d')!
    let quadroId = 0
    let anterior = performance.now()
    let proximoPasseio = performance.now() + 30000

    const desenhar = (agora: number) => {
      const dt = Math.min((agora - anterior) / 1000, 0.05)
      anterior = agora
      const t = agora / 1000
      const v = vivo.current
      const dpr = window.devicePixelRatio || 1
      const cw = c.clientWidth
      const ch = c.clientHeight
      if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(ch * dpr)) {
        c.width = Math.round(cw * dpr)
        c.height = Math.round(ch * dpr)
      }
      // no celular a sala inteira cabe na largura: escala menor, mas sempre em pixels inteiros da tela
      // pixels inteiros da tela (não do CSS): numa tela retina a sala cresce em passos menores e ocupa mais da altura
      const porAltura = Math.max(2 * dpr, Math.min(6 * dpr, Math.floor((ch * dpr) / (ANDAR_H + 8)))) / dpr
      const porLargura = cw / (SALA_W + 12)
      const escala = porLargura < porAltura ? Math.max(dpr, Math.floor(porLargura * dpr)) : Math.round(porAltura * dpr)
      const vistaW = c.width / escala
      // no celular o andar fica no alto, deixando espaço embaixo para as gavetas
      const offY = porLargura < porAltura
        ? Math.round(Math.min((c.height / escala - ANDAR_H) / 2, (64 * dpr) / escala))
        : Math.round((c.height / escala - ANDAR_H) / 2)
      geom.current = { escala, offY, larguraVista: vistaW }

      // passeio até o café de vez em quando, para o andar não ficar parado
      // raro, um por vez, e nunca na sala que está com post em produção
      const salaOcupada = AGENTES.some((a) => ['trabalhando', 'na_fila', 'esperando_voce'].includes(v.estados[a.id]))
      if (agora > proximoPasseio && !andantes.current.some((a) => !a.pasta)) {
        proximoPasseio = agora + 40000 + Math.random() * 40000
        const sala = Math.floor(Math.random() * marcas.length)
        const livres = sala === v.indiceAtivo && salaOcupada ? [] : AGENTES.filter((a) => !andando(a.id, sala))
        const a = livres[Math.floor(Math.random() * livres.length)]
        if (a) {
          const ida = naSala(sala, [...ateOHall(MESAS[a.id]), [CAFE.x + 16, LINHA_HALL]])
          andantes.current.push({ id: `cafe-${agora}`, quem: a.id, sala, ida, volta: [...ida].reverse(), fase: 'ida', dist: 0, parouEm: 0, pasta: false })
        }
      }

      // solta as entregas da fila na ordem: quem entrega precisa ter recebido a pasta, trabalhado nela um pouco na tela
      // e estar sentado (se estava no café, volta antes)
      const chegando = aCaminhoDe()
      pendentes.current = pendentes.current.filter((e) => {
        const sala = v.indiceAtivo
        const de = { sala: e.de === 'voce' ? -1 : sala, quem: e.de }
        if (chegando.has(e.de)) return true
        if (pendentes.current.some((x) => x !== e && x.para === e.de && pendentes.current.indexOf(x) < pendentes.current.indexOf(e))) return true
        const recebeu = recebeuEm.current.get(`${de.sala}:${e.de}`)
        if (recebeu !== undefined && agora - recebeu < TEMPO_MINIMO_NA_MESA) return true
        const emPe = andantes.current.find((a) => a.quem === e.de && a.sala === de.sala && !a.carta)
        if (emPe) {
          // no café: interrompe e volta para a mesa pelo mesmo caminho
          if (!emPe.pasta && emPe.fase !== 'volta') {
            emPe.dist = emPe.fase === 'ida' ? comprimento(emPe.ida) - emPe.dist : 0
            emPe.fase = 'volta'
          }
          return true
        }
        const para = { sala: e.para === 'voce' ? -1 : sala, quem: e.para }
        if (e.de === 'voce' && e.para !== 'voce') {
          // cartinha em linha reta da sua mesa até a mesa de quem recebe (o arco é desenhado no voo)
          const m = MESAS[e.para]
          const ida: Ponto[] = [[xVoce + MESA_VOCE.x + 25, MESA_VOCE.y + 4], [sala * PASSO_SALA + m.x + 15, m.y + 2]]
          andantes.current.push({ id: e.id, quem: 'voce', sala: -1, ida, volta: ida, fase: 'ida', dist: 0, parouEm: 0, pasta: false, carta: true, alvo: para })
          chegando.add(e.para)
          return false
        }
        const ida = caminho(de, para)
        andantes.current.push({ id: e.id, quem: e.de, sala: de.sala, ida, volta: [...ida].reverse(), fase: 'ida', dist: 0, parouEm: 0, pasta: true, alvo: para })
        chegando.add(e.para)
        return false
      })
      // você só pula quando a pasta chega na sua mesa, não quando o servidor avisa
      const pastaEmVoce = !chegando.has('voce') && !pendentes.current.some((e) => e.para === 'voce')
      if (pastaEmVoce !== pastaEmVoceRef.current) {
        pastaEmVoceRef.current = pastaEmVoce
        setPastaChegouEmVoce(pastaEmVoce)
      }
      const voceAguardando = v.aguardando && pastaEmVoce
      const esperandoPasta = (i: number, id: AgenteId) => i === v.indiceAtivo && (chegando.has(id) || pendentes.current.some((e) => e.de === id || e.para === id))
      const estadoNaTela = (i: number, id: AgenteId): Estado =>
        i !== v.indiceAtivo ? (v.porSala?.[marcas[i]?.id]?.[id] ?? 'ocioso') : esperandoPasta(i, id) ? 'na_fila' : v.estados[id]

      if (DEPURAR) {
        ;(window as unknown as { __pixel: unknown }).__pixel = {
          t: Math.round(agora),
          andantes: andantes.current.map((a) => {
            const p = noCaminho(a.fase === 'volta' ? a.volta : a.ida, Math.max(0, a.dist))
            return { quem: a.quem, fase: a.fase, pasta: a.pasta, alvo: a.alvo?.quem, x: Math.round(p.x), y: Math.round(p.y), cafe: a.id.startsWith('cafe') }
          }),
          pendentes: pendentes.current.map((e) => `${e.de}>${e.para}`),
          estados: Object.fromEntries(AGENTES.map((a) => [a.id, estadoNaTela(v.indiceAtivo, a.id)])),
          voceAguardando,
          folhas: folhas.current.length,
          loja: useEscritorio,
        }
      }

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
        // caminhos longos (atravessar o corredor) andam mais rápido: ninguém leva mais que ~6 s
        a.dist += (a.carta ? Math.max(120, comprimento(rota) / 1.8) : Math.max(VELOCIDADE, comprimento(rota) / 6)) * dt
        if (a.dist >= comprimento(rota)) {
          if (a.carta) {
            pastasNaMesa.current.set(`${a.alvo!.sala}:${a.alvo!.quem}`, agora)
            recebeuEm.current.set(`${a.alvo!.sala}:${a.alvo!.quem}`, agora)
            a.dist = -1
          } else if (a.fase === 'ida') {
            a.fase = 'parado'
            a.parouEm = agora
            if (a.alvo) {
              pastasNaMesa.current.set(`${a.alvo.sala}:${a.alvo.quem}`, agora)
              recebeuEm.current.set(`${a.alvo.sala}:${a.alvo.quem}`, agora)
              if (a.alvo.quem === 'voce') tocarAviso()
            }
          } else a.dist = -1
        }
      }
      andantes.current = andantes.current.filter((a) => a.dist >= 0)

      // câmera: fica na sala escolhida (ou na sua / do Financeiro); só sai dali quando você clica ou arrasta
      // o calendário abre por cima de onde você está (o da sala ou o da sua mesa): a câmera não sai do lugar
      const alvoX =
        v.foco === 'calendario' && alvoAntes.current !== null
          ? alvoAntes.current
          : v.foco === 'financeiro' ? xFin + FIN_W / 2 : v.foco === 'voce' ? xVoce + VOCE_W / 2 : v.irPara ?? v.indiceAtivo * PASSO_SALA + SALA_W / 2
      alvoAntes.current = alvoX
      const cam = camera.current
      const livre = agora - cam.soltouEm > 8000
      const maxX = Math.max(0, largura - vistaW)
      // o deslocamento manual não passa das pontas do andar (senão rolar para trás demora a responder)
      const base = alvoX - vistaW / 2
      cam.arrasto = Math.max(-base, Math.min(maxX - base, cam.arrasto))
      const desejado = base + (livre ? 0 : cam.arrasto)
      if (livre) cam.arrasto *= 0.9
      cam.x += (desejado - cam.x) * Math.min(1, dt * (livre ? 3 : 10))
      const camX = largura < vistaW ? (largura - vistaW) / 2 : Math.max(0, Math.min(maxX, cam.x))

      g.setTransform(1, 0, 0, 1, 0, 0)
      g.imageSmoothingEnabled = false
      g.fillStyle = '#1f2330'
      g.fillRect(0, 0, c.width, c.height)
      g.setTransform(escala, 0, 0, escala, -Math.round(camX * escala), offY * escala)
      g.drawImage(cenario, 0, 0)
      desenharCalendario(g, xVoce, diasRef.current, new Date().getDate(), CALENDARIO)
      // o dia em que a folhinha pousou pisca por um instante
      for (const [dia, quando] of pousou.current) {
        const k = (agora - quando) / 1000
        if (k > 1.6) {
          pousou.current.delete(dia)
          continue
        }
        const [cx, cy, cw2, ch2] = celulaDoDia(dia)
        if (Math.floor(k * 6) % 2 === 0) {
          g.fillStyle = '#ffffff'
          g.fillRect(cx - 1, cy - 1, cw2 + 2, ch2 + 2)
          g.fillStyle = '#f2b233'
          g.fillRect(cx, cy, cw2, ch2)
        }
      }

      // telas dos monitores
      marcas.forEach((_, i) => {
        for (const a of AGENTES) {
          const m = MESAS[a.id]
          const x = i * PASSO_SALA + m.x + 8
          const y = m.y - 8
          const est = estadoNaTela(i, a.id)
          if (est === 'trabalhando') {
            g.fillStyle = '#0f1a2a'
            g.fillRect(x, y, 14, 9)
            g.fillStyle = a.cor
            for (let l = 0; l < 4; l++) {
              const w = 3 + ((Math.floor(t * 6) + l * 3 + i) % 9)
              g.fillRect(x + 1, y + 1 + l * 2, Math.min(w, 12), 1)
            }
          } else if (est === 'concluido') {
            g.fillStyle = '#1d3a28'
            g.fillRect(x, y, 14, 9)
            g.fillStyle = '#7fd197'
            g.fillRect(x + 4, y + 5, 2, 2)
            g.fillRect(x + 6, y + 6, 2, 1)
            g.fillRect(x + 8, y + 2, 2, 4)
          } else if (est === 'erro') {
            g.fillStyle = Math.floor(t * 3) % 2 ? '#5a1f1b' : '#2a2d36'
            g.fillRect(x, y, 14, 9)
          }
        }
      })

      // pastas que acabaram de chegar ficam um tempo em cima da mesa
      for (const [chave, quando] of pastasNaMesa.current) {
        if (agora - quando > 6000) {
          pastasNaMesa.current.delete(chave)
          continue
        }
        const [s, quem] = chave.split(':')
        if (quem === 'voce') pasta(g, xVoce + MESA_VOCE.x + 22, MESA_VOCE.y + 1)
        else pasta(g, Number(s) * PASSO_SALA + MESAS[quem as AgenteId].x + 1, MESAS[quem as AgenteId].y + 2)
      }

      // bonecos sentados (de costas, olhando o monitor)
      const posicoesEtiqueta: Record<string, [number, number] | null> = {}
      const posicoesNome: Record<string, [number, number] | null> = {}
      const emPe = new Set<string>()
      marcas.forEach((_, i) => {
        for (const a of AGENTES) {
          if (andando(a.id, i)) continue
          const m = MESAS[a.id]
          const est = estadoNaTela(i, a.id)
          const desde = (agora - (v.mudouEm[a.id] ?? 0)) / 1000
          let dy = 0
          if (est === 'trabalhando') dy = Math.floor(t * 8) % 2
          if (est === 'concluido' && i === v.indiceAtivo && desde < 0.6) dy = -Math.round(Math.sin((desde / 0.6) * Math.PI) * 8)
          const x = i * PASSO_SALA + m.x + MESA_W2 - BONECO.w / 2
          const y = m.y + 10 + dy
          g.drawImage(quadro(VISUAL[a.id], 'cima', 0, true), x, y)
          if (est === 'na_fila') reticencias(g, x + 2, y - 8, t)
          if (est === 'esperando_voce' || est === 'erro') exclamacao(g, x + 5, y - 12 + Math.round(Math.sin(t * 6)), est === 'erro' ? '#e05a4f' : '#f2b233')
          if (i === v.indiceAtivo) {
            if (est === 'concluido' && desde < 0.8) faiscas(g, x + 7, y + 4, desde)
            if (v.selecionado === a.id) seta(g, x + 4, y - 10 + Math.round(Math.sin(t * 5) * 1.5))
            posicoesEtiqueta[a.id] = [x + 7, m.y - 11]
            posicoesNome[a.id] = [x + 7, m.y + 27]
          }
        }
      })

      // você, atrás da sua mesa e de frente para a sala
      if (!andando('voce', -1)) {
        const [vx, vy] = pes(-1, 'voce')
        const pulo = voceAguardando ? -Math.abs(Math.round(Math.sin(t * 7) * 4)) : 0
        g.drawImage(quadro(VISUAL.voce, 'baixo', 0, true), vx - 7, vy - 16 + pulo + 6)
        if (voceAguardando) exclamacao(g, vx - 2, vy - 30 + Math.round(Math.sin(t * 6)), '#f2b233')
        posicoesEtiqueta.voce = [vx, vy - 14 + pulo]
        posicoesNome.voce = [vx, MESA_VOCE.y + 18]
      } else posicoesEtiqueta.voce = null
      desenharMesaVoce(g, xVoce)

      // o Financeiro, sentado atrás da mesa dele e de frente para a sala
      {
        const fx = xFin + MESA_FIN.x + MESA_FIN.w / 2
        const fy = MESA_FIN.y - 2
        g.drawImage(quadro(VISUAL_FIN, 'baixo', 0, true), fx - 7, fy - 10)
        desenharMesaFin(g, xFin)
        posicoesEtiqueta.financeiro = [fx, fy - 14]
        posicoesNome.financeiro = [fx, MESA_FIN.y + 18]
      }

      // quem está andando vai numa camada por cima dos textos, por ordem de altura para um passar na frente do outro
      const cf = frente.current
      const gf = cf?.getContext('2d')
      if (cf && gf) {
        if (cf.width !== c.width || cf.height !== c.height) {
          cf.width = c.width
          cf.height = c.height
        }
        gf.setTransform(1, 0, 0, 1, 0, 0)
        gf.clearRect(0, 0, cf.width, cf.height)
        gf.imageSmoothingEnabled = false
        gf.setTransform(escala, 0, 0, escala, -Math.round(camX * escala), offY * escala)
      }
      const gAndando = gf ?? g
      const ordenados = [...andantes.current].sort((a, b) => {
        const pa = noCaminho(a.fase === 'volta' ? a.volta : a.ida, Math.max(0, a.dist))
        const pb = noCaminho(b.fase === 'volta' ? b.volta : b.ida, Math.max(0, b.dist))
        return pa.y - pb.y
      })
      for (const a of ordenados) {
        if (a.carta) {
          // voa em arco, balançando, com um rastro de pontinhos
          const total = comprimento(a.ida)
          const k = total ? Math.max(0, a.dist) / total : 1
          const altura = Math.min(70, 24 + total / 12)
          const ponto = (q: number) => {
            const p = noCaminho(a.ida, q * total)
            return [p.x, p.y - Math.sin(q * Math.PI) * altura] as const
          }
          gAndando.fillStyle = 'rgba(255,255,255,.7)'
          for (let r = 1; r <= 4; r++) {
            const q = k - r * 0.035
            if (q <= 0) break
            const [rx, ry] = ponto(q)
            gAndando.fillRect(Math.round(rx), Math.round(ry), 2, 2)
          }
          const [cx, cy] = ponto(k)
          carta(gAndando, Math.round(cx - 6), Math.round(cy - 4 + Math.sin(t * 14) * 1.5))
          continue
        }
        const rota = a.fase === 'volta' ? a.volta : a.ida
        const p = noCaminho(rota, Math.max(0, a.fase === 'parado' ? comprimento(a.ida) : a.dist))
        const passo = a.fase === 'parado' ? 0 : ((Math.floor(t * 8) % 2) + 1) as 1 | 2
        const dir = a.fase === 'parado' ? 'cima' : p.dir
        const x = Math.round(p.x - BONECO.w / 2)
        const y = Math.round(p.y - BONECO.h)
        gAndando.fillStyle = 'rgba(0,0,0,.18)'
        gAndando.fillRect(x + 2, y + BONECO.h - 2, BONECO.w - 4, 3)
        gAndando.drawImage(quadro(VISUAL[a.quem], dir, passo), x, y)
        if (a.pasta) pasta(gAndando, x + 3, y - 6 + (passo === 1 ? -1 : 0))
        if (a.sala === v.indiceAtivo || a.quem === 'voce') {
          posicoesEtiqueta[a.quem] = [x + 7, y - 2]
          posicoesNome[a.quem] = [x + 7, y + BONECO.h + 1]
          emPe.add(a.quem)
        }
      }

      // Maki e Gojo passeiam pelas salas: param um pouco, às vezes cochilam, às vezes mudam de sala pelo corredor
      for (const gt of gatos.current) {
        if (gt.sala >= marcas.length) gt.sala = 0
        if (!gt.rota.length) {
          if (agora < gt.ate) {
            // parado
          } else {
            const outra = marcas.length > 1 && Math.random() < 0.25
            const sala = outra ? Math.floor(Math.random() * marcas.length) : gt.sala
            const noDepto = Math.random() < 0.35
            const d = DEPTOS[Math.floor(Math.random() * DEPTOS.length)]
            const alvo: Ponto = noDepto
              ? [sala * PASSO_SALA + d.x + 10 + Math.random() * (d.w - 20), LINHA_DEPTO - 4 + Math.random() * 6]
              : [sala * PASSO_SALA + 14 + Math.random() * (SALA_W - 28), LINHA_HALL + Math.random() * 50]
            const x0 = gt.sala * PASSO_SALA
            const rota: Ponto[] = [[gt.x, gt.y]]
            if (gt.area >= 0) rota.push([x0 + DEPTOS[gt.area].porta, LINHA_DEPTO], [x0 + DEPTOS[gt.area].porta, LINHA_HALL])
            if (sala !== gt.sala) rota.push([x0 + PORTA_X, LINHA_HALL], [x0 + PORTA_X, CORREDOR_PES], [sala * PASSO_SALA + PORTA_X, CORREDOR_PES], [sala * PASSO_SALA + PORTA_X, LINHA_HALL])
            if (noDepto) rota.push([sala * PASSO_SALA + d.porta, LINHA_HALL], [sala * PASSO_SALA + d.porta, LINHA_DEPTO])
            rota.push(alvo)
            gt.rota = rota
            gt.dist = 0
            gt.sala = sala
            gt.area = noDepto ? DEPTOS.indexOf(d) : -1
            gt.dormindo = false
          }
        } else {
          gt.dist += 26 * dt
          const p = noCaminho(gt.rota, gt.dist)
          if (Math.abs(p.x - gt.x) > 0.01) gt.dir = p.x > gt.x ? 1 : -1
          gt.x = p.x
          gt.y = p.y
          if (gt.dist >= comprimento(gt.rota)) {
            gt.rota = []
            gt.dormindo = Math.random() < 0.3
            gt.ate = agora + (gt.dormindo ? 12000 : 2500) + Math.random() * 6000
          }
        }
        const andandoAgora = gt.rota.length > 0
        gato(gAndando, Math.round(gt.x), Math.round(gt.y), gt, andandoAgora ? Math.floor(t * 8) % 2 : -1, t)
        posicoesEtiqueta[`gato:${gt.nome}`] = [gt.x, gt.y - 12]
      }

      // folhinhas voando até o calendário da sua sala (a câmera vai junto enquanto voam)
      folhas.current = folhas.current.filter((f) => {
        const k = (agora - f.inicio) / 1800
        if (k < 0) return true
        const [cx, cy, cw2, ch2] = celulaDoDia(f.dia)
        const para: Ponto = [cx + cw2 / 2, cy + ch2 / 2]
        if (k >= 1) {
          pousou.current.set(f.dia, agora)
          return false
        }
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        const x = f.de[0] + (para[0] - f.de[0]) * e
        const y = f.de[1] + (para[1] - f.de[1]) * e - Math.sin(k * Math.PI) * 60
        const tam = 1 - k * 0.55
        const w = Math.max(6, Math.round(16 * tam))
        const h = Math.max(7, Math.round(19 * tam))
        const fx = Math.round(x - w / 2)
        const fy = Math.round(y - h / 2 + Math.sin(t * 12) * 1.2)
        gAndando.fillStyle = '#1f2330'
        gAndando.fillRect(fx - 1, fy - 1, w + 2, h + 2)
        gAndando.fillStyle = '#ffffff'
        gAndando.fillRect(fx, fy, w, h)
        gAndando.fillStyle = f.cor
        gAndando.fillRect(fx, fy, w, Math.max(1, Math.round(h / 4)))
        gAndando.fillStyle = '#c9ced8'
        for (let l = Math.round(h / 4) + 2; l < h - 1; l += 3) gAndando.fillRect(fx + 2, fy + l, w - 4, 1)
        return true
      })

      // etiquetas em HTML acompanham os bonecos
      for (const [chave, el] of etiquetas.current) {
        if (chave.startsWith('placa:')) {
          const i = Number(chave.slice(6))
          const sx = ((i * PASSO_SALA + PLACA.x - camX) * escala) / dpr
          const sy = ((PLACA.y + offY) * escala) / dpr
          el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`
          el.style.fontSize = `${(escala / dpr) * 9}px`
          continue
        }
        if (chave.startsWith('depto:')) {
          const [s, n] = chave.slice(6).split(':').map(Number)
          // placa de porta: no hall, logo abaixo da porta de cada departamento
          el.style.transform = `translate(${((s * PASSO_SALA + DEPTOS[n].porta - camX) * escala) / dpr}px, ${((PAREDE_DEPTO_Y + 8 + offY) * escala) / dpr}px) translate(-50%, 0)`
          continue
        }
        if (chave.startsWith('cofre:') || chave.startsWith('decorar:') || chave.startsWith('gaveta:')) {
          // embaixo do cofrinho, do kit de decoração e da gaveta de cada sala
          const [tipo, n] = chave.split(':')
          const s = Number(n)
          const ref = tipo === 'cofre' ? COFRINHO : tipo === 'gaveta' ? GAVETA : DECORAR
          el.style.transform = `translate(${((s * PASSO_SALA + ref.x + ref.w / 2 - camX) * escala) / dpr}px, ${((ref.y + ref.h + offY) * escala) / dpr}px) translate(-50%, 0)`
          continue
        }
        const nome = chave.startsWith('nome:')
        const id = nome ? chave.slice(5) : chave
        const pos = !nome && id !== 'voce' && id !== 'financeiro' && esperandoPasta(v.indiceAtivo, id as AgenteId) ? null : (nome ? posicoesNome : posicoesEtiqueta)[id]
        if (!pos) {
          el.style.opacity = '0'
          continue
        }
        el.style.opacity = '1'
        // ordem fixa: balões por cima de tudo, depois quem está andando (mais embaixo na tela na frente), depois os sentados
        el.style.zIndex = String(nome ? (emPe.has(id) ? 200 + Math.round(pos[1]) : 100) : 1000)
        let sx = (pos[0] - camX) * escala / dpr
        const sy = (pos[1] + offY) * escala / dpr
        // balão não sai pela borda da tela
        if (!nome) {
          const meia = el.offsetWidth / 2
          if (meia * 2 + 12 < cw) sx = Math.max(meia + 6, Math.min(cw - meia - 6, sx))
        }
        el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, ${nome ? '0' : '-100%'})`
      }
      quadroId = requestAnimationFrame(desenhar)
    }
    quadroId = requestAnimationFrame(desenhar)
    return () => cancelAnimationFrame(quadroId)
  }, [cenario, marcas, largura, xVoce]) // eslint-disable-line react-hooks/exhaustive-deps

  // clique: agente, sua mesa, calendário ou outra sala; arrastar move a câmera
  const arrastando = useRef<{ x: number; inicio: number; moveu: boolean } | null>(null)
  const paraMundo = (ev: React.PointerEvent) => {
    const c = tela.current!
    const rect = c.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const { escala, offY } = geom.current
    const vistaW = c.width / escala
    const cam = camera.current
    const maxX = Math.max(0, largura - vistaW)
    const camX = largura < vistaW ? (largura - vistaW) / 2 : Math.max(0, Math.min(maxX, cam.x))
    return { x: ((ev.clientX - rect.left) * dpr) / escala + camX, y: ((ev.clientY - rect.top) * dpr) / escala - offY }
  }
  const clicar = (x: number, y: number) => {
    const gt = gatos.current.find((g) => Math.abs(g.x - x) < 10 && y > g.y - 14 && y < g.y + 4)
    if (gt) return falarGato(gt.nome, gt.dormindo ? `${gt.nome} está cochilando… zzz` : `Miau! Eu sou ${gt.nome === 'Maki' ? 'a' : 'o'} ${gt.nome}`)
    if (x >= xFin) {
      const mx = xFin + MESA_FIN.x
      const naMesa = x >= mx - 6 && x <= mx + MESA_FIN.w + 6 && y >= MESA_FIN.y - 24 && y <= MESA_FIN.y + 20
      const noGrafico = x >= xFin + GRAFICO_FIN.x - 2 && x <= xFin + GRAFICO_FIN.x + GRAFICO_FIN.w + 2 && y <= GRAFICO_FIN.y + GRAFICO_FIN.h + 2
      return focar(naMesa || noGrafico ? 'financeiro' : null)
    }
    if (x >= xVoce) {
      const mx = xVoce + MESA_VOCE.x
      if (x >= xVoce + CALENDARIO.x && x <= xVoce + CALENDARIO.x + CALENDARIO.w && y <= CALENDARIO.y + CALENDARIO.h) return focar('calendario')
      if (x >= mx - 6 && x <= mx + MESA_VOCE.w + 6 && y >= MESA_VOCE.y - 24 && y <= MESA_VOCE.y + 20) return focar('voce')
      return focar(null) // clicou fora: fecha o painel aberto
    }
    const sala = Math.floor(x / PASSO_SALA)
    const lxQ = x - sala * PASSO_SALA
    vivo.current.irPara = null
    const dentro = (r: { x: number; y: number; w: number; h: number }, folga = 3) => lxQ >= r.x - folga && lxQ <= r.x + r.w + folga && y >= r.y - folga && y <= r.y + r.h + 8
    // cofrinho do hall: abre os gastos daquela sala
    if (marcas[sala] && dentro(COFRINHO)) {
      if (sala !== indiceAtivo) aoEscolherMarca(marcas[sala].id)
      return focar('cofre')
    }
    // kit de decoração: edita aquela sala
    if (marcas[sala] && dentro(DECORAR) && aoEditarSala) return aoEditarSala(marcas[sala].id)
    // gaveta de posts guardados daquela sala
    if (marcas[sala] && dentro(GAVETA)) {
      if (sala !== indiceAtivo) aoEscolherMarca(marcas[sala].id)
      return focar('gaveta')
    }
    const noQuadro = Object.values(QUADROS).some((r) => lxQ >= r.x - 2 && lxQ <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2)
    // outra sala: só leva a câmera até ela
    if (sala !== indiceAtivo && marcas[sala] && !noQuadro) {
      focar(null)
      return aoEscolherMarca(marcas[sala].id)
    }
    const lx = x - sala * PASSO_SALA
    // quadros da parede: referências, calendário, branding e regras desta sala
    for (const [q, r] of Object.entries(QUADROS) as [Quadro, (typeof QUADROS)[Quadro]][]) {
      if (lx >= r.x - 2 && lx <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2) {
        selecionar(null)
        return aoAbrirQuadro?.(marcas[sala].id, q)
      }
    }
    for (const a of AGENTES) {
      const m = MESAS[a.id]
      if (lx >= m.x && lx <= m.x + MESA_W2 * 2 && y >= m.y - 10 && y <= m.y + 28) return selecionar(a.id)
    }
    selecionar(null)
  }

  // barra das salas: leva a câmera até a sala, sem abrir nada
  const irPara = (alvo: { marca: string } | 'voce' | 'financeiro') => {
    focar(null)
    camera.current.arrasto = 0
    camera.current.soltouEm = 0
    if (typeof alvo === 'object') {
      vivo.current.irPara = null
      return aoEscolherMarca(alvo.marca)
    }
    vivo.current.irPara = alvo === 'voce' ? xVoce + VOCE_W / 2 : xFin + FIN_W / 2
  }
  // arrastar um nome da barra para o lado troca a sala de lugar
  const [arrastandoSala, setArrastandoSala] = useState<{ id: string; ids: string[]; x: number; moveu: boolean } | null>(null)
  const arrasteRef = useRef(arrastandoSala)
  arrasteRef.current = arrastandoSala
  useEffect(() => {
    if (!arrastandoSala) return
    const mover = (e: PointerEvent) => {
      const a = arrasteRef.current!
      if (!a.moveu && Math.abs(e.clientX - a.x) < 6) return
      const alvo = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-sala]')?.dataset.sala
      const ids = [...a.ids]
      if (alvo && alvo !== a.id) {
        ids.splice(ids.indexOf(a.id), 1)
        ids.splice(a.ids.indexOf(alvo), 0, a.id)
      }
      setArrastandoSala({ ...a, ids, moveu: true })
    }
    const soltar = () => {
      const a = arrasteRef.current!
      setArrastandoSala(null)
      if (a.moveu && a.ids.join() !== marcas.map((m) => m.id).join()) aoReordenar?.(a.ids)
      if (!a.moveu) irPara({ marca: a.id })
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar, { once: true })
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
  }, [!!arrastandoSala]) // eslint-disable-line react-hooks/exhaustive-deps
  const naBarra = arrastandoSala ? arrastandoSala.ids.map((id) => marcas.find((m) => m.id === id)!).filter(Boolean) : marcas
  const situacao = (m: MarcaNoAndar, i: number) => {
    const lista = Object.values(i === indiceAtivo ? estados : porSala?.[m.id] ?? {})
    return lista.includes('erro') ? 'erro' : lista.some((e) => e === 'trabalhando' || e === 'na_fila') ? 'trabalhando' : lista.includes('esperando_voce') ? 'voce' : null
  }
  const nomes: (AgenteId | 'voce')[] = [...AGENTES.map((a) => a.id), 'voce']

  return (
    <div className="pixel" ref={caixa}>
      <nav className="pixel-salas" aria-label="Ir para a sala">
        {naBarra.map((m) => {
          const i = marcas.indexOf(m)
          const sit = situacao(m, i)
          return (
            <button
              key={m.id}
              data-sala={m.id}
              className={`${i === indiceAtivo && !foco ? 'ativo' : ''}${arrastandoSala?.moveu && arrastandoSala.id === m.id ? ' arrastando' : ''}`}
              style={{ ['--cor' as string]: corDe(m) }}
              title={aoReordenar ? 'Clique para ir até a sala. Arraste para mudar a ordem.' : undefined}
              onPointerDown={(e) => {
                if (e.button !== 0) return
                if (!aoReordenar) return
                e.preventDefault()
                setArrastandoSala({ id: m.id, ids: marcas.map((x) => x.id), x: e.clientX, moveu: false })
              }}
              onClick={(e) => (!aoReordenar || e.detail === 0) && irPara({ marca: m.id })}
              onKeyDown={(e) => {
                if (!aoReordenar || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
                const ids = marcas.map((x) => x.id)
                const de = ids.indexOf(m.id)
                const para = Math.max(0, Math.min(ids.length - 1, de + (e.key === 'ArrowLeft' ? -1 : 1)))
                if (de === para) return
                ids.splice(de, 1)
                ids.splice(para, 0, m.id)
                aoReordenar(ids)
              }}
            >
              <i aria-hidden />
              {m.nome}
              {sit && <span className={`pixel-salas-sit ${sit}`} title={sit === 'erro' ? 'Parou com erro' : sit === 'trabalhando' ? 'Trabalhando agora' : 'Esperando você'} />}
            </button>
          )
        })}
        <button style={{ ['--cor' as string]: '#f2b233' }} onClick={() => irPara('voce')}>
          <i aria-hidden />
          Sua sala
          {naSuaMesa > 0 && <span className="pixel-salas-conta">{naSuaMesa}</span>}
        </button>
        <button style={{ ['--cor' as string]: '#3f8f5b' }} onClick={() => irPara('financeiro')}>
          <i aria-hidden />
          Financeiro
        </button>
      </nav>
      <canvas
        ref={tela}
        className="pixel-tela"
        onPointerDown={(e) => {
          arrastando.current = { x: e.clientX, inicio: camera.current.arrasto, moveu: false }
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const a = arrastando.current
          if (!a) {
            if (e.pointerType !== 'mouse') return
            const p = paraMundo(e)
            const s = Math.floor(p.x / PASSO_SALA)
            const lx = p.x - s * PASSO_SALA
            const em = (r: { x: number; y: number; w: number; h: number }) => lx >= r.x - 3 && lx <= r.x + r.w + 3 && p.y >= r.y - 3 && p.y <= r.y + r.h + 4
            const alvo = !marcas[s] || p.x >= xVoce ? null : em(COFRINHO) ? `cofre:${s}` : em(DECORAR) ? `decorar:${s}` : em(GAVETA) ? `gaveta:${s}` : null
            if (alvo !== sobre) setSobre(alvo)
            ;(e.target as HTMLElement).style.cursor = alvo ? 'pointer' : ''
            return
          }
          const dx = e.clientX - a.x
          if (Math.abs(dx) > 4) a.moveu = true
          if (a.moveu) {
            const dpr = window.devicePixelRatio || 1
            camera.current.arrasto = a.inicio - (dx * dpr) / geom.current.escala
            camera.current.soltouEm = performance.now()
          }
        }}
        onPointerUp={(e) => {
          const a = arrastando.current
          arrastando.current = null
          if (a && !a.moveu) {
            const p = paraMundo(e)
            clicar(p.x, p.y)
          }
        }}
      />
      {nomes.map((id) => {
        const est = id === 'voce' ? null : estados[id]
        const acao = id !== 'voce' && (est === 'trabalhando' || est === 'esperando_voce' || est === 'na_fila') ? acoes[id] : null
        const nome = id === 'voce' ? 'Você' : id === 'chefe' ? <>Chefe<span className="so-largo"> de pauta</span></> : agentePorId(id).nome
        return (
          <Fragment key={id}>
            <div
              className="pixel-etiqueta"
              ref={(el) => {
                if (el) etiquetas.current.set(id, el)
                else etiquetas.current.delete(id)
              }}
            >
              {id === 'voce' && aguardando && pastaChegouEmVoce && <div className="pixel-balao alerta">{naSuaMesa > 1 ? `${naSuaMesa} posts esperando você!` : 'Post esperando você!'}</div>}
              {acao && <div key={acao} className="pixel-balao">{acao}</div>}
            </div>
            <div
              className="pixel-etiqueta"
              ref={(el) => {
                if (el) etiquetas.current.set(`nome:${id}`, el)
                else etiquetas.current.delete(`nome:${id}`)
              }}
            >
              <div className={`pixel-nome${selecionado === id ? ' ativo' : ''}`}>{nome}</div>
            </div>
          </Fragment>
        )
      })}
      {GATOS.map(({ nome }) => (
        <div
          key={nome}
          className="pixel-etiqueta"
          ref={(el) => {
            if (el) etiquetas.current.set(`gato:${nome}`, el)
            else etiquetas.current.delete(`gato:${nome}`)
          }}
        >
          {miau[nome] && <div className="pixel-balao gato">{miau[nome]}</div>}
        </div>
      ))}
      <div
        className="pixel-etiqueta"
        ref={(el) => {
          if (el) etiquetas.current.set('financeiro', el)
          else etiquetas.current.delete('financeiro')
        }}
      >
        {!!financeiro?.dicas && <div className={`pixel-balao${financeiro.alerta ? ' alerta' : ''}`}>{financeiro.dicas === 1 ? '1 dica para você' : `${financeiro.dicas} dicas para você`}</div>}
      </div>
      <div
        className="pixel-etiqueta"
        ref={(el) => {
          if (el) etiquetas.current.set('nome:financeiro', el)
          else etiquetas.current.delete('nome:financeiro')
        }}
      >
        <div className={`pixel-nome${foco === 'financeiro' ? ' ativo' : ''}`}>Financeiro</div>
      </div>
      <canvas ref={frente} className="pixel-tela pixel-frente" aria-hidden />
      {marcas.map((m, s) => (
        <Fragment key={m.id}>
          {DEPTOS.map((d, n) => (
            <div
              key={d.id}
              className="pixel-depto"
              ref={(el) => {
                if (el) etiquetas.current.set(`depto:${s}:${n}`, el)
                else etiquetas.current.delete(`depto:${s}:${n}`)
              }}
            >
              {d.nome}
            </div>
          ))}
          <div
            className="pixel-etiqueta pixel-objeto"
            ref={(el) => {
              if (el) etiquetas.current.set(`cofre:${s}`, el)
              else etiquetas.current.delete(`cofre:${s}`)
            }}
          >
            {cofres?.[m.id] && (sobre === `cofre:${s}` || (foco === 'cofre' && s === indiceAtivo)) && (
              <div className={`pixel-nome cofre${foco === 'cofre' && s === indiceAtivo ? ' ativo' : ''}`}>{cofres[m.id]}</div>
            )}
          </div>
          {(quadros?.[m.id]?.gaveta ?? 0) >= 0 && (
            <div
              className="pixel-etiqueta pixel-objeto"
              ref={(el) => {
                if (el) etiquetas.current.set(`gaveta:${s}`, el)
                else etiquetas.current.delete(`gaveta:${s}`)
              }}
            >
              {(sobre === `gaveta:${s}` || (foco === 'gaveta' && s === indiceAtivo)) && (
                <div className={`pixel-nome cofre${foco === 'gaveta' && s === indiceAtivo ? ' ativo' : ''}`}>Gaveta · {quadros?.[m.id]?.gaveta}</div>
              )}
            </div>
          )}
          {aoEditarSala && (
            <div
              className="pixel-etiqueta pixel-objeto"
              ref={(el) => {
                if (el) etiquetas.current.set(`decorar:${s}`, el)
                else etiquetas.current.delete(`decorar:${s}`)
              }}
            >
              {(sobre === `decorar:${s}` || (foco === 'sala' && s === indiceAtivo)) && (
                <div className={`pixel-nome cofre${foco === 'sala' && s === indiceAtivo ? ' ativo' : ''}`}>Editar sala</div>
              )}
            </div>
          )}
        </Fragment>
      ))}
      {marcas.map((m, i) => (
        <div
          key={m.id}
          className="pixel-placa"
          style={{ background: corDe(m) }}
          ref={(el) => {
            if (el) etiquetas.current.set(`placa:${i}`, el)
            else etiquetas.current.delete(`placa:${i}`)
          }}
        >
          {m.nome}
        </div>
      ))}
    </div>
  )
}

const MESA_W2 = 15

function pasta(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = '#1f2330'
  g.fillRect(x - 1, y - 1, 10, 8)
  g.fillStyle = '#f2b233'
  g.fillRect(x, y, 8, 6)
  g.fillStyle = '#ffd36b'
  g.fillRect(x, y, 4, 2)
}

interface Gato {
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
const GATOS = [
  { nome: 'Maki', mancha: '#8a7a6c' },
  { nome: 'Gojo', mancha: '#3b3f4a' },
]

/** Gatinho visto de lado; passo -1 é parado (sentado ou deitado, se estiver dormindo). Pés em (x, y). */
function gato(g: CanvasRenderingContext2D, x: number, y: number, gt: Gato, passo: number, t: number) {
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
function carta(g: CanvasRenderingContext2D, x: number, y: number) {
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

function exclamacao(g: CanvasRenderingContext2D, x: number, y: number, cor: string) {
  g.fillStyle = '#1f2330'
  g.fillRect(x - 1, y - 1, 6, 12)
  g.fillStyle = cor
  g.fillRect(x, y, 4, 6)
  g.fillRect(x, y + 7, 4, 3)
}

function seta(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = '#f2b233'
  g.fillRect(x, y, 6, 2)
  g.fillRect(x + 1, y + 2, 4, 2)
  g.fillRect(x + 2, y + 4, 2, 2)
}

function faiscas(g: CanvasRenderingContext2D, x: number, y: number, desde: number) {
  const r = desde * 22
  g.fillStyle = desde < 0.4 ? '#ffffff' : '#f2b233'
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    g.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.7), 2, 2)
  }
}

function reticencias(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  g.fillStyle = '#1f2330'
  g.fillRect(x - 1, y - 1, 13, 6)
  g.fillStyle = '#ffffff'
  g.fillRect(x, y, 11, 4)
  g.fillStyle = '#1f2330'
  const n = Math.floor(t * 3) % 4
  for (let i = 0; i < n; i++) g.fillRect(x + 2 + i * 3, y + 1, 2, 2)
}
