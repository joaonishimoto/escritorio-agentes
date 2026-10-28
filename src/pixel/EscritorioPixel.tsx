import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { tocarAviso } from '../lib/som'
import { AGENTES, agentePorId, type AgenteId } from '../agents/catalogo'
import { selecionarEsperandoVoce, useEscritorio, type Entrega, type Estado } from '../store/escritorio'
import { quadro, BONECO, type Direcao, type Visual } from './sprites'
import {
  ANDAR_H, CALENDARIO, PLACA, comCorDaMarca, COLUNA_X, CORREDOR_PES, ESTILOS, LINHA_FRENTE, MESAS, MESA_VOCE, ORDEM_ESTILOS, PASSO_SALA,
  PORTA_VOCE_X, PORTA_X, SALA_W, VOCE_W, assento, desenharCalendario, desenharCorredor, desenharMesaVoce,
  desenharParedeEntre, desenharSala, desenharSuaSala, linhaDaMesa,
} from './mapa'

export interface MarcaNoAndar {
  id: string
  nome: string
  /** cor que representa a marca na sala */
  cor?: string
  /** ordem em que a sala foi criada: decide o estilo padrão, mesmo com a sala mudando de lugar no andar */
  ordem?: number
}

// cada agente tem um cabelo e um tom de pele, para dar para reconhecer de longe
const VISUAL: Record<AgenteId | 'voce', Visual> = {
  chefe: { cabelo: '#2b2420', pele: '#e9b98f', camisa: agentePorId('chefe').cor },
  pesquisador: { cabelo: '#7a4a2a', pele: '#f3cfa8', camisa: agentePorId('pesquisador').cor },
  redator: { cabelo: '#e3b85a', pele: '#f3cfa8', camisa: agentePorId('redator').cor },
  designer: { cabelo: '#d9667a', pele: '#c98e66', camisa: agentePorId('designer').cor },
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
  aoMudarCor,
}: {
  marcas: MarcaNoAndar[]
  marcaAtiva: string | null
  aoEscolherMarca: (id: string) => void
  aoMudarCor?: (id: string, cor: string) => void
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const tela = useRef<HTMLCanvasElement>(null)
  /** camada só com quem está andando, por cima dos nomes e balões */
  const frente = useRef<HTMLCanvasElement>(null)
  const etiquetas = useRef<Map<string, HTMLDivElement>>(new Map())
  const [estilos, setEstilos] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('estilos-pixel') ?? '{}')
    } catch {
      return {}
    }
  })

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
  const largura = xVoce + VOCE_W
  const [cores, setCores] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('cores-sala') ?? '{}')
    } catch {
      return {}
    }
  })
  const corDe = (m: MarcaNoAndar) => cores[m.id] ?? m.cor ?? '#2a5288'
  const estiloBase = (id: string, i: number) => ESTILOS[estilos[id] ?? ORDEM_ESTILOS[i % ORDEM_ESTILOS.length]]
  const estiloDe = (m: MarcaNoAndar, i: number) => comCorDaMarca(estiloBase(m.id, m.ordem ?? i), corDe(m))

  // estado que o laço de desenho lê sem precisar renderizar o React de novo
  const vivo = useRef({ estados, aguardando, selecionado, indiceAtivo, foco, mudouEm: {} as Record<string, number>, ultimoEstado: {} as Record<string, Estado> })
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
    marcas.forEach((m, i) => {
      const base = estiloBase(m.id, m.ordem ?? i)
      desenharSala(g, i * PASSO_SALA, estiloDe(m, i), base === ESTILOS.e)
      desenharParedeEntre(g, i * PASSO_SALA + SALA_W)
    })
    desenharSuaSala(g, xVoce)
    return c
  }, [marcas, estilos, cores, largura, xVoce]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const andantes = useRef<Andante[]>([])
  const pastasNaMesa = useRef<Map<string, number>>(new Map())
  /** quando cada um recebeu a última pasta: só levanta para entregar depois de um tempo trabalhando nela */
  const recebeuEm = useRef<Map<string, number>>(new Map())
  const [pastaChegouEmVoce, setPastaChegouEmVoce] = useState(true)
  const pastaEmVoceRef = useRef(true)
  const camera = useRef({ x: 0, arrasto: 0, soltouEm: 0 })
  const geom = useRef({ escala: 3, offY: 0, larguraVista: 0 })

  // ── caminhos ──
  const pes = (sala: number, quem: AgenteId | 'voce'): Ponto => {
    if (quem === 'voce') return [xVoce + MESA_VOCE.x + MESA_VOCE.w / 2, MESA_VOCE.y - 2]
    const a = assento(MESAS[quem])
    return [sala * PASSO_SALA + a.x, a.y]
  }
  const ateOHub = (sala: number, quem: AgenteId): Ponto[] => {
    const x0 = sala * PASSO_SALA
    const [sx, sy] = pes(sala, quem)
    const ly = linhaDaMesa(MESAS[quem])
    return ly === LINHA_FRENTE ? [[sx, sy], [sx, ly]] : [[sx, sy], [sx, ly], [x0 + COLUNA_X, ly], [x0 + COLUNA_X, LINHA_FRENTE]]
  }
  const daSuaMesaAtePorta = (): Ponto[] => {
    const [x, y] = pes(-1, 'voce')
    return [[x, y], [xVoce + 50, y], [xVoce + 50, 124], [xVoce + PORTA_VOCE_X, 124], [xVoce + PORTA_VOCE_X, CORREDOR_PES]]
  }
  // em pé ao lado da cadeira de quem recebe
  const aoLado = (sala: number, quem: AgenteId): Ponto => {
    const [sx, sy] = pes(sala, quem)
    return [sx + 13, sy]
  }
  const caminho = (de: { sala: number; quem: AgenteId | 'voce' }, para: { sala: number; quem: AgenteId | 'voce' }): Ponto[] => {
    // mesma sala: desce para o corredorzinho da própria fileira, anda até a outra mesa e para ao lado da cadeira
    if (de.quem !== 'voce' && para.quem !== 'voce' && de.sala === para.sala) {
      const x0 = de.sala * PASSO_SALA
      const [sx, sy] = pes(de.sala, de.quem)
      const [ax, ay] = aoLado(para.sala, para.quem)
      const l1 = linhaDaMesa(MESAS[de.quem])
      const l2 = linhaDaMesa(MESAS[para.quem])
      const meio: Ponto[] = l1 === l2 ? [] : [[x0 + COLUNA_X, l1], [x0 + COLUNA_X, l2]]
      return [[sx, sy], [sx, l1], ...meio, [ax, l2], [ax, ay]]
    }
    const saida: Ponto[] =
      de.quem === 'voce'
        ? daSuaMesaAtePorta()
        : [...ateOHub(de.sala, de.quem), [de.sala * PASSO_SALA + PORTA_X, LINHA_FRENTE], [de.sala * PASSO_SALA + PORTA_X, CORREDOR_PES]]
    const chegada: Ponto[] =
      para.quem === 'voce'
        ? [...daSuaMesaAtePorta()].reverse().slice(0, -1).concat([[pes(-1, 'voce')[0], MESA_VOCE.y + 24]])
        : [
            [para.sala * PASSO_SALA + PORTA_X, CORREDOR_PES],
            [para.sala * PASSO_SALA + PORTA_X, LINHA_FRENTE],
            ...(linhaDaMesa(MESAS[para.quem]) === LINHA_FRENTE ? [] : ([[para.sala * PASSO_SALA + COLUNA_X, LINHA_FRENTE], [para.sala * PASSO_SALA + COLUNA_X, linhaDaMesa(MESAS[para.quem])]] as Ponto[])),
            [aoLado(para.sala, para.quem)[0], linhaDaMesa(MESAS[para.quem])],
            aoLado(para.sala, para.quem),
          ]
    return [...saida, ...chegada]
  }

  const pendentes = useRef<Entrega[]>([])
  /** Quem está esperando uma pasta que ainda está a caminho: na tela continua "na fila", mesmo que o servidor já tenha andado. */
  const aCaminhoDe = () => new Set(andantes.current.filter((a) => a.pasta && a.fase === 'ida' && a.alvo).map((a) => a.alvo!.quem))

  const andando = (quem: AgenteId | 'voce', sala: number) => andantes.current.some((a) => a.quem === quem && a.sala === sala)

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
    [marcas.length], // eslint-disable-line react-hooks/exhaustive-deps
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
      const porAltura = Math.max(2, Math.min(5, Math.floor(ch / (ANDAR_H + 16))))
      const porLargura = cw / (SALA_W + 12)
      const escala = porLargura < porAltura ? Math.max(dpr, Math.floor(porLargura * dpr)) : porAltura * dpr
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
          const x0 = sala * PASSO_SALA
          const ly = linhaDaMesa(MESAS[a.id])
          const [sx, sy] = pes(sala, a.id)
          const ida: Ponto[] = [[sx, sy], [sx, ly], [x0 + COLUNA_X, ly], [x0 + COLUNA_X, 96], [x0 + 196, 96]]
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
        const emPe = andantes.current.find((a) => a.quem === e.de && a.sala === de.sala)
        if (emPe) {
          // no café: interrompe e volta para a mesa pelo mesmo caminho
          if (!emPe.pasta && emPe.fase !== 'volta') {
            emPe.dist = emPe.fase === 'ida' ? comprimento(emPe.ida) - emPe.dist : 0
            emPe.fase = 'volta'
          }
          return true
        }
        const para = { sala: e.para === 'voce' ? -1 : sala, quem: e.para }
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
      const estadoNaTela = (i: number, id: AgenteId): Estado => (i !== v.indiceAtivo ? 'ocioso' : esperandoPasta(i, id) ? 'na_fila' : v.estados[id])

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
        a.dist += Math.max(VELOCIDADE, comprimento(rota) / 6) * dt
        if (a.dist >= comprimento(rota)) {
          if (a.fase === 'ida') {
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

      // câmera: segue quem atravessa o corredor; senão a sala da marca ou a sua
      const viajante = andantes.current.find((a) => a.pasta && (a.sala === -1 || a.alvo?.sala === -1))
      let alvoX = v.foco ? xVoce + VOCE_W / 2 : v.indiceAtivo * PASSO_SALA + SALA_W / 2
      if (viajante) {
        const rota = viajante.fase === 'volta' ? viajante.volta : viajante.ida
        alvoX = noCaminho(rota, Math.max(0, viajante.dist)).x
      }
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
      desenharCalendario(g, xVoce, diasRef.current, new Date().getDate())

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
          if (i === v.indiceAtivo) {
            if (est === 'concluido' && desde < 0.8) faiscas(g, x + 7, y + 4, desde)
            if (est === 'na_fila') reticencias(g, x + 2, y - 8, t)
            if (est === 'esperando_voce' || est === 'erro') exclamacao(g, x + 5, y - 12 + Math.round(Math.sin(t * 6)), est === 'erro' ? '#e05a4f' : '#f2b233')
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

      // etiquetas em HTML acompanham os bonecos
      for (const [chave, el] of etiquetas.current) {
        if (chave.startsWith('placa:')) {
          const i = Number(chave.slice(6))
          const sx = ((i * PASSO_SALA + PLACA.x - camX) * escala) / dpr
          const sy = ((PLACA.y + offY) * escala) / dpr
          el.style.transform = `translate(${sx}px, ${sy}px)`
          el.style.fontSize = `${(escala / dpr) * 9}px`
          continue
        }
        const nome = chave.startsWith('nome:')
        const id = nome ? chave.slice(5) : chave
        const pos = !nome && id !== 'voce' && esperandoPasta(v.indiceAtivo, id as AgenteId) ? null : (nome ? posicoesNome : posicoesEtiqueta)[id]
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
    if (x >= xVoce) {
      const mx = xVoce + MESA_VOCE.x
      if (x >= xVoce + CALENDARIO.x && x <= xVoce + CALENDARIO.x + CALENDARIO.w && y <= CALENDARIO.y + CALENDARIO.h) return focar('calendario')
      if (x >= mx - 6 && x <= mx + MESA_VOCE.w + 6 && y >= MESA_VOCE.y - 24 && y <= MESA_VOCE.y + 20) return focar('voce')
      return focar(null) // clicou fora: fecha o painel aberto
    }
    const sala = Math.floor(x / PASSO_SALA)
    if (sala !== indiceAtivo && marcas[sala]) {
      focar(null)
      return aoEscolherMarca(marcas[sala].id)
    }
    const lx = x - sala * PASSO_SALA
    for (const a of AGENTES) {
      const m = MESAS[a.id]
      if (lx >= m.x && lx <= m.x + MESA_W2 * 2 && y >= m.y - 10 && y <= m.y + 28) return selecionar(a.id)
    }
    selecionar(null)
  }

  const trocarEstilo = (id: string, i: number) => {
    const ordem = marcas.find((m) => m.id === id)?.ordem ?? i
    const atual = estilos[id] ?? ORDEM_ESTILOS[ordem % ORDEM_ESTILOS.length]
    const novo = { ...estilos, [id]: ORDEM_ESTILOS[(ORDEM_ESTILOS.indexOf(atual) + 1) % ORDEM_ESTILOS.length] }
    setEstilos(novo)
    try {
      localStorage.setItem('estilos-pixel', JSON.stringify(novo))
    } catch {
      // sem armazenamento local: vale até recarregar
    }
  }

  const ativa = marcas[indiceAtivo]
  const nomes: (AgenteId | 'voce')[] = [...AGENTES.map((a) => a.id), 'voce']

  return (
    <div className="pixel" ref={caixa}>
      <canvas
        ref={tela}
        className="pixel-tela"
        onPointerDown={(e) => {
          arrastando.current = { x: e.clientX, inicio: camera.current.arrasto, moveu: false }
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const a = arrastando.current
          if (!a) return
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
        const nome = id === 'voce' ? 'Você' : agentePorId(id).nome
        return (
          <Fragment key={id}>
            <div
              className="pixel-etiqueta"
              ref={(el) => {
                if (el) etiquetas.current.set(id, el)
                else etiquetas.current.delete(id)
              }}
            >
              {id === 'voce' && aguardando && pastaChegouEmVoce && <div className="pixel-balao alerta">Post esperando você!</div>}
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
      <canvas ref={frente} className="pixel-tela pixel-frente" aria-hidden />
      {ativa && (
        <button className="pixel-estilo" onClick={() => trocarEstilo(ativa.id, indiceAtivo)} title="Trocar o estilo desta sala">
          🎨 {estiloBase(ativa.id, ativa.ordem ?? indiceAtivo).nome}
        </button>
      )}
      {ativa && (
        <label className="pixel-estilo pixel-cor" title="Cor da marca nesta sala">
          <span className="amostra" style={{ background: corDe(ativa) }} />
          Cor da sala
          <input
            type="color"
            value={corDe(ativa)}
            onChange={(e) => {
              const novo = { ...cores, [ativa.id]: e.target.value }
              setCores(novo)
              try {
                localStorage.setItem('cores-sala', JSON.stringify(novo))
              } catch {
                // sem armazenamento local: fica salvo só no banco
              }
            }}
            onBlur={(e) => aoMudarCor?.(ativa.id, e.target.value)}
          />
        </label>
      )}
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
