// Móveis e objetos desenhados pixel a pixel, usados pelas salas.
import { type AreaSala, corValida, escurecer, type Estilo, misturar, type Piso, PISOS } from './estilos'
import { MESA_W, PAREDE_H } from './planta'

export type Ctx = CanvasRenderingContext2D
export const r = (g: Ctx, cor: string, x: number, y: number, w: number, h: number) => {
  g.fillStyle = cor
  g.fillRect(Math.round(x), Math.round(y), w, h)
}

/** Piso de uma área, recortado no retângulo dela (nada vaza para a área vizinha). */
export function piso(g: Ctx, e: Estilo, x0: number, w: number, y0: number, h: number, tipo: Piso) {
  g.save()
  g.beginPath()
  g.rect(x0, y0, w, h)
  g.clip()
  const base = e.piso
  const linha = e.pisoLinha
  const claro = misturar(base, '#ffffff', 0.14)
  const escuro = misturar(base, linha, 0.5)
  r(g, base, x0, y0, w, h)
  // o desenho segue uma grade única do andar (não começa do zero em cada área), e o ruído depende só da posição:
  // a mesma escolha de piso em áreas vizinhas fica contínua, como um piso só
  const ruido = (a: number, b: number) => (((a * 73856093) ^ (b * 19349663)) >>> 0) % 1000
  const de = (v: number, passo: number) => Math.floor(v / passo) * passo
  if (tipo === 'tabua') {
    for (let y = de(y0, 8); y < y0 + h; y += 8) {
      const f = y / 8
      const desloc = (((f * 29) % 44) + 44) % 44
      for (let x = de(x0 - desloc, 44) + desloc; x < x0 + w; x += 44) {
        const n = ruido(Math.floor(x / 44), f)
        r(g, n % 3 === 0 ? claro : n % 3 === 1 ? base : escuro, x, y, 44, 8)
        r(g, linha, x, y, 1, 8)
        r(g, misturar(base, linha, 0.75), x + 6 + (n % 20), y + 3 + (n % 3), 8 + (n % 6), 1)
      }
      r(g, linha, x0, y, w, 1)
    }
  } else if (tipo === 'xadrez') {
    for (let y = de(y0, 16); y < y0 + h; y += 16)
      for (let x = de(x0, 16); x < x0 + w; x += 16) {
        const par = (x / 16 + y / 16) % 2 === 0
        r(g, par ? linha : base, x, y, 16, 16)
        r(g, par ? misturar(linha, '#ffffff', 0.12) : claro, x, y, 16, 1)
        r(g, par ? misturar(linha, '#1f2330', 0.12) : escuro, x, y + 15, 16, 1)
      }
  } else if (tipo === 'concreto') {
    // placas grandes com juntas e pontinhos de agregado
    for (let y = de(y0, 32); y < y0 + h; y += 32)
      for (let x = de(x0, 32); x < x0 + w; x += 32) {
        r(g, ruido(x / 32, y / 32) % 2 ? base : misturar(base, linha, 0.18), x, y, 32, 32)
        r(g, linha, x, y, 32, 1)
        r(g, linha, x, y, 1, 32)
        r(g, claro, x + 1, y + 1, 31, 1)
      }
    for (let y = de(y0, 4); y < y0 + h; y += 4)
      for (let x = de(x0, 4); x < x0 + w; x += 4) {
        const n = ruido(x, y)
        if (n < 90) r(g, n % 2 ? linha : claro, x + (n % 4), y + ((n >> 2) % 4), 1, 1)
      }
  } else if (tipo === 'carpete') {
    // trama em losango miúdo, contínua de uma área para a outra
    for (let y = de(y0, 4); y < y0 + h; y += 4)
      for (let x = de(x0, 4) + ((y / 4) % 2) * 2; x < x0 + w; x += 4) {
        r(g, linha, x, y + 1, 1, 1)
        r(g, claro, x + 1, y + 2, 1, 1)
      }
  } else {
    // ladrilho: rejunte, brilho em cima e sombra embaixo de cada peça
    for (let y = de(y0, 24); y < y0 + h; y += 24)
      for (let x = de(x0, 24); x < x0 + w; x += 24) {
        if ((x / 24 + y / 24) % 2 === 0) r(g, misturar(base, '#ffffff', 0.08), x, y, 24, 24)
        r(g, linha, x, y, 24, 1)
        r(g, linha, x, y, 1, 24)
        r(g, misturar(base, '#ffffff', 0.3), x + 1, y + 1, 22, 1)
        r(g, misturar(base, '#ffffff', 0.3), x + 1, y + 1, 1, 22)
        r(g, escuro, x + 2, y + 23, 22, 1)
        r(g, misturar(base, '#ffffff', 0.45), x + 4, y + 4, 2, 1)
      }
  }
  g.restore()
}

export function parede(g: Ctx, e: Estilo, x0: number, w: number) {
  r(g, e.parede, x0, 0, w, PAREDE_H)
  if (e.tijolo) {
    for (let y = 0; y < PAREDE_H - 4; y += 5) {
      r(g, e.paredeDetalhe, x0, y, w, 1)
      for (let x = x0 + ((y / 5) % 2) * 6; x < x0 + w; x += 12) r(g, e.paredeDetalhe, x, y, 1, 5)
    }
  } else {
    for (let x = x0 + 8; x < x0 + w; x += 16) r(g, e.paredeDetalhe, x, 0, 1, PAREDE_H - 4)
  }
  r(g, e.rodape, x0, PAREDE_H - 4, w, 4)
  r(g, 'rgba(0,0,0,0.12)', x0, PAREDE_H, w, 3)
}

export function janela(g: Ctx, x: number, y: number, w: number, noite: boolean) {
  r(g, '#1f2330', x - 1, y - 1, w + 2, 20)
  r(g, noite ? '#f2c27a' : '#bcd6ef', x, y, w, 18)
  r(g, noite ? '#f7d9a6' : '#d9e8f7', x + 2, y + 2, 5, 8)
  r(g, '#1f2330', x + w / 2, y, 1, 18)
  r(g, '#1f2330', x, y + 9, w, 1)
  r(g, '#ffffff', x - 2, y + 18, w + 4, 2)
}

export function estante(g: Ctx, x: number, y: number) {
  const livros = ['#2a5288', '#b74e45', '#976822', '#3f7650', '#f2b233', '#52738a']
  r(g, '#1f2330', x - 1, y - 1, 34, 34)
  r(g, '#6b4f36', x, y, 32, 32)
  for (let p = 0; p < 3; p++) {
    r(g, '#3d2c1e', x + 2, y + 2 + p * 10, 28, 8)
    for (let i = 0; i < 6; i++) if ((i + p) % 5 !== 4) r(g, livros[(i + p * 2) % 6], x + 3 + i * 4.5, y + 3 + p * 10 + (i % 2), 3, 7 - (i % 2))
  }
}

export function planta(g: Ctx, x: number, y: number) {
  r(g, '#1f2330', x + 2, y + 9, 10, 8)
  r(g, '#d98f62', x + 3, y + 10, 8, 6)
  r(g, '#1f2330', x, y - 1, 14, 11)
  r(g, '#3f7650', x + 1, y, 12, 9)
  r(g, '#5aa06b', x + 3, y + 1, 4, 3)
  r(g, '#2f5e3e', x + 8, y + 5, 4, 3)
}

/** Câmera no tripé, ao lado da mesa do cinegrafista. */
export function tripe(g: Ctx, x: number, y: number) {
  r(g, '#1f2330', x - 1, y - 1, 12, 8)
  r(g, '#2a2d36', x, y, 10, 6)
  r(g, '#9fb3d6', x + 7, y + 2, 2, 2)
  r(g, '#1f2330', x + 4, y + 6, 2, 12)
  r(g, '#1f2330', x, y + 16, 2, 4)
  r(g, '#1f2330', x + 8, y + 16, 2, 4)
}

/** Microfone de estúdio com espuma, num pedestal em cima da mesa do narrador. */
export function microfone(g: Ctx, x: number, y: number) {
  r(g, '#1f2330', x - 1, y - 1, 6, 9)
  r(g, '#3a3f4b', x, y, 4, 7)
  r(g, '#5b6272', x + 1, y + 1, 1, 5)
  r(g, '#1f2330', x + 1, y + 8, 2, 5)
  r(g, '#1f2330', x - 2, y + 12, 8, 2)
}

/** Cômoda de madeira; com posts guardados, a gaveta de cima fica aberta mostrando as pastas. */
export function gaveteiro(g: Ctx, x: number, y: number, estilo: Estilo, quantos: number) {
  const madeira = estilo.mesa === '#ffffff' ? '#8a6a4a' : estilo.mesa
  const escuro = misturar(madeira, '#000000', 0.3)
  const claro = misturar(madeira, '#ffffff', 0.18)
  r(g, 'rgba(0,0,0,.15)', x + 2, y + 26, 28, 2)
  r(g, '#1f2330', x - 1, y + 3, 32, 24)
  r(g, madeira, x, y + 4, 30, 22)
  r(g, claro, x, y + 4, 30, 2)
  for (let i = 0; i < 3; i++) {
    r(g, escuro, x + 2, y + 8 + i * 6, 26, 1)
    r(g, '#d9b25f', x + 13, y + 10 + i * 6, 4, 1)
  }
  r(g, '#1f2330', x + 2, y + 26, 2, 2)
  r(g, '#1f2330', x + 26, y + 26, 2, 2)
  if (quantos > 0) {
    // gaveta de cima puxada para fora, com pastas coloridas aparecendo
    r(g, '#1f2330', x + 1, y - 2, 28, 9)
    r(g, escuro, x + 2, y - 1, 26, 7)
    const cores = ['#f2b233', '#7fb3e0', '#e07a6f', '#9fd3a8', '#f2a6b8']
    for (let i = 0; i < Math.min(5, quantos); i++) {
      r(g, '#1f2330', x + 4 + i * 5, y - 5 + (i % 2), 4, 6)
      r(g, cores[i % cores.length], x + 4 + i * 5, y - 4 + (i % 2), 3, 5)
    }
    r(g, madeira, x + 1, y + 4, 28, 3)
    r(g, '#d9b25f', x + 13, y + 5, 4, 1)
  }
}

/** Cavalete de pintor com um quadrinho da própria sala, paleta de tintas e pote de pincéis. */
export function kitDecorar(g: Ctx, x: number, y: number, estilo: Estilo) {
  const c = '#1f2330'
  const madeira = '#b07a45'
  const madeiraEsc = '#7d5530'
  r(g, 'rgba(0,0,0,.16)', x + 1, y + 26, 28, 2)
  // pernas do cavalete (a de trás no meio, as da frente abrindo)
  r(g, madeiraEsc, x + 14, y + 4, 2, 23)
  for (let k = 0; k < 20; k++) {
    const d = Math.floor(k / 7)
    r(g, c, x + 6 - d - 1, y + 7 + k, 4, 1)
    r(g, madeira, x + 6 - d, y + 7 + k, 2, 1)
    r(g, c, x + 21 + d - 1, y + 7 + k, 4, 1)
    r(g, madeira, x + 21 + d, y + 7 + k, 2, 1)
  }
  // tela com a sala pintada: parede, faixa da marca, piso e uma mesinha
  r(g, c, x + 3, y, 24, 16)
  r(g, '#f7f1e3', x + 4, y + 1, 22, 14)
  r(g, estilo.parede, x + 5, y + 2, 20, 5)
  r(g, misturar(estilo.parede, '#ffffff', 0.35), x + 9, y + 3, 4, 3)
  r(g, estilo.rodape, x + 5, y + 7, 20, 1)
  r(g, estilo.piso, x + 5, y + 8, 20, 6)
  r(g, estilo.pisoLinha, x + 5, y + 10, 20, 1)
  r(g, estilo.mesa === '#ffffff' ? '#e8e8ee' : estilo.mesa, x + 15, y + 9, 6, 2)
  r(g, estilo.tapete, x + 7, y + 11, 6, 2)
  // apoio da tela
  r(g, c, x + 2, y + 16, 26, 3)
  r(g, madeira, x + 3, y + 16, 24, 2)
  // paleta encostada na perna
  r(g, c, x - 1, y + 20, 12, 7)
  r(g, '#e9d3a8', x, y + 21, 10, 5)
  r(g, c, x + 7, y + 23, 2, 2)
  r(g, '#e05a4f', x + 1, y + 22, 2, 1)
  r(g, '#3d77b0', x + 4, y + 21, 2, 1)
  r(g, '#f2b233', x + 1, y + 24, 2, 1)
  r(g, estilo.rodape, x + 4, y + 24, 2, 1)
  // pote de pincéis
  r(g, '#3d77b0', x + 22, y + 15, 1, 6)
  r(g, '#e05a4f', x + 26, y + 16, 1, 5)
  r(g, c, x + 21, y + 19, 8, 8)
  r(g, '#cfe6f2', x + 22, y + 20, 6, 6)
  r(g, '#9fc6ea', x + 22, y + 23, 6, 3)
}

/** Escrivaninha de pedidos: mesa de madeira com uma máquina de escrever e a folha do pedido saindo dela, pilha de papel e copo de lápis. */
export function escrivaninhaNovoPost(g: Ctx, x: number, y: number) {
  const c = '#1f2330'
  const madeira = '#9a7046'
  const escuro = '#6e4c2c'
  const claro = '#b88a5c'
  r(g, 'rgba(0,0,0,.15)', x + 2, y + 28, 32, 2)
  // pés e saia da mesa
  r(g, c, x, y + 14, 34, 15)
  r(g, escuro, x + 1, y + 15, 32, 12)
  r(g, madeira, x + 3, y + 17, 12, 8)
  r(g, madeira, x + 19, y + 17, 12, 8)
  r(g, '#d9b25f', x + 8, y + 20, 2, 2)
  r(g, '#d9b25f', x + 24, y + 20, 2, 2)
  // tampo
  r(g, c, x - 2, y + 10, 38, 5)
  r(g, claro, x - 1, y + 11, 36, 2)
  r(g, madeira, x - 1, y + 13, 36, 1)
  // máquina de escrever: corpo, teclas, rolo e a folha saindo em cima
  r(g, c, x + 9, y + 3, 16, 9)
  r(g, '#4a5063', x + 10, y + 4, 14, 7)
  r(g, '#2f3442', x + 10, y + 9, 14, 2)
  for (let k = 0; k < 5; k++) r(g, '#d9dde6', x + 11 + k * 2.5, y + 8, 1, 1)
  r(g, c, x + 8, y + 2, 18, 2)
  r(g, '#5a6070', x + 9, y + 2, 16, 1)
  r(g, c, x + 12, y - 6, 10, 9)
  r(g, '#ffffff', x + 13, y - 5, 8, 7)
  r(g, '#d9dde6', x + 14, y - 3, 6, 1)
  r(g, '#d9dde6', x + 14, y - 1, 4, 1)
  // pilha de folhas à esquerda e copo de lápis à direita
  r(g, c, x + 1, y + 6, 8, 5)
  r(g, '#f4efe4', x + 2, y + 7, 6, 3)
  r(g, '#d9dde6', x + 2, y + 8, 6, 1)
  r(g, c, x + 27, y + 4, 6, 7)
  r(g, '#3d77b0', x + 28, y + 5, 4, 5)
  r(g, '#f2b233', x + 28, y + 1, 1, 4)
  r(g, '#e05a4f', x + 30, y + 2, 1, 3)
  r(g, c, x + 28, y, 1, 1)
  r(g, c, x + 30, y + 1, 1, 1)
}

/** Celular num suporte: a tela mostra o degradê e o ícone do Instagram quando conectado, cinza quando não. */
/** desligado: sem conta; ok: nas cores do Instagram; atencao: amarelo, o token vence logo ou a renovação falhou */
export type EstadoInstagram = 'desligado' | 'ok' | 'atencao'

export function celularInstagram(g: Ctx, x: number, y: number, estado: EstadoInstagram) {
  const conectado = estado !== 'desligado'
  const c = '#1f2330'
  r(g, 'rgba(0,0,0,.15)', x + 2, y + 32, 16, 2)
  // suporte
  r(g, c, x + 3, y + 29, 14, 4)
  r(g, '#5a6070', x + 4, y + 30, 12, 2)
  r(g, c, x + 8, y + 26, 4, 4)
  // corpo do celular
  r(g, c, x + 2, y, 16, 28)
  r(g, '#2a2d36', x + 3, y + 1, 14, 26)
  r(g, c, x + 8, y + 1, 4, 1)
  // tela: degradê do Instagram em faixas diagonais, ou cinza
  const faixas =
    estado === 'atencao' ? ['#fff1a8', '#ffe57a', '#ffd84d', '#f7c824', '#ecb80c', '#dca600'] : conectado ? ['#f9ce34', '#fd8d32', '#fa5c48', '#ee2a7b', '#b02ba5', '#6228d7'] : ['#c2c6d0', '#b6bac6', '#aab0bd', '#9ea4b3', '#949aa9', '#8a909f']
  for (let i = 0; i < 24; i++) {
    for (let j = 0; j < 12; j++) {
      const k = Math.min(faixas.length - 1, Math.floor((i + j) / 6))
      r(g, faixas[k], x + 4 + j, y + 2 + i, 1, 1)
    }
  }
  // ícone: quadrado arredondado com a lente no meio e o pontinho do flash
  const traco = estado === 'atencao' ? '#5a4300' : conectado ? '#ffffff' : '#f0f2f6'
  r(g, traco, x + 6, y + 9, 8, 1)
  r(g, traco, x + 6, y + 16, 8, 1)
  r(g, traco, x + 5, y + 10, 1, 6)
  r(g, traco, x + 14, y + 10, 1, 6)
  r(g, traco, x + 8, y + 12, 4, 1)
  r(g, traco, x + 8, y + 13, 4, 1)
  r(g, traco, x + 9, y + 11, 2, 1)
  r(g, traco, x + 9, y + 14, 2, 1)
  r(g, faixas[2], x + 9, y + 12, 2, 2)
  r(g, traco, x + 12, y + 10, 1, 1)
  // botão de casa
  r(g, '#5a6070', x + 8, y + 27, 4, 1)
}

/** Porquinho cor-de-rosa num banquinho, com uma moeda entrando. */
export function cofrinho(g: Ctx, x: number, y: number) {
  const contorno = '#1f2330'
  const rosa = '#f2a6b8'
  const sombra = '#d9849a'
  r(g, 'rgba(0,0,0,.15)', x + 2, y + 20, 22, 2)
  // banquinho
  r(g, contorno, x + 3, y + 15, 18, 3)
  r(g, '#8a6a4a', x + 4, y + 16, 16, 1)
  r(g, contorno, x + 5, y + 18, 2, 3)
  r(g, contorno, x + 17, y + 18, 2, 3)
  // corpo
  r(g, contorno, x + 3, y + 5, 16, 10)
  r(g, contorno, x + 2, y + 6, 18, 8)
  r(g, rosa, x + 4, y + 6, 14, 8)
  r(g, rosa, x + 3, y + 7, 16, 6)
  r(g, sombra, x + 4, y + 12, 14, 2)
  r(g, '#f8c6d2', x + 6, y + 7, 4, 1)
  // orelha, focinho, olho, rabinho e patas
  r(g, contorno, x + 13, y + 3, 4, 3)
  r(g, sombra, x + 14, y + 4, 2, 2)
  r(g, contorno, x + 19, y + 8, 3, 5)
  r(g, sombra, x + 19, y + 9, 2, 3)
  r(g, contorno, x + 20, y + 10, 1, 1)
  r(g, contorno, x + 15, y + 8, 1, 1)
  r(g, contorno, x + 1, y + 7, 2, 1)
  r(g, contorno, x, y + 6, 1, 1)
  r(g, contorno, x + 5, y + 14, 3, 1)
  r(g, contorno, x + 14, y + 14, 3, 1)
  // fenda e moeda
  r(g, contorno, x + 8, y + 5, 5, 1)
  r(g, contorno, x + 8, y - 1, 5, 5)
  r(g, '#f2b233', x + 9, y, 3, 4)
  r(g, '#fff3b0', x + 9, y, 1, 2)
}

/** Mesa com monitor (a tela é redesenhada a cada quadro por cima). */
export function mesa(g: Ctx, e: Estilo, x: number, y: number) {
  r(g, 'rgba(0,0,0,.15)', x + 2, y + 14, MESA_W, 3)
  r(g, '#1f2330', x - 1, y - 1, MESA_W + 2, 16)
  r(g, e.mesa, x, y, MESA_W, 11)
  r(g, e.mesaSombra, x, y + 11, MESA_W, 3)
  // monitor
  r(g, '#1f2330', x + 7, y - 9, 16, 12)
  r(g, '#2a2d36', x + 8, y - 8, 14, 9)
  r(g, '#1f2330', x + 14, y + 3, 2, 2)
  // teclado e caneca
  r(g, '#d9dde6', x + 9, y + 6, 12, 3)
  r(g, '#b74e45', x + 24, y + 4, 3, 4)
}

export function cadeira(g: Ctx, e: Estilo, x: number, y: number) {
  r(g, '#1f2330', x - 1, y - 1, 14, 10)
  r(g, e.cadeira, x, y, 12, 8)
}

/** Pisos de cada parte da sala, tirados das cores do estilo e da marca. */
/** Cor e desenho do piso de cada área: o padrão do estilo, ou o que o dono escolheu. */
export function pisos(e: Estilo): Record<AreaSala, { estilo: Estilo; padrao: Piso }> {
  const v = (piso: string, pisoLinha: string) => ({ ...e, piso, pisoLinha })
  const padrao: Record<AreaSala, { estilo: Estilo; padrao: Piso }> = {
    pauta: { estilo: e, padrao: e.tijolo ? 'concreto' : 'tabua' },
    criacao: { estilo: v(misturar(e.piso, e.tapete, 0.55), misturar(e.piso, e.rodape, 0.35)), padrao: 'xadrez' },
    publicacao: { estilo: v(misturar(e.tapete, e.piso, 0.35), misturar(e.tapete, '#1f2330', 0.25)), padrao: 'carpete' },
    hall: { estilo: v(misturar(e.piso, '#ffffff', 0.25), misturar(e.pisoLinha, '#1f2330', 0.1)), padrao: 'ladrilho' },
  }
  for (const area of Object.keys(padrao) as AreaSala[]) {
    const c = e.pisos?.[area]
    if (!c) continue
    if (corValida(c.cor)) padrao[area].estilo = v(c.cor, escurecer(c.cor, 0.14))
    if (c.padrao && PISOS.some((p) => p.id === c.padrao)) padrao[area].padrao = c.padrao
  }
  return padrao
}

export function divisoria(g: Ctx, e: Estilo, x: number, y: number, w: number, h: number) {
  r(g, '#1f2330', x, y, w, h)
  if (w > h) r(g, e.paredeDetalhe, x, y + 1, w, h - 3)
  else r(g, e.paredeDetalhe, x + 1, y, w - 2, h)
}

/** Quadro de branding: logo em bloco na cor da marca, paleta e uma amostra de letra. */
export function quadroBranding(g: Ctx, e: Estilo, x: number, y: number, w: number, h: number) {
  r(g, '#1f2330', x - 1, y - 1, w + 2, h + 2)
  r(g, '#ffffff', x, y, w, h)
  r(g, e.rodape, x + 3, y + 3, 14, 14)
  r(g, '#ffffff', x + 6, y + 7, 8, 2)
  r(g, '#ffffff', x + 6, y + 11, 5, 2)
  const paleta = [e.rodape, misturar(e.rodape, '#ffffff', 0.5), misturar(e.rodape, '#1f2330', 0.45), e.tapete]
  paleta.forEach((c, i) => r(g, c, x + 19 + i * 4, y + 4, 3, 5))
  // "Aa" em pixel
  r(g, '#1f2330', x + 21, y + 12, 2, 6)
  r(g, '#1f2330', x + 25, y + 12, 2, 6)
  r(g, '#1f2330', x + 23, y + 11, 2, 2)
  r(g, '#1f2330', x + 23, y + 14, 2, 1)
  r(g, '#1f2330', x + 30, y + 14, 4, 4)
  r(g, '#ffffff', x + 31, y + 15, 2, 2)
  r(g, '#1f2330', x + 34, y + 14, 1, 4)
  r(g, '#d9dde6', x + 3, y + 20, w - 6, 2)
  r(g, '#d9dde6', x + 3, y + 23, w - 16, 1)
}

/** Painel de referências: fotos presas num quadro, uma por referência da marca (até caber). */
export function quadroReferencias(g: Ctx, e: Estilo, x: number, y: number, w: number, h: number, refs: number) {
  r(g, '#1f2330', x - 1, y - 1, w + 2, h + 2)
  r(g, '#eef0f4', x, y, w, h)
  r(g, e.rodape, x, y, w, 2)
  const n = Math.min(refs, 6)
  const tons = [e.rodape, misturar(e.rodape, '#ffffff', 0.45), e.tapete, '#52738a', '#976822', misturar(e.rodape, '#1f2330', 0.4)]
  for (let i = 0; i < Math.max(n, 2); i++) {
    const fx = x + 2 + (i % 3) * 11.5
    const fy = y + 4 + Math.floor(i / 3) * 11
    const vazia = i >= n
    r(g, 'rgba(0,0,0,.18)', fx + 1, fy + 1, 10, 9)
    r(g, '#ffffff', fx, fy, 10, 9)
    if (vazia) {
      r(g, '#d9dde6', fx + 2, fy + 2, 7, 5)
      r(g, '#ffffff', fx + 5, fy + 3, 1, 3)
      r(g, '#ffffff', fx + 4, fy + 4, 3, 1)
    } else {
      r(g, tons[i % tons.length], fx + 1, fy + 1, 9, 6)
      r(g, 'rgba(255,255,255,.55)', fx + 2, fy + 5, 3, 2)
      r(g, '#e05a4f', fx + 5, fy - 1, 2, 2)
    }
  }
}

/** Mural de regras: cortiça com um bilhete por regra ativa (até caber). */
export function quadroRegras(g: Ctx, x: number, y: number, w: number, h: number, regras: number) {
  r(g, '#1f2330', x - 1, y - 1, w + 2, h + 2)
  r(g, '#b98a5a', x, y, w, h)
  for (let i = 0; i < 18; i++) r(g, '#a77a4c', x + ((i * 7) % (w - 2)) + 1, y + ((i * 5) % (h - 2)) + 1, 2, 1)
  const notas = ['#fff3b0', '#ffd6a5', '#cdeac0', '#bde0fe', '#ffc8dd']
  const n = Math.min(regras, 8)
  for (let i = 0; i < n; i++) {
    const nx = x + 3 + (i % 4) * 8
    const ny = y + 3 + Math.floor(i / 4) * 11
    r(g, notas[i % notas.length], nx, ny, 6, 9)
    r(g, '#e05a4f', nx + 2, ny, 2, 1)
    r(g, 'rgba(0,0,0,.25)', nx + 1, ny + 3, 4, 1)
    r(g, 'rgba(0,0,0,.25)', nx + 1, ny + 5, 3, 1)
  }
  if (!n) {
    r(g, '#ffffff', x + 10, y + 8, 16, 10)
    r(g, '#d9dde6', x + 12, y + 11, 12, 1)
    r(g, '#d9dde6', x + 12, y + 14, 8, 1)
  }
}

/** Mesinha redonda com notebook (canto livre da Revisão e publicação). */
export function mesinha(g: Ctx, e: Estilo, x: number, y: number) {
  r(g, 'rgba(0,0,0,.15)', x + 2, y + 12, 26, 3)
  r(g, '#1f2330', x - 1, y - 1, 28, 14)
  r(g, e.mesa, x, y, 26, 10)
  r(g, e.mesaSombra, x, y + 10, 26, 2)
  r(g, '#2a2d36', x + 8, y + 2, 10, 6)
  r(g, '#9fb3d6', x + 9, y + 3, 8, 3)
  r(g, '#f2b233', x + 2, y + 3, 4, 5)
}

/** A sala da equipe (sem os bonecos): Pauta, Criação e Publicação em cima, hall com café embaixo. */
