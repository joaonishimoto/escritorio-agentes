import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'
import type { ModeloTexto } from './ias.js'
import { gerarJsonOR, gerarTextoOR } from './openrouter.js'

export const claude = new Anthropic()

export type Modelo = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5'
const eClaude = (m: ModeloTexto): m is Modelo => m.startsWith('claude-')

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

// prompt caching: gravar no cache custa 1,25× a entrada; ler do cache custa 0,1×
const FATOR_GRAVAR_CACHE = 1.25
const FATOR_LER_CACHE = 0.1

export function somarUso(modelo: Modelo, u: Anthropic.Usage, acc: Uso = { tokens_entrada: 0, tokens_saida: 0, custo_usd: 0 }): Uso {
  const gravados = u.cache_creation_input_tokens ?? 0
  const lidos = u.cache_read_input_tokens ?? 0
  const entrada = u.input_tokens + gravados + lidos
  const [pe, ps] = PRECO[modelo]
  const buscas = u.server_tool_use?.web_search_requests ?? 0
  const custoEntrada = (u.input_tokens + gravados * FATOR_GRAVAR_CACHE + lidos * FATOR_LER_CACHE) * pe
  return {
    tokens_entrada: acc.tokens_entrada + entrada,
    tokens_saida: acc.tokens_saida + u.output_tokens,
    custo_usd: acc.custo_usd + (custoEntrada + u.output_tokens * ps) / 1e6 + buscas * PRECO_BUSCA_WEB,
  }
}

/**
 * O prompt de sistema (roteiro, identidade, regras, checklist) se repete em todos os passos e voltas do mesmo
 * agente no mesmo post. Marcado para cache, as repetições pagam 10% da entrada. Abaixo do mínimo do modelo
 * (cerca de 1.000 tokens) a API ignora a marca sem erro.
 */
export function sistemaComCache(sistema: string): Anthropic.TextBlockParam[] {
  return [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }]
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
  modelo: ModeloTexto
  sistema: string
  conteudo: Conteudo
  buscaWeb?: number
  effort?: 'low' | 'medium' | 'high'
  aoEscrever?: (trecho: string) => Promise<void> | void
  aoBuscar?: (consulta: string) => Promise<void> | void
}): Promise<{ texto: string; uso: Uso }> {
  const modelo = opts.modelo
  if (!eClaude(modelo)) return gerarTextoOR({ ...opts, modelo })
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: opts.conteudo }]
  const tools = opts.buscaWeb ? [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: opts.buscaWeb }] : undefined
  let uso: Uso | undefined
  let texto = ''

  // pause_turn: o servidor pausou um turno longo de busca; reenviamos para continuar
  for (let rodada = 0; rodada < 4; rodada++) {
    const stream = claude.messages.stream({
      model: modelo,
      max_tokens: 32000,
      system: sistemaComCache(opts.sistema),
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
    uso = somarUso(modelo, final.usage, uso)
    checarRecusa(final)
    if (final.stop_reason !== 'pause_turn') break
    messages.push({ role: 'assistant', content: final.content })
  }
  return { texto, uso: uso! }
}

/** Gera uma resposta estruturada validada pelo schema (zod). */
export async function gerarJson<S extends z.ZodType>(opts: {
  modelo: ModeloTexto
  sistema: string
  conteudo: Conteudo
  schema: S
  effort?: 'low' | 'medium' | 'high'
}): Promise<{ dados: z.infer<S>; uso: Uso }> {
  const modelo = opts.modelo
  if (!eClaude(modelo)) return gerarJsonOR({ ...opts, modelo })
  let uso: Uso | undefined
  // resposta cortada ou fora do schema (raro, mas acontece): pede de novo uma vez antes de desistir
  for (let tentativa = 0; ; tentativa++) {
    const stream = claude.messages.stream({
      model: modelo,
      max_tokens: 32000,
      system: sistemaComCache(opts.sistema),
      output_config: { effort: opts.effort ?? 'medium', format: zodOutputFormat(opts.schema) },
      messages: [{ role: 'user', content: opts.conteudo }],
    })
    const final = await stream.finalMessage()
    uso = somarUso(modelo, final.usage, uso)
    checarRecusa(final)
    try {
      const bloco = final.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
      if (!bloco) throw new Error('Resposta sem texto')
      return { dados: opts.schema.parse(JSON.parse(bloco.text)), uso }
    } catch (e) {
      if (tentativa >= 1) throw new Error(`A resposta do modelo veio fora do formato esperado: ${e instanceof Error ? e.message.slice(0, 200) : e}`)
      console.warn('resposta fora do schema, pedindo de novo', e)
    }
  }
}
