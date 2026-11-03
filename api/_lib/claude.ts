import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'
import type { ModeloTexto } from './ias.js'
import { anotarGasto } from './gastos.js'
import { gerarJsonOR, gerarTextoOR } from './openrouter.js'

export const claude = new Anthropic()

export const LINK_CREDITOS_ANTHROPIC = 'https://console.anthropic.com/settings/billing'

/** Erro da API da Anthropic em português, quando dá para dizer o que fazer; os outros passam como vieram. */
export function erroClaro(e: unknown): unknown {
  const msg = e instanceof Error ? e.message : String(e)
  if (/credit balance is too low|purchase credits/i.test(msg))
    return new Error(`Anthropic: sem créditos na conta. Recarregue em ${LINK_CREDITOS_ANTHROPIC} e tente de novo. (${msg.slice(0, 160)})`)
  return e
}

export type Modelo = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5'
const eClaude = (m: ModeloTexto): m is Modelo => m.startsWith('claude-')

// Preços oficiais da API da Anthropic, em US$ por milhão de tokens: entrada, saída e leitura do cache.
// A leitura do cache não é a mesma fração em todos: no Opus 5.5 custa US$ 0,20 (5% da entrada), no Sonnet 5.5 US$ 0,20 (10%).
// O Haiku 5.5 tem preço maior quando o prompt passa de 100 mil tokens.
const PRECO: Record<Modelo, { entrada: number; saida: number; lerCache: number; longo?: { acima: number; entrada: number; saida: number } }> = {
  'claude-opus-5-5': { entrada: 4, saida: 20, lerCache: 0.2 },
  'claude-sonnet-5-5': { entrada: 2, saida: 10, lerCache: 0.2 },
  'claude-haiku-5-5': { entrada: 0.1, saida: 0.5, lerCache: 0.01, longo: { acima: 100_000, entrada: 0.5, saida: 2.5 } },
}
const PRECO_BUSCA_WEB = 10 / 1000

export interface Uso {
  tokens_entrada: number
  tokens_saida: number
  custo_usd: number
}

// prompt caching (cache de 5 minutos): gravar no cache custa 1,25× a entrada; ler tem preço próprio por modelo
const FATOR_GRAVAR_CACHE = 1.25

/** Custo de uma resposta da API, pelos tokens que ela diz ter usado. */
export function custoDaResposta(modelo: Modelo, u: Anthropic.Usage): Uso {
  const gravados = u.cache_creation_input_tokens ?? 0
  const lidos = u.cache_read_input_tokens ?? 0
  const entrada = u.input_tokens + gravados + lidos
  const p = PRECO[modelo]
  const longo = p.longo && entrada > p.longo.acima ? p.longo : null
  const pe = longo?.entrada ?? p.entrada
  const ps = longo?.saida ?? p.saida
  const pl = longo ? p.lerCache * (longo.entrada / p.entrada) : p.lerCache
  const buscas = u.server_tool_use?.web_search_requests ?? 0
  return {
    tokens_entrada: entrada,
    tokens_saida: u.output_tokens,
    custo_usd: (u.input_tokens * pe + gravados * pe * FATOR_GRAVAR_CACHE + lidos * pl + u.output_tokens * ps) / 1e6 + buscas * PRECO_BUSCA_WEB,
  }
}

/** Soma uma resposta ao acumulado e anota no medidor de gastos (que pega também as tentativas que falharam depois). */
export function somarUso(modelo: Modelo, u: Anthropic.Usage, acc: Uso = { tokens_entrada: 0, tokens_saida: 0, custo_usd: 0 }): Uso {
  const deste = custoDaResposta(modelo, u)
  anotarGasto(modelo, deste)
  return {
    tokens_entrada: acc.tokens_entrada + deste.tokens_entrada,
    tokens_saida: acc.tokens_saida + deste.tokens_saida,
    custo_usd: acc.custo_usd + deste.custo_usd,
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
}): Promise<{ texto: string; uso: Uso; buscas?: { feitas: number; erros: string[] } }> {
  const modelo = opts.modelo
  if (!eClaude(modelo)) return gerarTextoOR({ ...opts, modelo })
  try {
    return await gerarTextoClaude({ ...opts, modelo })
  } catch (e) {
    throw erroClaro(e)
  }
}

async function gerarTextoClaude(opts: Parameters<typeof gerarTexto>[0] & { modelo: Modelo }) {
  const modelo = opts.modelo
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: opts.conteudo }]
  const tools = opts.buscaWeb ? [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: opts.buscaWeb }] : undefined
  let uso: Uso | undefined
  let texto = ''
  const buscas = { feitas: 0, erros: [] as string[] }

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
        if (input?.query) await opts.aoBuscar?.(input.query)
      }
    }
    const final = await stream.finalMessage()
    uso = somarUso(modelo, final.usage, uso)
    checarRecusa(final)
    // busca que voltou com erro (limite de usos, serviço fora) fica registrada para quem chamou decidir o que fazer
    for (const b of final.content as { type: string; content?: unknown }[]) {
      if (b.type !== 'web_search_tool_result') continue
      const c = b.content as { type?: string; error_code?: string } | unknown[]
      if (Array.isArray(c)) buscas.feitas++
      else if (c?.error_code) buscas.erros.push(c.error_code)
    }
    if (final.stop_reason !== 'pause_turn') break
    messages.push({ role: 'assistant', content: final.content })
  }
  return { texto, uso: uso!, buscas }
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
  try {
    return await gerarJsonClaude({ ...opts, modelo })
  } catch (e) {
    throw erroClaro(e)
  }
}

async function gerarJsonClaude<S extends z.ZodType>(opts: Parameters<typeof gerarJson<S>>[0] & { modelo: Modelo }): Promise<{ dados: z.infer<S>; uso: Uso }> {
  const modelo = opts.modelo
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
