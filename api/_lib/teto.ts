import { db } from './db.js'

// Teto de gasto: por post (a produção para e o post vai para você decidir) e por mês (não começa post novo).
// Fica na identidade da marca, em `teto`, editável na aba Sala do perfil.

/** Teto por post quando a marca não definiu: acima do custo normal de um carrossel com voltas, abaixo de um post em loop. */
export const TETO_POST_PADRAO = 2

export interface Teto {
  /** US$ por post; null = sem teto */
  post: number | null
  /** US$ por mês na marca; null = sem teto */
  mes: number | null
}

const valor = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null)

export function tetoDaMarca(identidade: Record<string, unknown> | null | undefined): Teto {
  const t = (identidade?.teto ?? {}) as { por_post_usd?: unknown; por_mes_usd?: unknown }
  return {
    post: t.por_post_usd === null ? null : (valor(t.por_post_usd) ?? TETO_POST_PADRAO),
    mes: valor(t.por_mes_usd),
  }
}

export function inicioDoMes(agora = new Date()) {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1))
}

/** Quanto a marca já gastou este mês: os posts criados no mês e o que a sala gastou fora deles (ideias, pedidos avulsos, plano). */
export async function gastoDoMes(marcaId: string) {
  const desde = inicioDoMes().toISOString()
  const [{ data }, avulsos] = await Promise.all([
    db.from('posts').select('custo_usd').eq('marca_id', marcaId).gte('criado_em', desde),
    db.from('gastos').select('custo_usd').eq('marca_id', marcaId).gte('criado_em', desde),
  ])
  const soma = (l: { custo_usd: unknown }[] | null) => (l ?? []).reduce((s, p) => s + Number(p.custo_usd ?? 0), 0)
  // banco ainda sem a tabela de gastos: conta só os posts
  return soma(data) + (avulsos.error ? 0 : soma(avulsos.data))
}

/** Agentes cujo trabalho conta para o teto do post: produção e revisão. O publicador e o curador sempre seguem. */
const PRODUCAO = ['chefe', 'pesquisador', 'redator', 'designer', 'criativos', 'cinegrafista', 'narrador', 'revisor']

/**
 * Se o post passou do teto, a produção para aqui. Exceção: o cinegrafista esperando um vídeo que já foi pago
 * continua até buscar o vídeo, senão o dinheiro gasto se perde.
 */
export function passouDoTeto(opts: { agente: string; proximo?: string; custoDoPost: number; teto: Teto }) {
  if (opts.teto.post === null || !opts.proximo) return false
  if (!PRODUCAO.includes(opts.agente) || !PRODUCAO.includes(opts.proximo)) return false
  if (opts.agente === 'cinegrafista' && opts.proximo === 'cinegrafista') return false
  return opts.custoDoPost >= opts.teto.post
}
