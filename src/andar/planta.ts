// Planta do andar em pixel art (1 unidade = 1 pixel antes da escala): medidas, onde fica cada coisa e os caminhos.
import type { AgenteId } from '../agents/catalogo'

export const T = 16
/** largura de cada sala da equipe (duas mesas com corredor no meio) */
const SALA_EQ_W = 120
/** parede entre duas salas vizinhas */
export const PAREDE_ENTRE = 16
export const PAREDE_H = 34 // faixa da parede do fundo
export const SALA_H = 240
export const CORREDOR_Y = 240
export const CORREDOR_H = 26
export const ANDAR_H = CORREDOR_Y + CORREDOR_H
export const VOCE_W = 160
export const CORREDOR_PES = CORREDOR_Y + 14

// ───────── a equipe: uma sala por especialidade, lado a lado, na ordem do trabalho ─────────
// Pauta e texto decide o que fazer e escreve, Design desenha, Estúdio grava os Reels, Revisão confere e aprende
// com as suas correções, e Publicação publica (e tem o café). Ninguém leva pasta andando: o trabalho vai por e-mail.

export interface Depto {
  id: 'pauta' | 'design' | 'estudio' | 'revisao' | 'publicacao'
  nome: string
  /** nome na placa em tela estreita */
  curto: string
  x: number
  w: number
  /** centro da porta que dá no corredor */
  porta: number
}
const sala = (n: number, id: Depto['id'], nome: string, curto: string): Depto => {
  const x = n * (SALA_EQ_W + PAREDE_ENTRE)
  return { id, nome, curto, x, w: SALA_EQ_W, porta: x + SALA_EQ_W / 2 }
}
/** As salas da equipe (o nome ficou DEPTOS de quando eram departamentos de uma sala só). */
export const DEPTOS: Depto[] = [
  sala(0, 'pauta', 'Pauta e texto', 'Pauta'),
  sala(1, 'design', 'Design', 'Design'),
  sala(2, 'estudio', 'Estúdio', 'Estúdio'),
  sala(3, 'revisao', 'Revisão', 'Revisão'),
  sala(4, 'publicacao', 'Publicação', 'Publicação'),
]
/** largura de todas as salas da equipe juntas, com as paredes entre elas */
export const SALA_W = DEPTOS.length * SALA_EQ_W + (DEPTOS.length - 1) * PAREDE_ENTRE
/** onde se anda dentro das salas da equipe, na frente das mesas */
export const LINHA_SALA = 152
/** largura mínima do andar que cabe na tela do celular (as salas da equipe passam disso e a câmera anda) */
export const VISTA_MIN = 380

// ───────── sala de cada marca  recepção da marca, sem funcionários ─────────
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

/** Mesas: duas colunas por sala, em duas fileiras. O boneco senta embaixo, de costas para nós. */
export const COLUNA = [12, 78]
const FILEIRA = [50, 108]
const lugar = (d: number, coluna: number, fileira: number) => ({ x: DEPTOS[d].x + COLUNA[coluna], y: FILEIRA[fileira] })
export const MESAS: Record<AgenteId, { x: number; y: number }> = {
  // Pauta e texto: o plano editorial, a pauta, a pesquisa e o texto
  social: lugar(0, 0, 0),
  chefe: lugar(0, 1, 0),
  pesquisador: lugar(0, 0, 1),
  redator: lugar(0, 1, 1),
  // Design: posts, criativos de anúncio e (em treinamento) páginas; o mural de referências fica no canto livre
  designer: lugar(1, 0, 0),
  criativos: lugar(1, 1, 0),
  paginas: lugar(1, 0, 1),
  // Estúdio: só os Reels; o fundo de gravação fica encostado na parede do fundo e as mesas na frente
  cinegrafista: lugar(2, 0, 1),
  narrador: lugar(2, 1, 1),
  // Revisão: confere e vira regra o que você corrigiu
  revisor: lugar(3, 0, 0),
  curador: lugar(3, 1, 0),
  // Publicação: publica e agenda; o café da equipe fica aqui
  publicador: lugar(4, 0, 0),
}
/** Quadro da pauta, na frente das mesas da sala de Pauta e texto. */
export const QUADRO_PAUTA = { x: DEPTOS[0].x + 12, y: 168, w: 26, h: 28 }
/** Mural de referências no canto livre do Design. */
export const MURAL_DESIGN = { x: DEPTOS[1].x + COLUNA[1] + 2, y: 108, w: 28, h: 26 }
/** fundo verde, refletor e câmera, encostados na parede do fundo do Estúdio */
export const ESTUDIO_SET = { x: DEPTOS[2].x + 14, y: PAREDE_H + 3 }
/** mesinha com o celular e o notebook, ao lado do Publicador */
export const MESINHA_PUBLICACAO = { x: DEPTOS[4].x + COLUNA[1] + 2, y: 54 }
/** balcão do café, na sala da Publicação */
export const CAFE = { x: DEPTOS[4].x + 66, y: 172 }
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
/** Da cadeira até o balcão do café, pelo corredor se o café for em outra sala (coordenadas do andar). */
export function caminhoAteOCafe(m: { x: number; y: number }): P[] {
  const a = assento(m)
  const d = deptoDe(m)
  const pub = DEPTOS[DEPTOS.length - 1]
  const cafe: P = [CAFE.x + 20, LINHA_SALA + 10]
  if (d === pub) return [[a.x, a.y], [a.x, LINHA_SALA], [cafe[0], LINHA_SALA], cafe]
  return [[a.x, a.y], [a.x, LINHA_SALA], [d.porta, LINHA_SALA], [d.porta, CORREDOR_PES], [pub.porta, CORREDOR_PES], [pub.porta, LINHA_SALA], [cafe[0], LINHA_SALA], cafe]
}

/** Onde fica a placa com o nome da marca, no tapete da sala dela (o texto é HTML por cima, para ficar nítido). */
export const PLACA = { x: MARCA_W / 2, y: 114 }
/** Placa com o nome de cada sala da equipe, no tapete da frente (x é o meio da sala). */
export const PLACA_SALA_Y = 214

/** Sua mesa, na sua sala (coordenadas locais). Você senta atrás dela, de frente para nós. */
export const MESA_VOCE = { x: 64, y: 78, w: 34 }
export const CALENDARIO = { x: 18, y: 6, w: 34, h: 24 }

/** porta da sua sala, que dá no corredor (coordenadas locais) */
export const PORTA_VOCE_X = 80

// ───────── sala do Financeiro, depois da sua sala ─────────
export const FIN_W = 128
/** Mesa do Financeiro (ele senta atrás, de frente para nós) e o gráfico na parede, que abre o painel. */
export const MESA_FIN = { x: 46, y: 82, w: 36 }
export const GRAFICO_FIN = { x: 40, y: 3, w: 48, h: 28 }
export const PORTA_FIN_X = 64

/** Uma marca no andar: a sala dela, com a cor, o estilo e o que o dono personalizou. */
export interface MarcaNoAndar {
  id: string
  nome: string
  /** cor que representa a marca na sala */
  cor?: string
  /** ordem em que a sala foi criada: decide o estilo padrão, mesmo com a sala mudando de lugar no andar */
  ordem?: number
  /** o que o dono personalizou na sala: pisos, paredes, móveis */
  sala?: import('./estilos').SalaCustom | null
  /** a sala está ligada a uma conta do Instagram (o celular acende nas cores dele) */
  instagram?: boolean
  /** o token do Instagram vence logo ou a renovação falhou: o celular fica amarelo e diz o que fazer */
  instagramAviso?: string | null
}
