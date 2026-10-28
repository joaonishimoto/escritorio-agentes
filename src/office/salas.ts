import type { AgenteId } from '../agents/catalogo'
import type { Movel } from './Moveis'

// Opções de sala: posição de cada mesa, cores do ambiente e alguns detalhes de decoração.
// A sala em uso vem de ?sala= na URL (a a f); sem parâmetro, usa a padrão.

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
  piso: 'tapete' | 'trilha' | 'redondo' | 'nenhum'
  luminarias: [number, number][]
  /** onde o calendário fica pendurado: x, z e para onde olha */
  calendario: [number, number, number]
  /** salas mais completas: piso desenhado, rodapé, janelas com caixilho e móveis */
  textura?: { tipo: 'madeira' | 'ladrilho' | 'concreto'; linha: string }
  rodape?: string
  janelas?: { x: number; z: number; rot: number; largura: number }[]
  moveis?: Movel[]
  semPlantas?: boolean
}

const FUNDO = 0
const LADO = Math.PI / 2
const PAREDE_FUNDO = -4.88
const PAREDE_LADO = -7.88
const ladoParaX = -Math.PI / 2

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


// ───────── salas "profissionais" ─────────

SALAS.d = {
  nome: 'Agência moderna',
  mesas: {
    chefe: [-4.6, -0.5, 0],
    pesquisador: [-2.6, -0.5, 0],
    redator: [-0.6, -0.5, 0],
    designer: [-4.6, -3.1, Math.PI],
    revisor: [-2.6, -3.1, Math.PI],
    publicador: [-0.6, -3.1, Math.PI],
    curador: [-5.6, 3, Math.PI / 2],
  },
  voce: [5.2, -2.6],
  cores: {
    fundo: '#faf9f5', chao: '#e9dcc6', paredeFundo: '#f7f5f0', paredeLado: '#fdfcfa', tapete: '#dce6f5',
    mesa: '#ffffff', perna: '#1f2330', cadeira: '#2a5288', planta: '#3f7650', vaso: '#ffffff', janela: '#c0d3ec',
    ceu: '#ffffff', solo: '#e6dfcf',
  },
  luz: 1.5,
  piso: 'nenhum' as Sala['piso'],
  luminarias: [],
  calendario: [1.4, PAREDE_FUNDO, FUNDO],
  textura: { tipo: 'madeira', linha: '#c9b38f' },
  rodape: '#1f2330',
  janelas: [{ x: 5.2, z: PAREDE_FUNDO, rot: FUNDO, largura: 3 }, { x: PAREDE_LADO, z: -2, rot: LADO, largura: 2.6 }],
  semPlantas: true,
  moveis: [
    { tipo: 'vidro', x: 3, z: -2.8, rot: Math.PI / 2, largura: 4.2 },
    { tipo: 'vidro', x: 5.5, z: -0.7, largura: 5 },
    { tipo: 'tapete', x: 5.4, z: -2.7, largura: 4.4, fundo: 3.6, cor: '#dce6f5' },
    { tipo: 'estante', x: -6.4, z: -4.6 },
    { tipo: 'quadro', x: -2.6, z: PAREDE_FUNDO },
    { tipo: 'letreiro', x: -2.6, z: PAREDE_FUNDO, texto: 'Estúdio de conteúdo', cor: '#1e3d66' },
    { tipo: 'cafe', x: -7.5, z: 1.6, rot: ladoParaX * -1 },
    { tipo: 'tapete', x: 3.6, z: 2.9, largura: 4.6, fundo: 2.8, cor: '#2a5288' },
    { tipo: 'sofa', x: 3.6, z: 2.4, cor: '#e6e8ee' },
    { tipo: 'reuniao', x: -1.6, z: 2.6, cor: '#ffffff' },
    { tipo: 'plantaAlta', x: 7.3, z: -0.2 },
    { tipo: 'plantaAlta', x: -7.3, z: 4.3 },
    { tipo: 'plantaAlta', x: 1.7, z: -4.3 },
    { tipo: 'arte', x: PAREDE_LADO, z: 3.4, rot: LADO, cores: ['#f6f4ee', '#b74e45', '#2a5288'] },
  ],
}

SALAS.e = {
  nome: 'Executivo noturno',
  mesas: {
    chefe: [-5.6, -3.4, 0],
    pesquisador: [-3.4, -3.4, 0],
    redator: [-1.2, -3.4, 0],
    designer: [1, -3.4, 0],
    revisor: [-6.6, -0.6, Math.PI / 2],
    publicador: [-6.6, 1.7, Math.PI / 2],
    curador: [3.2, -3.4, 0],
  },
  voce: [3.6, 1.6],
  cores: {
    fundo: '#141a17', chao: '#5a3f2b', paredeFundo: '#23372f', paredeLado: '#294236', tapete: '#2f4a3e',
    mesa: '#7a5236', perna: '#c9a45c', cadeira: '#151b19', planta: '#4f8a5f', vaso: '#c9a45c', janela: '#f2c27a',
    ceu: '#cdbf9e', solo: '#1c2420',
  },
  luz: 0.75,
  piso: 'nenhum' as Sala['piso'],
  luminarias: [[-1.4, 1.8], [3.6, 1.6], [-3.4, -2.4], [1, -2.4]],
  calendario: [PAREDE_LADO, 3.8, LADO],
  textura: { tipo: 'madeira', linha: '#3d2a1c' },
  rodape: '#c9a45c',
  janelas: [{ x: 6, z: PAREDE_FUNDO, rot: FUNDO, largura: 2.6 }],
  semPlantas: true,
  moveis: [
    { tipo: 'tapete', x: -1.4, z: 1.8, largura: 4.2, fundo: 3, cor: '#2f4a3e' },
    { tipo: 'reuniao', x: -1.4, z: 1.8, cor: '#7a5236' },
    { tipo: 'tapete', x: 3.6, z: 1.9, largura: 2.6, fundo: 2.2, cor: '#8a2f2a' },
    { tipo: 'estante', x: 5.6, z: -4.6, largura: 1.6 },
    { tipo: 'sofa', x: 6.2, z: 3.4, rot: -Math.PI / 2, cor: '#8a2f2a' },
    { tipo: 'arte', x: PAREDE_LADO, z: -3.4, rot: LADO, cores: ['#d9c9a3', '#8a2f2a', '#23372f'] },
    { tipo: 'letreiro', x: -2.2, z: PAREDE_FUNDO, texto: 'Sala de produção', cor: '#c9a45c' },
    { tipo: 'plantaAlta', x: -7.3, z: -4.3 },
    { tipo: 'plantaAlta', x: 7.3, z: 0.6 },
    { tipo: 'plantaAlta', x: 1.6, z: 4.2 },
  ],
}

SALAS.f = {
  nome: 'Loft criativo',
  mesas: {
    chefe: [-5.4, -2.3, -Math.PI / 2],
    pesquisador: [-3, -2.3, Math.PI / 2],
    redator: [0.4, -2.3, -Math.PI / 2],
    designer: [2.8, -2.3, Math.PI / 2],
    revisor: [0.4, 1.7, -Math.PI / 2],
    publicador: [2.8, 1.7, Math.PI / 2],
    curador: [-5.4, 1.7, -Math.PI / 2],
  },
  voce: [6, -0.2],
  cores: {
    fundo: '#f4f1ec', chao: '#d9d6d0', paredeFundo: '#b8654a', paredeLado: '#ece7df', tapete: '#f2b233',
    mesa: '#fbfaf7', perna: '#f2b233', cadeira: '#2f6f73', planta: '#3f7650', vaso: '#ece7df', janela: '#cfe0e6',
    ceu: '#ffffff', solo: '#dcd6cc',
  },
  luz: 1.45,
  piso: 'nenhum' as Sala['piso'],
  luminarias: [],
  calendario: [PAREDE_LADO, -1.6, LADO],
  textura: { tipo: 'concreto', linha: '#9c978e' },
  rodape: '#3a3a36',
  janelas: [{ x: -3.6, z: PAREDE_FUNDO, rot: FUNDO, largura: 2.4 }, { x: 0.4, z: PAREDE_FUNDO, rot: FUNDO, largura: 2.4 }, { x: 4.4, z: PAREDE_FUNDO, rot: FUNDO, largura: 2.4 }],
  semPlantas: true,
  moveis: [
    { tipo: 'tapete', x: 6, z: -0.2, largura: 3, fundo: 2.6, cor: '#2f6f73' },
    { tipo: 'estante', x: PAREDE_LADO + 0.25, z: 2.4, rot: LADO, largura: 2.6 },
    { tipo: 'cafe', x: 6.6, z: -4.5 },
    { tipo: 'quadro', x: PAREDE_LADO, z: -3.9, rot: LADO },
    { tipo: 'tapete', x: -2.6, z: 4, largura: 3.4, fundo: 1.5, cor: '#f2b233' },
    { tipo: 'puff', x: -3.6, z: 4, cor: '#2f6f73' },
    { tipo: 'puff', x: -2.5, z: 4.2, cor: '#b8654a' },
    { tipo: 'puff', x: -1.5, z: 3.9, cor: '#f2b233' },
    { tipo: 'plantaAlta', x: -7.2, z: 4.4 },
    { tipo: 'plantaAlta', x: 7.4, z: 2.4 },
    { tipo: 'plantaAlta', x: -1.3, z: -4.3 },
    { tipo: 'plantaAlta', x: 2.4, z: -4.3 },
  ],
}

const pedida = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('sala') : null
export const SALA: Sala = SALAS[pedida ?? ''] ?? SALAS.atual
