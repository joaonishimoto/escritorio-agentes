// Bonecos em pixel art desenhados a partir de mapas de texto. Cada letra é uma cor; o contorno é gerado sozinho.
// H cabelo, S pele, E olho, C camisa, D sombra da camisa, P calça, O sapato.

const CABECA_FRENTE = [
  '....HHHH....',
  '...HHHHHH...',
  '..HHHHHHHH..',
  '..HSSSSSSH..',
  '..SSESSESS..',
  '..SSSSSSSS..',
  '...SSSSSS...',
]
const CABECA_COSTAS = [
  '....HHHH....',
  '...HHHHHH...',
  '..HHHHHHHH..',
  '..HHHHHHHH..',
  '..HHHHHHHH..',
  '..SHHHHHHS..',
  '...SSSSSS...',
]
const CABECA_LADO = [
  '...HHHH.....',
  '..HHHHHH....',
  '.HHHHHHHH...',
  '.SSSSHHHH...',
  '.ESSSSSHH...',
  '.SSSSSSSH...',
  '..SSSSSS....',
]
const CORPO = [
  '...CCCCCC...',
  '..CCCCCCCC..',
  '.SCCCCCCCCS.',
  '.SDCCCCCCDS.',
  '..DDCCCCDD..',
  '..PPPPPPPP..',
]
const CORPO_LADO = [
  '...CCCCC....',
  '...CCCCCC...',
  '...CSCCCC...',
  '...CSCCCD...',
  '...DDDDD....',
  '...PPPPP....',
]
const PERNAS = {
  parado: ['..PPP..PPP..', '..PPP..PPP..', '..PP....PP..', '..OO....OO..'],
  passo1: ['..PPP..PPP..', '..PPP...PP..', '..OO....PP..', '........OO..'],
  passo2: ['..PPP..PPP..', '..PP...PPP..', '..PP....OO..', '..OO........'],
  ladoParado: ['...PP.PP....', '...PP.PP....', '...PP.PP....', '...OO.OO....'],
  lado1: ['...PP..PP...', '..PP....PP..', '.PP......P..', '.OO......O..'],
  lado2: ['....PPP.....', '....PPP.....', '....PP......', '....OO......'],
}

export type Direcao = 'baixo' | 'cima' | 'esquerda' | 'direita'
export interface Visual {
  cabelo: string
  pele: string
  camisa: string
  calca?: string
}

const CONTORNO = '#1f2330'

function escurecer(hex: string, f = 0.72) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * f)
  const g = Math.round(((n >> 8) & 255) * f)
  const b = Math.round((n & 255) * f)
  return `rgb(${r},${g},${b})`
}

/** Desenha o mapa num canvas novo, com 1 pixel de contorno em volta. */
function rasterizar(linhas: string[], cores: Record<string, string>, espelhar = false) {
  const w = linhas[0].length + 2
  const h = linhas.length + 2
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const cheio = (x: number, y: number) => {
    const linha = linhas[y]
    if (!linha) return false
    const ch = linha[espelhar ? linha.length - 1 - x : x]
    return !!ch && ch !== '.'
  }
  for (let y = -1; y <= linhas.length; y++)
    for (let x = -1; x <= linhas[0].length; x++) {
      if (cheio(x, y)) continue
      if (cheio(x - 1, y) || cheio(x + 1, y) || cheio(x, y - 1) || cheio(x, y + 1)) {
        g.fillStyle = CONTORNO
        g.fillRect(x + 1, y + 1, 1, 1)
      }
    }
  linhas.forEach((linha, y) => {
    for (let x = 0; x < linha.length; x++) {
      const ch = linha[espelhar ? linha.length - 1 - x : x]
      if (ch === '.' || !cores[ch]) continue
      g.fillStyle = cores[ch]
      g.fillRect(x + 1, y + 1, 1, 1)
    }
  })
  return c
}

const cache = new Map<string, HTMLCanvasElement>()

/** Quadro do boneco: direção e passo (0 parado, 1 e 2 andando). `sentado` corta as pernas. */
export function quadro(v: Visual, dir: Direcao, passo: 0 | 1 | 2, sentado = false) {
  const chave = `${v.cabelo}${v.pele}${v.camisa}${dir}${passo}${sentado}`
  const pronto = cache.get(chave)
  if (pronto) return pronto
  const lado = dir === 'esquerda' || dir === 'direita'
  const cabeca = dir === 'baixo' ? CABECA_FRENTE : dir === 'cima' ? CABECA_COSTAS : CABECA_LADO
  const corpo = lado ? CORPO_LADO : CORPO
  const pernas = lado
    ? [PERNAS.ladoParado, PERNAS.lado1, PERNAS.lado2][passo]
    : [PERNAS.parado, PERNAS.passo1, PERNAS.passo2][passo]
  const linhas = [...cabeca, ...corpo, ...(sentado ? [] : pernas)]
  const cores = {
    H: v.cabelo,
    S: v.pele,
    E: CONTORNO,
    C: v.camisa,
    D: escurecer(v.camisa),
    P: v.calca ?? '#2d3142',
    O: '#1f2330',
  }
  const c = rasterizar(linhas, cores, dir === 'direita')
  cache.set(chave, c)
  return c
}

/** Tamanho do boneco em pé, com contorno. */
export const BONECO = { w: 14, h: 19 }
