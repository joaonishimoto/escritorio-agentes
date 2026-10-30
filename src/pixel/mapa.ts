// Desenho do cenário parado: cada sala do andar, o corredor e as paredes.
// Medidas e estilos ficam em planta.ts e estilos.ts; os móveis em moveis.ts. Este arquivo reexporta tudo, para quem importa de 'mapa'.
import type { AgenteId } from '../agents/catalogo'
import { comCorDaMarca, COR_EQUIPE, type Estilo, ESTILOS, misturar } from './estilos'
import { cadeira, celularInstagram, cofrinho, type Ctx, divisoria, escrivaninhaNovoPost, type EstadoInstagram, estante, gaveteiro, janela, kitDecorar, mesa, mesinha, microfone, parede, piso, pisos, planta, quadroBranding, quadroReferencias, quadroRegras, r, tripe } from './moveis'
import { ANDAR_H, CALENDARIO, CANTOS, COFRINHO, CORREDOR_H, CORREDOR_Y, DECORAR, DEPTOS, GAVETA, INSTAGRAM, MARCA_W, MESA_VOCE, MESAS, NOVO_POST, PAREDE_DEPTO_Y, PAREDE_H, PLACA, PORTA_MARCA, PORTA_X, QUADROS, SALA_H, SALA_W, VOCE_W } from './planta'
export * from './planta'
export * from './estilos'
export type { EstadoInstagram } from './moveis'
export { cadeira, mesa, pisos, planta } from './moveis'

const VOCE: Estilo = { nome: 'Sua sala', piso: '#9a6a43', pisoLinha: '#6e4a2e', parede: '#1e3d66', paredeDetalhe: '#1a3559', rodape: '#b88a3a', mesa: '#5a3a24', mesaSombra: '#3d2817', cadeira: '#7a3b2a', tapete: '#7a2e2e' }


export function desenharEquipe(g: Ctx, x0: number, noite: boolean) {
  const estilo = comCorDaMarca(ESTILOS.d, COR_EQUIPE)
  const p = pisos(estilo)
  const topoHall = PAREDE_DEPTO_Y + 6
  piso(g, p.hall.estilo, x0, SALA_W, topoHall, SALA_H - topoHall, p.hall.padrao)
  piso(g, p.pauta.estilo, x0, 104, PAREDE_H, topoHall - PAREDE_H, p.pauta.padrao)
  piso(g, p.criacao.estilo, x0 + 108, 104, PAREDE_H, topoHall - PAREDE_H, p.criacao.padrao)
  piso(g, p.publicacao.estilo, x0 + 216, 104, PAREDE_H, topoHall - PAREDE_H, p.publicacao.padrao)
  parede(g, estilo, x0, SALA_W)
  for (const jx of [10, 58, 112, 188, 222, 296]) janela(g, x0 + jx, 7, jx === 58 || jx === 112 || jx === 188 ? 26 : 18, noite)
  estante(g, x0 + 150, 2)

  // divisórias entre os departamentos e a parede do hall, com uma porta em cada
  divisoria(g, estilo, x0 + 104, PAREDE_H, 4, topoHall - PAREDE_H)
  divisoria(g, estilo, x0 + 212, PAREDE_H, 4, topoHall - PAREDE_H)
  let ultimo = 0
  for (const d of DEPTOS) {
    divisoria(g, estilo, x0 + ultimo, PAREDE_DEPTO_Y, d.porta - 15 - ultimo, 6)
    r(g, estilo.rodape, x0 + d.porta - 15, PAREDE_DEPTO_Y + 4, 30, 2)
    ultimo = d.porta + 15
  }
  divisoria(g, estilo, x0 + ultimo, PAREDE_DEPTO_Y, SALA_W - ultimo, 6)

  for (const id of Object.keys(MESAS) as AgenteId[]) {
    const m = MESAS[id]
    mesa(g, estilo, x0 + m.x, m.y)
    cadeira(g, estilo, x0 + m.x + 9, m.y + 17)
  }
  tripe(g, x0 + MESAS.cinegrafista.x + 33, MESAS.cinegrafista.y - 4)
  microfone(g, x0 + MESAS.narrador.x + 2, MESAS.narrador.y - 6)
  mesinha(g, estilo, x0 + 266, 106)

  // hall: tapete com a placa da equipe, sofá de espera, café e plantas
  r(g, '#1f2330', x0 + 107, 184, 106, 30)
  r(g, estilo.rodape, x0 + 108, 185, 104, 28)
  r(g, misturar(estilo.rodape, '#ffffff', 0.3), x0 + 111, 188, 98, 1)
  r(g, misturar(estilo.rodape, '#ffffff', 0.3), x0 + 111, 209, 98, 1)
  sofa(g, x0 + 20, 196, 56, '#3d5a80')
  mesaDeCentro(g, x0 + 30, 178, 34)
  planta(g, x0 + 4, 216)
  planta(g, x0 + 302, 216)
  planta(g, x0 + 300, 160)
  r(g, '#1f2330', x0, SALA_H - 5, PORTA_X - 18, 5)
  r(g, '#1f2330', x0 + PORTA_X + 18, SALA_H - 5, SALA_W - PORTA_X - 18, 5)
  r(g, estilo.rodape, x0 + PORTA_X - 18, SALA_H - 2, 36, 2)
}

/** A sala de uma marca: quadros na parede, tapete com o nome, pedidos, Instagram, cofrinho, gaveta e decoração. */
export function desenharMarca(g: Ctx, x0: number, estilo: Estilo, quadros: { dias: Set<number>; hoje: number; regras: number; referencias: number; gaveta?: number; instagram?: EstadoInstagram }) {
  const p = pisos(estilo)
  piso(g, p.hall.estilo, x0, MARCA_W, PAREDE_H, SALA_H - PAREDE_H, p.hall.padrao)
  parede(g, estilo, x0, MARCA_W)
  const f = QUADROS.referencias
  quadroReferencias(g, estilo, x0 + f.x, f.y, f.w, f.h, quadros.referencias)
  desenharCalendario(g, x0, quadros.dias, quadros.hoje, QUADROS.calendario)
  const b = QUADROS.branding
  quadroBranding(g, estilo, x0 + b.x, b.y, b.w, b.h)
  const q = QUADROS.regras
  quadroRegras(g, x0 + q.x, q.y, q.w, q.h, quadros.regras)

  // cantos: um tapetinho claro embaixo de cada grupo de móveis
  for (const c of Object.values(CANTOS)) {
    r(g, misturar(estilo.tapete, '#000000', 0.12), x0 + c.x, c.y + 2, c.w, c.h)
    r(g, estilo.tapete, x0 + c.x, c.y, c.w, c.h)
    r(g, misturar(estilo.tapete, '#ffffff', 0.35), x0 + c.x + 2, c.y + 2, c.w - 4, 1)
  }
  escrivaninhaNovoPost(g, x0 + NOVO_POST.x, NOVO_POST.y)
  celularInstagram(g, x0 + INSTAGRAM.x, INSTAGRAM.y, quadros.instagram ?? 'desligado')
  cofrinho(g, x0 + COFRINHO.x, COFRINHO.y)
  gaveteiro(g, x0 + GAVETA.x, GAVETA.y, estilo, quadros.gaveta ?? 0)

  // tapete da marca no meio (o nome vai por cima), com a cor dela
  const tw = 120
  const tx = x0 + (MARCA_W - tw) / 2
  r(g, '#1f2330', tx - 1, PLACA.y - 18, tw + 2, 36)
  r(g, estilo.rodape, tx, PLACA.y - 17, tw, 34)
  r(g, misturar(estilo.rodape, '#ffffff', 0.3), tx + 3, PLACA.y - 14, tw - 6, 1)
  r(g, misturar(estilo.rodape, '#ffffff', 0.3), tx + 3, PLACA.y + 13, tw - 6, 1)

  kitDecorar(g, x0 + DECORAR.x, DECORAR.y, estilo)
  planta(g, x0 + MARCA_W - 20, 150)
  r(g, '#1f2330', x0, SALA_H - 5, PORTA_MARCA - 18, 5)
  r(g, '#1f2330', x0 + PORTA_MARCA + 18, SALA_H - 5, MARCA_W - PORTA_MARCA - 18, 5)
  r(g, estilo.rodape, x0 + PORTA_MARCA - 18, SALA_H - 2, 36, 2)
}

/** Sua sala, no fim do corredor. */
export function desenharSuaSala(g: Ctx, x0: number) {
  // escritório executivo: assoalho de madeira escura, lambri, tapete persa, sofá de couro e bar
  piso(g, VOCE, x0, VOCE_W, PAREDE_H, SALA_H - PAREDE_H, 'tabua')
  parede(g, VOCE, x0, VOCE_W)
  lambri(g, x0, VOCE_W, '#4a2f1c')
  janela(g, x0 + 104, 7, 40, false)
  cortina(g, x0 + 100, 4, '#7a2e2e')
  cortina(g, x0 + 144, 4, '#7a2e2e')
  estante(g, x0 + 62, 2)
  tapetePersa(g, x0 + 30, 62, 100, 58, '#7a2e2e', '#d9b25f', '#1e3d66')
  luminariaDePe(g, x0 + 140, 54)
  globo(g, x0 + 132, 126)
  // canto de estar: sofá chesterfield, mesinha de centro e quadro
  mesaDeCentro(g, x0 + 16, 176, 34)
  sofa(g, x0 + 6, 198, 56, '#6b3a22')
  carrinhoBar(g, x0 + 110, 196)
  planta(g, x0 + 4, 138)
  planta(g, x0 + 140, 216)
  r(g, '#1f2330', x0, SALA_H - 5, PORTA_X - 18 - 32, 5)
  r(g, '#1f2330', x0 + 96, SALA_H - 5, VOCE_W - 96, 5)
  r(g, VOCE.rodape, x0 + 62, SALA_H - 2, 34, 2)
}
export const PORTA_VOCE_X = 80

export function desenharCorredor(g: Ctx, largura: number) {
  r(g, '#ddd6c8', 0, CORREDOR_Y, largura, CORREDOR_H)
  for (let x = 0; x < largura; x += 16) r(g, '#d2cab9', x, CORREDOR_Y, 1, CORREDOR_H)
  // corredor estreito: só uma passadeira para quem leva pastas de uma sala a outra
  r(g, '#2a5288', 8, CORREDOR_Y + 6, largura - 16, 14)
  r(g, '#3969a8', 8, CORREDOR_Y + 7, largura - 16, 1)
  r(g, '#3969a8', 8, CORREDOR_Y + 18, largura - 16, 1)
}

/** Largura da parede externa que fecha o andar nas duas pontas. */
export const PAREDE_EXTERNA = 28
/** Parede externa do prédio: mais grossa que as divisórias, com tijolos marcados, do teto ao fim do corredor. */
export function desenharParedeExterna(g: Ctx, x: number, w: number) {
  r(g, '#1f2330', x, -40, w, ANDAR_H + 80)
  r(g, '#3a3f4f', x + 2, -40, w - 4, ANDAR_H + 78)
  // fiadas de tijolo
  for (let y = -36; y < ANDAR_H + 36; y += 8) {
    r(g, '#2f3442', x + 2, y, w - 4, 1)
    const desloca = ((y / 8) % 2) * 6
    for (let bx = x + 2 + desloca; bx < x + w - 2; bx += 12) r(g, '#2f3442', bx, y, 1, 8)
  }
  r(g, '#4a5063', x + 2, -40, 1, ANDAR_H + 78)
  r(g, '#4a5063', x + w - 3, -40, 1, ANDAR_H + 78)
}

export function desenharParedeEntre(g: Ctx, x: number) {
  r(g, '#1f2330', x, 0, 16, SALA_H)
  r(g, '#3a3f4f', x + 2, 0, 12, SALA_H - 2)
}

export function desenharMesaVoce(g: Ctx, x0: number) {
  const { x, y, w } = MESA_VOCE
  // mesa de nogueira com tampo de couro verde, abajur de banqueiro, notebook e bandeja de entrada
  r(g, 'rgba(0,0,0,.2)', x0 + x + 2, y + 16, w, 3)
  r(g, '#1f2330', x0 + x - 1, y - 1, w + 2, 18)
  r(g, '#5a3a24', x0 + x, y, w, 12)
  r(g, '#2f5d47', x0 + x + 2, y + 2, w - 4, 8)
  r(g, '#3d2817', x0 + x, y + 12, w, 4)
  r(g, '#b88a3a', x0 + x + w / 2 - 1, y + 13, 2, 1)
  r(g, '#d9dde6', x0 + x + 4, y + 4, 10, 6) // notebook
  r(g, '#9fb3d6', x0 + x + 5, y + 5, 8, 3)
  r(g, '#1e3d66', x0 + x + 20, y + 3, 10, 6) // bandeja de entrada
  r(g, '#ffffff', x0 + x + 21, y + 4, 8, 2)
  r(g, '#1f2330', x0 + x + w - 4, y - 5, 1, 7) // abajur
  r(g, '#1f2330', x0 + x + w - 8, y - 8, 9, 4)
  r(g, '#2f7a52', x0 + x + w - 7, y - 7, 7, 2)
  r(g, '#f2d27a', x0 + x + w - 6, y - 5, 5, 1)
}

/** Lambri de madeira na base da parede, com friso dourado. */
function lambri(g: Ctx, x0: number, w: number, cor: string) {
  r(g, cor, x0, PAREDE_H - 12, w, 8)
  for (let x = x0 + 4; x < x0 + w; x += 12) r(g, misturar(cor, '#000000', 0.25), x, PAREDE_H - 11, 1, 6)
  r(g, '#d9b25f', x0, PAREDE_H - 13, w, 1)
}

function cortina(g: Ctx, x: number, y: number, cor: string) {
  r(g, '#1f2330', x - 1, y - 1, 6, 26)
  r(g, cor, x, y, 4, 24)
  r(g, misturar(cor, '#000000', 0.3), x + 2, y, 1, 24)
  r(g, '#d9b25f', x - 1, y + 14, 6, 1)
}

/** Tapete persa: borda dourada, campo vinho e um medalhão no meio. */
function tapetePersa(g: Ctx, x: number, y: number, w: number, h: number, campo: string, borda: string, detalhe: string) {
  r(g, 'rgba(0,0,0,.15)', x + 1, y + 1, w, h)
  r(g, borda, x, y, w, h)
  r(g, campo, x + 3, y + 3, w - 6, h - 6)
  const pontilhado = misturar(borda, '#ffffff', 0.25)
  for (let i = x + 4; i < x + w - 4; i += 4) {
    r(g, pontilhado, i, y + 1, 2, 1)
    r(g, pontilhado, i, y + h - 2, 2, 1)
  }
  r(g, borda, x + 6, y + 6, w - 12, 1)
  r(g, borda, x + 6, y + h - 7, w - 12, 1)
  const cx = x + w / 2
  const cy = y + h / 2
  for (let k = 0; k < 7; k++) r(g, k % 2 ? borda : detalhe, cx - 14 + k * 2, cy - 7 + Math.abs(3 - k), 28 - k * 4 > 0 ? 28 - k * 4 : 2, 14 - Math.abs(3 - k) * 2)
  r(g, borda, cx - 2, cy - 2, 4, 4)
  for (const [a, b] of [[x + 10, y + 10], [x + w - 14, y + 10], [x + 10, y + h - 14], [x + w - 14, y + h - 14]]) {
    r(g, detalhe, a, b, 4, 4)
    r(g, borda, a + 1, b + 1, 2, 2)
  }
  // franjas
  for (let i = x + 2; i < x + w - 2; i += 3) {
    r(g, '#efe3c4', i, y - 2, 1, 2)
    r(g, '#efe3c4', i, y + h, 1, 2)
  }
}

function luminariaDePe(g: Ctx, x: number, y: number) {
  r(g, 'rgba(0,0,0,.15)', x - 3, y + 30, 10, 2)
  r(g, '#1f2330', x - 4, y - 1, 12, 9)
  r(g, '#efe3c4', x - 3, y, 10, 7)
  r(g, '#fff6d8', x - 2, y + 1, 4, 2)
  r(g, '#b88a3a', x + 1, y + 8, 2, 21)
  r(g, '#1f2330', x - 2, y + 29, 8, 2)
}

function globo(g: Ctx, x: number, y: number) {
  r(g, 'rgba(0,0,0,.15)', x, y + 22, 14, 2)
  r(g, '#1f2330', x + 1, y - 1, 12, 14)
  r(g, '#3d77b0', x + 2, y, 10, 12)
  r(g, '#5aa06b', x + 3, y + 2, 4, 3)
  r(g, '#5aa06b', x + 7, y + 6, 3, 4)
  r(g, '#9fc6ea', x + 3, y + 1, 2, 1)
  r(g, '#b88a3a', x, y + 4, 1, 6)
  r(g, '#b88a3a', x + 6, y + 12, 2, 6)
  r(g, '#1f2330', x + 3, y + 18, 8, 3)
  r(g, '#5a3a24', x + 4, y + 18, 6, 2)
}

/** Sofá chesterfield de couro, visto de frente (encosto em cima). */
function sofa(g: Ctx, x: number, y: number, w: number, cor: string) {
  const claro = misturar(cor, '#ffffff', 0.18)
  const escuro = misturar(cor, '#000000', 0.3)
  r(g, 'rgba(0,0,0,.18)', x + 2, y + 20, w, 3)
  r(g, '#1f2330', x - 1, y - 1, w + 2, 22)
  r(g, cor, x, y, w, 20)
  r(g, escuro, x, y + 8, w, 1)
  for (let i = x + 4; i < x + w - 3; i += 6) {
    r(g, escuro, i, y + 3, 1, 1)
    r(g, claro, i + 1, y + 2, 1, 1)
  }
  r(g, claro, x + 5, y + 10, w / 2 - 6, 6)
  r(g, claro, x + w / 2 + 1, y + 10, w / 2 - 6, 6)
  r(g, escuro, x, y, 4, 20)
  r(g, escuro, x + w - 4, y, 4, 20)
  r(g, '#1f2330', x + 2, y + 20, 2, 2)
  r(g, '#1f2330', x + w - 4, y + 20, 2, 2)
}

function mesaDeCentro(g: Ctx, x: number, y: number, w: number) {
  r(g, 'rgba(0,0,0,.15)', x + 2, y + 10, w, 2)
  r(g, '#1f2330', x - 1, y - 1, w + 2, 11)
  r(g, '#5a3a24', x, y, w, 7)
  r(g, '#3d2817', x, y + 7, w, 2)
  r(g, '#d9dde6', x + 4, y + 2, 8, 4) // revistas
  r(g, '#b74e45', x + 5, y + 3, 6, 1)
  r(g, '#ffffff', x + w - 10, y + 1, 4, 4) // xícara
  r(g, '#6b4f36', x + w - 9, y + 2, 2, 2)
}

/** Carrinho de bar dourado com garrafas e copos. */
function carrinhoBar(g: Ctx, x: number, y: number) {
  r(g, 'rgba(0,0,0,.15)', x + 1, y + 20, 26, 2)
  r(g, '#b88a3a', x, y + 6, 26, 2)
  r(g, '#b88a3a', x, y + 16, 26, 2)
  r(g, '#b88a3a', x, y + 6, 2, 14)
  r(g, '#b88a3a', x + 24, y + 6, 2, 14)
  const garrafas = ['#3f7650', '#976822', '#7a2e2e']
  garrafas.forEach((c, i) => {
    r(g, '#1f2330', x + 3 + i * 6, y - 3, 5, 9)
    r(g, c, x + 4 + i * 6, y - 1, 3, 7)
    r(g, c, x + 5 + i * 6, y - 4, 1, 3)
  })
  r(g, '#cfe6f2', x + 21, y + 2, 3, 4)
  r(g, '#cfe6f2', x + 6, y + 12, 3, 4)
  r(g, '#cfe6f2', x + 11, y + 12, 3, 4)
  r(g, '#1f2330', x + 1, y + 20, 3, 3)
  r(g, '#1f2330', x + 22, y + 20, 3, 3)
}

export function desenharCalendario(g: Ctx, x0: number, marcados: Set<number>, hoje: number, q: { x: number; y: number; w: number; h: number } = CALENDARIO) {
  const { x, y, w, h } = q
  r(g, '#1f2330', x0 + x - 1, y - 1, w + 2, h + 2)
  r(g, '#ffffff', x0 + x, y, w, h)
  r(g, '#b74e45', x0 + x, y, w, 5)
  const passoX = (w - 4) / 7
  const passoY = (h - 8) / 5
  for (let d = 1; d <= 31; d++) {
    const c = (d - 1) % 7
    const l = Math.floor((d - 1) / 7)
    const cor = d === hoje ? '#1e3d66' : marcados.has(d) ? '#f2b233' : '#d9dde6'
    r(g, cor, x0 + x + 2 + c * passoX, y + 7 + l * passoY, Math.max(3, passoX - 1.4), Math.max(2, passoY - 1.4))
  }
}

// ───────── sala do Financeiro, depois da sua sala ─────────

export const FIN_W = 128
const FIN: Estilo = { nome: 'Financeiro', piso: '#e9e6df', pisoLinha: '#c9c3b6', parede: '#2f5d47', paredeDetalhe: '#28503d', rodape: '#3f7650', mesa: '#ffffff', mesaSombra: '#c9ccd6', cadeira: '#3f7650', tapete: '#cfe0d2' }
/** Mesa do Financeiro (ele senta atrás, de frente para nós) e o gráfico na parede, que abre o painel. */
export const MESA_FIN = { x: 46, y: 82, w: 36 }
export const GRAFICO_FIN = { x: 40, y: 3, w: 48, h: 28 }
export const PORTA_FIN_X = 64

/** O gráfico da parede: barras dos gastos dos últimos dias (redesenhado quando os números chegam). */
export function desenharGraficoFin(g: Ctx, x0: number, barras: number[], alerta: boolean) {
  const { x, y, w, h } = GRAFICO_FIN
  r(g, '#1f2330', x0 + x - 1, y - 1, w + 2, h + 2)
  r(g, '#fbfaf6', x0 + x, y, w, h)
  r(g, alerta ? '#b74e45' : '#3f7650', x0 + x, y, w, 4)
  const n = Math.max(1, barras.length)
  const max = Math.max(...barras, 0.0001)
  const larg = Math.max(1, Math.floor((w - 6) / n) - 1)
  barras.forEach((v, i) => {
    const alt = Math.max(1, Math.round((v / max) * (h - 10)))
    r(g, i === n - 1 ? (alerta ? '#b74e45' : '#3f7650') : '#9fb8a6', x0 + x + 3 + i * (larg + 1), y + h - 3 - alt, larg, alt)
  })
  r(g, '#c9c3b4', x0 + x + 2, y + h - 3, w - 4, 1)
}

function relogio(g: Ctx, x: number, y: number) {
  r(g, '#1f2330', x - 1, y - 1, 16, 16)
  r(g, '#b88a3a', x, y, 14, 14)
  r(g, '#fbf7ee', x + 2, y + 2, 10, 10)
  r(g, '#1f2330', x + 6, y + 3, 1, 4)
  r(g, '#1f2330', x + 7, y + 6, 3, 1)
}

/** Arquivo de aço com três gavetas. */
function arquivo(g: Ctx, x: number, y: number) {
  r(g, 'rgba(0,0,0,.15)', x + 1, y + 30, 16, 2)
  r(g, '#1f2330', x - 1, y - 1, 18, 32)
  r(g, '#8a929e', x, y, 16, 30)
  for (let i = 0; i < 3; i++) {
    r(g, '#6f7783', x + 1, y + 1 + i * 10, 14, 1)
    r(g, '#1f2330', x + 6, y + 4 + i * 10, 4, 2)
    r(g, '#ffffff', x + 3, y + 3 + i * 10, 2, 2)
  }
}

/** Poltrona de couro para quem visita, de costas para nós. */
function poltrona(g: Ctx, x: number, y: number, cor: string) {
  const escuro = misturar(cor, '#000000', 0.3)
  r(g, 'rgba(0,0,0,.18)', x + 1, y + 14, 16, 2)
  r(g, '#1f2330', x - 1, y - 1, 18, 16)
  r(g, cor, x, y, 16, 14)
  r(g, escuro, x, y, 3, 14)
  r(g, escuro, x + 13, y, 3, 14)
  r(g, misturar(cor, '#ffffff', 0.2), x + 4, y + 2, 8, 2)
  for (let i = x + 5; i < x + 12; i += 3) r(g, escuro, i, y + 6, 1, 1)
}

/** Mesinha com pilhas de moedas de ouro. */
function moedas(g: Ctx, x: number, y: number) {
  r(g, '#1f2330', x - 1, y + 9, 22, 8)
  r(g, '#5a3a24', x, y + 10, 20, 5)
  r(g, '#1f2330', x + 2, y + 15, 2, 6)
  r(g, '#1f2330', x + 16, y + 15, 2, 6)
  for (const [a, h] of [[2, 8], [8, 5], [14, 7]]) {
    r(g, '#1f2330', x + a - 1, y + 9 - h, 6, h + 1)
    for (let k = 0; k < h; k += 2) r(g, k % 4 ? '#f2b233' : '#ffd36b', x + a, y + 9 - h + k, 4, 2)
  }
}

function cofre(g: Ctx, x: number, y: number) {
  r(g, '#1f2330', x - 1, y - 1, 22, 24)
  r(g, '#5d6470', x, y, 20, 22)
  r(g, '#737b88', x + 2, y + 2, 16, 18)
  r(g, '#1f2330', x + 8, y + 8, 5, 5)
  r(g, '#f2b233', x + 9, y + 9, 3, 3)
}

export function desenharSalaFin(g: Ctx, x0: number) {
  // banco suíço: piso de mármore, lambri, cofre forte, arquivos, poltronas de couro e moedas de ouro
  piso(g, FIN, x0, FIN_W, PAREDE_H, SALA_H - PAREDE_H, 'ladrilho')
  for (let i = 0; i < 9; i++) r(g, '#d6d0c3', x0 + 6 + ((i * 37) % 110), PAREDE_H + 14 + ((i * 53) % 190), 6 + (i % 3) * 3, 1) // veios do mármore
  parede(g, FIN, x0, FIN_W)
  lambri(g, x0, FIN_W, '#3d2817')
  relogio(g, x0 + 14, 6)
  janela(g, x0 + 98, 7, 22, false)
  cortina(g, x0 + 94, 4, '#2f5d47')
  tapetePersa(g, x0 + 24, 68, 80, 62, '#2f5d47', '#d9b25f', '#7a2e2e')
  cofre(g, x0 + 8, 40)
  arquivo(g, x0 + 4, 150)
  arquivo(g, x0 + 22, 150)
  poltrona(g, x0 + 40, 112, '#6b3a22')
  poltrona(g, x0 + 72, 112, '#6b3a22')
  moedas(g, x0 + 100, 150)
  planta(g, x0 + 108, 40)
  planta(g, x0 + 108, 200)
  planta(g, x0 + 6, 200)
  // parede de baixo, com a porta
  r(g, '#1f2330', x0, SALA_H - 5, PORTA_FIN_X - 18, 5)
  r(g, '#1f2330', x0 + PORTA_FIN_X + 18, SALA_H - 5, FIN_W - PORTA_FIN_X - 18, 5)
  r(g, FIN.rodape, x0 + PORTA_FIN_X - 18, SALA_H - 2, 36, 2)
}

/** A mesa por cima do boneco sentado: monitor com gráfico e calculadora. */
export function desenharMesaFin(g: Ctx, x0: number) {
  const { x, y, w } = MESA_FIN
  r(g, 'rgba(0,0,0,.15)', x0 + x + 2, y + 16, w, 3)
  r(g, '#1f2330', x0 + x - 1, y - 1, w + 2, 18)
  r(g, '#ffffff', x0 + x, y, w, 12)
  r(g, '#c9ccd6', x0 + x, y + 12, w, 4)
  r(g, '#2a2d36', x0 + x + 3, y + 2, 9, 8) // calculadora
  r(g, '#9fd3a8', x0 + x + 4, y + 3, 7, 2)
  r(g, '#d9dde6', x0 + x + 22, y + 3, 10, 7) // relatório
  r(g, '#3f7650', x0 + x + 24, y + 5, 6, 1)
  r(g, '#3f7650', x0 + x + 24, y + 7, 4, 1)
}
