import type { Uso } from '../claude.js'
import type { Contexto, Passo } from '../contexto.js'
import type { Emissor } from '../eventos.js'

export interface Resultado {
  saida: Record<string, unknown>
  uso: Uso
  /** mensagem que aparece na entrega para o próximo */
  entrega: string
  /**
   * Quem trabalha em seguida. Se omitido, segue o fluxo do roteiro.
   * `null` encerra a fila (ex.: espera aprovação).
   */
  proximos?: { agente: string; entrada?: Record<string, unknown> }[] | null
  /** para quem a pasta voa no escritório (padrão: o primeiro dos próximos) */
  para?: string
}

export type Agente = (ctx: Contexto, passo: Passo, em: Emissor) => Promise<Resultado>

export const USO_ZERO: Uso = { tokens_entrada: 0, tokens_saida: 0, custo_usd: 0 }

/**
 * Erro num passo que já tinha trabalho pronto (ex.: o HTML dos slides escrito, só o render caiu).
 * `saida` vai para o registro do passo e `entrada` entra na próxima tentativa, para o agente retomar
 * do ponto em que parou em vez de gastar com a IA de novo.
 */
export class ErroRetomavel extends Error {
  constructor(
    causa: unknown,
    public saida: Record<string, unknown> = {},
    public entrada: Record<string, unknown> = {},
  ) {
    super(causa instanceof Error ? causa.message : String(causa))
    this.name = 'ErroRetomavel'
  }
}

/** Texto de feedback vindo do revisor ou de uma correção sua, se houver. */
export function feedback(passo: Passo) {
  const f = passo.entrada.feedback as string | undefined
  return f ? `\n\n## Ajustes pedidos nesta rodada (resolva os que são seus; os marcados com outro agente são só contexto)\n${f}` : ''
}
