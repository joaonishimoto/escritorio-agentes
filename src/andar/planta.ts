// Planta do andar (1 unidade = 1 pixel da antiga pixel art; na maquete, 1 unidade = K metros): medidas, onde fica cada coisa e os caminhos.
import type { AgenteId } from '../agents/catalogo'

export const T = 16
/** faixa da parede do fundo nas salas das marcas */
export const PAREDE_H = 34
export const SALA_H = 240
export const CORREDOR_Y = 240
export const CORREDOR_H = 26
export const ANDAR_H = CORREDOR_Y + CORREDOR_H

// ───────── o andar da equipe: salas em volta de um hall, como num andar de agência ─────────
// Cada time tem a sua sala, do tamanho dele, só com os postos de trabalho. No meio fica o hall com a recepção e o café.
// A sua sala e a do Financeiro também ficam aqui. As salas das marcas ficam numa ala separada, à esquerda.
// Ninguém leva pasta andando: o trabalho vai por e-mail; só se levanta para ir ao café.

/** tamanho do andar da equipe */
export const EQUIPE_W = 800
export const EQUIPE_H = 528
/** largura das portas */
export const PORTA = 32

export type IdSala = 'pauta' | 'design' | 'estudio' | 'revisao' | 'publicacao' | 'voce' | 'financeiro'
export interface Sala {
  id: IdSala
  nome: string
  /** nome na placa em tela estreita */
  curto: string
  x: number
  y: number
  w: number
  h: number
  /** porta: em que parede fica e onde fica o meio dela (coordenada do andar ao longo da parede) */
  porta: { lado: 'cima' | 'baixo' | 'esquerda' | 'direita'; em: number }
}
const S = (id: IdSala, nome: string, curto: string, x: number, y: number, w: number, h: number, porta: Sala['porta']): Sala => ({ id, nome, curto, x, y, w, h, porta })
/** As salas do andar da equipe (o nome ficou DEPTOS de quando eram departamentos de uma sala só). */
export const DEPTOS: Sala[] = [
  S('pauta', 'Pauta e texto', 'Pauta', 0, 0, 304, 176, { lado: 'baixo', em: 248 }),
  S('design', 'Design', 'Design', 304, 0, 240, 176, { lado: 'baixo', em: 516 }),
  S('estudio', 'Estúdio', 'Estúdio', 544, 0, 256, 208, { lado: 'baixo', em: 562 }),
  S('revisao', 'Revisão', 'Revisão', 0, 176, 224, 176, { lado: 'direita', em: 232 }),
  S('publicacao', 'Publicação', 'Publicação', 0, 352, 192, 176, { lado: 'direita', em: 400 }),
]
export const SALA_VOCE = S('voce', 'Sua sala', 'Você', 576, 208, 224, 160, { lado: 'esquerda', em: 288 })
export const SALA_FIN = S('financeiro', 'Financeiro', 'Financeiro', 576, 368, 224, 160, { lado: 'esquerda', em: 448 })
/** o hall: recepção, café e sofás (o resto do andar entre as salas) */
export const HALL = { x: 248, y: 200, w: 304, h: 304 }
/** balcão do café, no hall */
export const CAFE = { x: 280, y: 236 }
/** recepção, de frente para quem chega pela porta de baixo */
export const RECEPCAO = { x: 420, y: 420 }
/** porta do andar, embaixo (dá para o elevador) */
export const ENTRADA = { em: 384 }

/** Paredes do andar da equipe: [x0, y0, x1, y1]. As de cima e da esquerda são altas (fundo da maquete); as outras, baixas. */
export type Parede = [number, number, number, number]
export const PAREDES_ALTAS: Parede[] = [
  [0, 0, EQUIPE_W, 0],
  [0, 0, 0, EQUIPE_H],
]
export const PAREDES_BAIXAS: Parede[] = [
  // contorno da frente
  [0, EQUIPE_H, EQUIPE_W, EQUIPE_H],
  [EQUIPE_W, 0, EQUIPE_W, EQUIPE_H],
  // salas de cima
  [0, 176, 544, 176],
  [304, 0, 304, 176],
  [544, 0, 544, 208],
  [544, 208, EQUIPE_W, 208],
  // salas da esquerda
  [224, 176, 224, 352],
  [0, 352, 224, 352],
  [192, 352, 192, EQUIPE_H],
  // sua sala e Financeiro
  [576, 208, 576, EQUIPE_H],
  [576, 368, EQUIPE_W, 368],
]
/** vãos das portas nas paredes baixas: [x, y] do meio de cada um */
export const PORTAS: [number, number][] = [
  ...[...DEPTOS, SALA_VOCE, SALA_FIN].map((s): [number, number] =>
    s.porta.lado === 'baixo' ? [s.porta.em, s.y + s.h] : s.porta.lado === 'cima' ? [s.porta.em, s.y] : s.porta.lado === 'direita' ? [s.x + s.w, s.porta.em] : [s.x, s.porta.em],
  ),
  [ENTRADA.em, EQUIPE_H],
]
/** largura mínima do andar que cabe na tela do celular */
export const VISTA_MIN = 380

// ───────── sala de cada marca  recepção da marca, sem funcionários ─────────
// A equipe é uma só, para todas as marcas (mesmo código, a marca entra como contexto). Cada marca tem a sua sala
// com o que é dela: quadros da parede, pedidos, Instagram, cofrinho e gaveta.
export const MARCA_W = 176
export const PASSO_MARCA = MARCA_W + 16
/** espaço entre a ala das marcas e o andar da equipe */
export const VAO_ALA = 112
export const PORTA_MARCA = MARCA_W / 2
/** onde se anda na sala da marca */
export const LINHA_MARCA = 196
// A sala é enxuta e dividida em cantos: em cima à esquerda, criar e publicar (pedidos e Instagram);
// em cima à direita, guardar e gastar (gaveta e cofrinho); no meio, o tapete com o nome.
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

/** Postos de trabalho (canto de cima à esquerda da mesa). O boneco senta embaixo, de costas para nós. */
const M = (sala: Sala, cx: number, cy: number) => ({ x: sala.x + cx - 15, y: sala.y + cy - 8 })
const [PAUTA, DESIGN, ESTUDIO, REVISAO, PUBLICACAO] = DEPTOS
export const MESAS: Record<AgenteId, { x: number; y: number }> = {
  social: M(PAUTA, 72, 60),
  chefe: M(PAUTA, 196, 60),
  pesquisador: M(PAUTA, 72, 124),
  redator: M(PAUTA, 196, 124),
  designer: M(DESIGN, 64, 60),
  criativos: M(DESIGN, 172, 60),
  paginas: M(DESIGN, 64, 124),
  cinegrafista: M(ESTUDIO, 72, 76),
  narrador: M(ESTUDIO, 184, 76),
  revisor: M(REVISAO, 64, 76),
  curador: M(REVISAO, 156, 76),
  publicador: M(PUBLICACAO, 92, 76),
}
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
export const salaDe = (m: { x: number; y: number }) => DEPTOS.find((d) => m.x >= d.x && m.x < d.x + d.w && m.y >= d.y && m.y < d.y + d.h) ?? DEPTOS[0]

type P = [number, number]
/** Da cadeira até o balcão do café: pela linha das cadeiras até a porta, sai no hall e vai até o balcão. */
export function caminhoAteOCafe(m: { x: number; y: number }): P[] {
  const a = assento(m)
  const s = salaDe(m)
  const { lado, em } = s.porta
  const dentro: P = lado === 'baixo' ? [em, s.y + s.h - 14] : lado === 'cima' ? [em, s.y + 14] : lado === 'direita' ? [s.x + s.w - 14, em] : [s.x + 14, em]
  const fora: P = lado === 'baixo' ? [em, s.y + s.h + 18] : lado === 'cima' ? [em, s.y - 18] : lado === 'direita' ? [s.x + s.w + 18, em] : [s.x - 18, em]
  const cafe: P = [CAFE.x + 20, CAFE.y + 26]
  const linha: P = [dentro[0], a.y]
  return [[a.x, a.y], linha, dentro, fora, cafe]
}

/** Onde fica a placa com o nome da marca, no tapete da sala dela (o texto é HTML por cima, para ficar nítido). */
export const PLACA = { x: MARCA_W / 2, y: 114 }

/** Sua mesa, na sua sala. Você senta atrás dela, de frente para nós; o calendário fica num quadro em pé atrás de você. */
export const MESA_VOCE = { x: SALA_VOCE.x + 112 - 17, y: SALA_VOCE.y + 92, w: 34 }
export const CALENDARIO = { x: SALA_VOCE.x + 150, y: SALA_VOCE.y + 30, w: 34, h: 24 }

/** Mesa do Financeiro (ele senta atrás, de frente para nós) e o gráfico num quadro em pé, que abre o painel. */
export const MESA_FIN = { x: SALA_FIN.x + 112 - 18, y: SALA_FIN.y + 96, w: 36 }
export const GRAFICO_FIN = { x: SALA_FIN.x + 140, y: SALA_FIN.y + 34, w: 48, h: 28 }

/** Uma marca no andar: a sala dela, com a cor da marca (tapetes e quadros). */
export interface MarcaNoAndar {
  id: string
  nome: string
  /** cor que representa a marca na sala */
  cor?: string
  /** ordem em que a sala foi criada */
  ordem?: number
  /** a sala está ligada a uma conta do Instagram (o celular acende nas cores dele) */
  instagram?: boolean
  /** o token do Instagram vence logo ou a renovação falhou: o celular fica amarelo e diz o que fazer */
  instagramAviso?: string | null
}
