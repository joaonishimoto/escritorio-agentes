// Planta do andar em pixel art (1 unidade = 1 pixel antes da escala): medidas, onde fica cada coisa e os caminhos.
import type { AgenteId } from '../agents/catalogo'

export const T = 16
export const SALA_W = 368 // 23 blocos: quatro departamentos e o hall
export const PASSO_SALA = 336 // sala + parede de 1 bloco
export const PAREDE_H = 34 // faixa da parede do fundo
export const SALA_H = 240
export const CORREDOR_Y = 240
export const CORREDOR_H = 26
export const ANDAR_H = CORREDOR_Y + CORREDOR_H
export const VOCE_W = 160
export const PORTA_X = SALA_W / 2 // porta principal da sala da equipe, que dá no corredor
export const CORREDOR_PES = CORREDOR_Y + 14

// ───────── planta da sala: quatro departamentos em cima, na ordem do trabalho, e o hall embaixo ─────────
// Planejamento decide o que fazer, Criação escreve e desenha, Estúdio grava os Reels, e Revisão e publicação
// confere, aprende com as suas correções e publica.

export interface Depto {
  id: 'planejamento' | 'criacao' | 'estudio' | 'publicacao'
  nome: string
  /** nome na placa em tela estreita */
  curto: string
  x: number
  w: number
  /** centro da porta que dá no hall */
  porta: number
}
const DEPTO_W = 89
const depto = (n: number, id: Depto['id'], nome: string, curto: string): Depto => {
  const x = n * (DEPTO_W + 4)
  return { id, nome, curto, x, w: DEPTO_W, porta: x + 44 }
}
export const DEPTOS: Depto[] = [
  depto(0, 'planejamento', 'Planejamento', 'Planejamento'),
  depto(1, 'criacao', 'Criação', 'Criação'),
  depto(2, 'estudio', 'Estúdio', 'Estúdio'),
  depto(3, 'publicacao', 'Revisão e publicação', 'Publicação'),
]
export const PAREDE_DEPTO_Y = 152 // parede entre os departamentos e o hall
export const LINHA_DEPTO = 144 // onde se anda dentro do departamento, na frente das mesas
export const LINHA_HALL = 174 // onde se anda no hall
/** balcão do café, no hall entre a porta do Estúdio e a da Publicação */
export const CAFE = { x: 250, y: 159 }

// ───────── sala de cada marca: recepção da marca, sem funcionários ─────────
// A equipe é uma só, para todas as marcas (mesmo código, a marca entra como contexto). Cada marca tem a sua sala
// com o que é dela: quadros da parede, pedidos, Instagram, cofrinho, gaveta e decoração.
export const MARCA_W = 176
export const PASSO_MARCA = MARCA_W + 16
/** a sala da equipe vem primeiro no andar, depois as das marcas */
export const PASSO_EQUIPE = SALA_W + 16
export const PORTA_MARCA = MARCA_W / 2
/** onde se anda na sala da marca */
export const LINHA_MARCA = 196
// A sala é enxuta e dividida em cantos: em cima à esquerda, criar e publicar (pedidos e Instagram);
// em cima à direita, guardar e gastar (gaveta e cofrinho); no meio, o tapete com o nome; embaixo, decorar.
/** Canto de criar e publicar, e canto de guardar: um tapetinho embaixo de cada um. */
export const CANTOS = { criar: { x: 6, y: 46, w: 72, h: 40 }, guardar: { x: 98, y: 46, w: 72, h: 40 } }
/** Escrivaninha de pedidos (máquina de escrever com a folha do pedido): clicar abre um post novo para a marca. */
export const NOVO_POST = { x: 12, y: 50, w: 34, h: 30 }
/** Celular no suporte: a tela fica nas cores do Instagram quando a marca está conectada. */
export const INSTAGRAM = { x: 52, y: 46, w: 18, h: 34 }
/** Cofrinho: clicar mostra quanto a marca está gastando. */
export const COFRINHO = { x: 106, y: 58, w: 24, h: 22 }
/** Gaveta de posts: cômoda com uma gaveta aberta cheia de pastas. */
export const GAVETA = { x: 136, y: 52, w: 30, h: 28 }
/** Kit de decoração (cavalete com a sala pintada): clicar abre a edição da sala. */
export const DECORAR = { x: 12, y: 146, w: 30, h: 28 }

/** Mesas: duas colunas por departamento, em duas fileiras. O boneco senta embaixo, de costas para nós. */
const COLUNA = [3, 56]
const FILEIRA = [54, 104]
const lugar = (d: number, coluna: number, fileira: number) => ({ x: d * (DEPTO_W + 4) + COLUNA[coluna], y: FILEIRA[fileira] })
export const MESAS: Record<AgenteId, { x: number; y: number }> = {
  // Planejamento: o plano editorial, a pauta de cada post e a pesquisa (o quadro da pauta fica no canto livre)
  social: lugar(0, 0, 0),
  chefe: lugar(0, 1, 0),
  pesquisador: lugar(0, 0, 1),
  // Criação: texto em cima, os outros designers embaixo
  redator: lugar(1, 0, 0),
  designer: lugar(1, 1, 0),
  criativos: lugar(1, 0, 1),
  paginas: lugar(1, 1, 1),
  // Estúdio: só os Reels; embaixo fica o fundo de gravação
  cinegrafista: lugar(2, 0, 0),
  narrador: lugar(2, 1, 0),
  // Revisão e publicação: confere, vira regra o que você corrigiu e publica
  revisor: lugar(3, 0, 0),
  curador: lugar(3, 1, 0),
  publicador: lugar(3, 0, 1),
}
/** distância entre as duas mesas de uma fileira (a etiqueta do nome não passa disso) */
export const ENTRE_MESAS = COLUNA[1] - COLUNA[0]
/** Canto livre de cada departamento que não enche as duas fileiras. */
export const QUADRO_PAUTA = { x: COLUNA[1] + 2, y: 94, w: 26, h: 28 }
export const ESTUDIO_SET = { x: DEPTOS[2].x + 6, y: 92 }
export const MESINHA_PUBLICACAO = { x: DEPTOS[3].x + COLUNA[1] + 2, y: 108 }
export const MESA_W = 30

/** Quadros da parede da sala da marca que abrem algo ao clicar: referências, calendário, branding e regras. */
export const QUADROS = {
  // quatro quadros iguais e com o mesmo espaço entre eles
  referencias: { x: 7, y: 4, w: 36, h: 26 },
  calendario: { x: 49, y: 4, w: 36, h: 26 },
  branding: { x: 91, y: 4, w: 36, h: 26 },
  regras: { x: 133, y: 4, w: 36, h: 26 },
} as const
export type Quadro = keyof typeof QUADROS

/** Onde ficam os pés do boneco sentado. */
export const assento = (m: { x: number; y: number }) => ({ x: m.x + MESA_W / 2, y: m.y + 27 })
export const deptoDe = (m: { x: number }) => DEPTOS.find((d) => m.x >= d.x && m.x < d.x + d.w) ?? DEPTOS[0]

type P = [number, number]
/** Em pé ao lado da cadeira, do lado de fora (longe da mesa do meio do departamento). */
export function aoLadoDe(m: { x: number; y: number }): P {
  const a = assento(m)
  return [a.x < deptoDe(m).porta ? a.x - 13 : a.x + 13, a.y]
}
/** Da cadeira até o hall, saindo pela porta do departamento (coordenadas da sala). */
export function ateOHall(m: { x: number; y: number }): P[] {
  const a = assento(m)
  const d = deptoDe(m)
  return [[a.x, a.y], [a.x, LINHA_DEPTO], [d.porta, LINHA_DEPTO], [d.porta, LINHA_HALL]]
}
/** Do hall até ficar ao lado de quem recebe. */
export function doHallAte(m: { x: number; y: number }): P[] {
  const d = deptoDe(m)
  const [lx, ly] = aoLadoDe(m)
  return [[d.porta, LINHA_HALL], [d.porta, LINHA_DEPTO], [lx, LINHA_DEPTO], [lx, ly]]
}
/** Caminho dentro da mesma sala, de uma cadeira até o lado de outra. */
export function dentroDaSala(de: { x: number; y: number }, para: { x: number; y: number }): P[] {
  if (deptoDe(de) === deptoDe(para)) {
    const a = assento(de)
    const [lx, ly] = aoLadoDe(para)
    return [[a.x, a.y], [a.x, LINHA_DEPTO], [lx, LINHA_DEPTO], [lx, ly]]
  }
  return [...ateOHall(de), ...doHallAte(para)]
}

/** Onde fica a placa com o nome da marca, no tapete da sala dela (o texto é HTML por cima, para ficar nítido). */
export const PLACA = { x: MARCA_W / 2, y: 114 }
/** Placa da sala da equipe, no tapete do hall. */
export const PLACA_EQUIPE = { x: SALA_W / 2, y: 197 }

/** Sua mesa, na sua sala (coordenadas locais). Você senta atrás dela, de frente para nós. */
export const MESA_VOCE = { x: 64, y: 78, w: 34 }
export const CALENDARIO = { x: 18, y: 6, w: 34, h: 24 }
