import type { AgenteId } from '../agents/catalogo'

// Opções de sala: posição de cada mesa, cores do ambiente e alguns detalhes de decoração.
// A sala em uso vem de ?sala= na URL (a, b ou c); sem parâmetro, usa a padrão.

type Mesa = [x: number, z: number, rotacao: number]

export interface Sala {
  nome: string
  mesas: Record<AgenteId, Mesa>
  voce: [number, number]
  cores: {
    fundo: string
    chao: string
    paredeFundo: string
    paredeLado: string
    tapete: string
    mesa: string
    perna: string
    cadeira: string
    planta: string
    vaso: string
    janela: string
    ceu: string
    solo: string
  }
  luz: number
  /** tapete reto no meio, trilha ligando as mesas na ordem do fluxo, ou tapete redondo */
  piso: 'tapete' | 'trilha' | 'redondo'
  luminarias: [number, number][]
  /** onde o calendário fica pendurado: x, z e para onde olha */
  calendario: [number, number, number]
}

const olharPara = (x: number, z: number, cx = 0, cz = 0) => Math.atan2(x - cx, z - cz)
const roda = (i: number, n: number, r: number): Mesa => {
  const a = Math.PI + (i / n) * Math.PI * 2 + Math.PI / n
  const x = Math.sin(a) * r
  const z = Math.cos(a) * r * 0.82
  return [x, z, olharPara(x, z)]
}

export const SALAS: Record<string, Sala> = {
  atual: {
    nome: 'Atual',
    mesas: {
      chefe: [-4.5, -2.6, 0],
      pesquisador: [0, -2.6, 0],
      redator: [4.5, -2.6, 0],
      designer: [4.5, 2.6, Math.PI],
      revisor: [0, 2.6, Math.PI],
      publicador: [-4.5, 2.6, Math.PI],
      curador: [-1.6, 0, Math.PI / 2],
    },
    voce: [1.6, 0],
    cores: {
      fundo: '#faf9f5', chao: '#f3f1e8', paredeFundo: '#f6f4ee', paredeLado: '#fdfcfa', tapete: '#dce6f5',
      mesa: '#e3d6bf', perna: '#bfb9a5', cadeira: '#45473f', planta: '#3f7650', vaso: '#d9d4c4', janela: '#c0d3ec',
      ceu: '#ffffff', solo: '#eeebe2',
    },
    luz: 1.6,
    piso: 'tapete',
    luminarias: [],
    calendario: [-3, -4.86, 0],
  },
  a: {
    nome: 'Linha de produção',
    mesas: {
      chefe: [-6, -2.4, 0],
      pesquisador: [-3, -2.4, 0],
      redator: [0, -2.4, 0],
      designer: [3, -2.4, 0],
      revisor: [6, -2.4, 0],
      publicador: [3, 2.8, Math.PI],
      curador: [-3, 2.8, Math.PI],
    },
    voce: [6, 1.6],
    cores: {
      fundo: '#faf9f5', chao: '#ece4d4', paredeFundo: '#f6f4ee', paredeLado: '#fdfcfa', tapete: '#2a5288',
      mesa: '#f4efe4', perna: '#2a5288', cadeira: '#1e3d66', planta: '#3f7650', vaso: '#ffffff', janela: '#c0d3ec',
      ceu: '#ffffff', solo: '#e6dfcf',
    },
    luz: 1.6,
    piso: 'trilha',
    luminarias: [],
    calendario: [-3, -4.86, 0],
  },
  b: {
    nome: 'Ilhas à noite',
    mesas: {
      chefe: [-5, -0.9, 0],
      pesquisador: [-5, -3.1, Math.PI],
      redator: [0, -0.9, 0],
      designer: [2, -0.9, 0],
      revisor: [1, -3.1, Math.PI],
      publicador: [5.6, -3.1, Math.PI],
      curador: [-5, 3, Math.PI],
    },
    voce: [3.4, 2.6],
    cores: {
      fundo: '#1b2433', chao: '#2b3444', paredeFundo: '#33415a', paredeLado: '#3a4a66', tapete: '#3d4c66',
      mesa: '#c9a77a', perna: '#1b2433', cadeira: '#151b26', planta: '#4f8a5f', vaso: '#c9a77a', janela: '#f2c27a',
      ceu: '#9fb3d6', solo: '#20283a',
    },
    luz: 0.7,
    piso: 'tapete',
    luminarias: [[-5, -2], [1, -2], [5.6, -3], [3.4, 2.6], [-5, 3]],
    calendario: [-2.4, -4.86, 0],
  },
  c: {
    nome: 'Roda em volta de você',
    mesas: {
      chefe: roda(0, 7, 4.6),
      pesquisador: roda(1, 7, 4.6),
      redator: roda(2, 7, 4.6),
      designer: roda(3, 7, 4.6),
      revisor: roda(4, 7, 4.6),
      publicador: roda(5, 7, 4.6),
      curador: roda(6, 7, 4.6),
    },
    voce: [0, 0],
    cores: {
      fundo: '#f7f1e8', chao: '#efe3d0', paredeFundo: '#f3ebdf', paredeLado: '#f8f2ea', tapete: '#e6c9a8',
      mesa: '#fbf7f0', perna: '#b97a52', cadeira: '#b97a52', planta: '#4d7a44', vaso: '#d98f62', janela: '#cfe0d4',
      ceu: '#fff8ee', solo: '#ecdcc4',
    },
    luz: 1.5,
    piso: 'redondo',
    luminarias: [],
    calendario: [-7.86, -1.2, Math.PI / 2],
  },
}

const pedida = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('sala') : null
export const SALA: Sala = SALAS[pedida ?? ''] ?? SALAS.atual
