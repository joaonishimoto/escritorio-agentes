import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'

export const claude = new Anthropic()

export type Modelo = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5'

// US$ por milhão de tokens (entrada, saída)
const PRECO: Record<Modelo, [number, number]> = {
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
}
const PRECO_BUSCA_WEB = 10 / 1000

export interface Uso {
  tokens_entrada: number
  tokens_saida: number
  custo_usd: number
}

export function somarUso(modelo: Modelo, u: Anthropic.Usage, acc: Uso = { tokens_entrada: 0, tokens_saida: 0, custo_usd: 0 }): Uso {
  const entrada = u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)
  const [pe, ps] = PRECO[modelo]
  const buscas = u.server_tool_use?.web_search_requests ?? 0
  return {
    tokens_entrada: acc.tokens_entrada + entrada,
    tokens_saida: acc.tokens_saida + u.output_tokens,
    custo_usd: acc.custo_usd + (entrada * pe + u.output_tokens * ps) / 1e6 + buscas * PRECO_BUSCA_WEB,
  }
}

export type Conteudo = string | Anthropic.ContentBlockParam[]

function checarRecusa(m: Anthropic.Message) {
  if (m.stop_reason === 'refusal') {
    throw new Error(`O modelo recusou a tarefa${m.stop_details?.explanation ? `: ${m.stop_details.explanation}` : ''}`)
  }
}

/**
 * Gera texto em streaming, repassando cada trecho para `aoEscrever`
 * (é o que aparece no painel do agente). Suporta busca na web.
 */
export async function gerarTexto(opts: {
  modelo: Modelo
  sistema: string
  conteudo: Conteudo
  buscaWeb?: number
  effort?: 'low' | 'medium' | 'high'
  aoEscrever?: (trecho: string) => Promise<void> | void
  aoBuscar?: (consulta: string) => Promise<void> | void
}): Promise<{ texto: string; uso: Uso }> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: opts.conteudo }]
  const tools = opts.buscaWeb ? [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: opts.buscaWeb }] : undefined
  let uso: Uso | undefined
  let texto = ''

  // pause_turn: o servidor pausou um turno longo de busca; reenviamos para continuar
  for (let rodada = 0; rodada < 4; rodada++) {
    const stream = claude.messages.stream({
      model: opts.modelo,
      max_tokens: 32000,
      system: opts.sistema,
      output_config: { effort: opts.effort ?? 'medium' },
      tools,
      messages,
    })
    for await (const ev of stream) {
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
        texto += ev.delta.text
        await opts.aoEscrever?.(ev.delta.text)
      } else if (ev.type === 'content_block_start' && ev.content_block.type === 'server_tool_use') {
        const input = ev.content_block.input as { query?: string } | undefined
        await opts.aoBuscar?.(input?.query ?? 'buscando na web')
      }
    }
    const final = await stream.finalMessage()
    uso = somarUso(opts.modelo, final.usage, uso)
    checarRecusa(final)
    if (final.stop_reason !== 'pause_turn') break
    messages.push({ role: 'assistant', content: final.content })
  }
  return { texto, uso: uso! }
}

/** Gera uma resposta estruturada validada pelo schema (zod). */
export async function gerarJson<S extends z.ZodType>(opts: {
  modelo: Modelo
  sistema: string
  conteudo: Conteudo
  schema: S
  effort?: 'low' | 'medium' | 'high'
}): Promise<{ dados: z.infer<S>; uso: Uso }> {
  const stream = claude.messages.stream({
    model: opts.modelo,
    max_tokens: 32000,
    system: opts.sistema,
    output_config: { effort: opts.effort ?? 'medium', format: zodOutputFormat(opts.schema) },
    messages: [{ role: 'user', content: opts.conteudo }],
  })
  const final = await stream.finalMessage()
  checarRecusa(final)
  const bloco = final.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  if (!bloco) throw new Error('Resposta sem texto')
  const dados = opts.schema.parse(JSON.parse(bloco.text))
  return { dados, uso: somarUso(opts.modelo, final.usage) }
}
