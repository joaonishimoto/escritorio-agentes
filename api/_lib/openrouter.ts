import type Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { Conteudo, Uso } from './claude.js'

// Modelos que não são do Claude (GPT, Gemini, DeepSeek) passam pelo OpenRouter, com uma chave só: OPENROUTER_API_KEY na Vercel.
const URL_CHAT = 'https://openrouter.ai/api/v1/chat/completions'

type Parte = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
interface UsoOR {
  prompt_tokens?: number
  completion_tokens?: number
  cost?: number
}

/** Os blocos do formato da Anthropic viram partes do formato do OpenAI (texto e imagem por URL). */
function converter(conteudo: Conteudo): string | Parte[] {
  if (typeof conteudo === 'string') return conteudo
  return conteudo.flatMap((b: Anthropic.ContentBlockParam): Parte[] => {
    if (b.type === 'text') return [{ type: 'text', text: b.text }]
    if (b.type === 'image' && b.source.type === 'url') return [{ type: 'image_url', image_url: { url: b.source.url } }]
    if (b.type === 'image' && b.source.type === 'base64') return [{ type: 'image_url', image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } }]
    return []
  })
}

function uso(u: UsoOR | undefined): Uso {
  return { tokens_entrada: u?.prompt_tokens ?? 0, tokens_saida: u?.completion_tokens ?? 0, custo_usd: u?.cost ?? 0 }
}

async function chamar(corpo: Record<string, unknown>) {
  const chave = process.env.OPENROUTER_API_KEY
  if (!chave) throw new Error('Falta configurar OPENROUTER_API_KEY na Vercel para usar GPT, Gemini ou DeepSeek')
  const r = await fetch(URL_CHAT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json', 'X-OpenRouter-Title': 'Escritório de agentes' },
    body: JSON.stringify(corpo),
  })
  if (!r.ok) {
    const json = (await r.json().catch(() => null)) as { error?: { message?: string } } | null
    const msg = json?.error?.message ?? `HTTP ${r.status}`
    if (r.status === 401) throw new Error(`OpenRouter recusou a chave. Confira OPENROUTER_API_KEY na Vercel. (${msg})`)
    if (r.status === 402) throw new Error(`OpenRouter: sem créditos na conta. (${msg})`)
    throw new Error(`OpenRouter (${corpo.model}): ${msg}`)
  }
  return r
}

export async function gerarTextoOR(opts: {
  modelo: string
  sistema: string
  conteudo: Conteudo
  buscaWeb?: number
  aoEscrever?: (trecho: string) => Promise<void> | void
  aoBuscar?: (consulta: string) => Promise<void> | void
}): Promise<{ texto: string; uso: Uso }> {
  if (opts.buscaWeb) await opts.aoBuscar?.('buscando na web')
  const r = await chamar({
    model: opts.modelo,
    stream: true,
    max_tokens: 32000,
    messages: [
      { role: 'system', content: opts.sistema },
      { role: 'user', content: converter(opts.conteudo) },
    ],
    ...(opts.buscaWeb ? { plugins: [{ id: 'web', max_results: Math.min(10, opts.buscaWeb * 2) }] } : {}),
  })
  let texto = ''
  let u: UsoOR | undefined
  const leitor = r.body!.pipeThrough(new TextDecoderStream()).getReader()
  let resto = ''
  for (;;) {
    const { value, done } = await leitor.read()
    if (done) break
    resto += value
    const linhas = resto.split('\n')
    resto = linhas.pop() ?? ''
    for (const linha of linhas) {
      if (!linha.startsWith('data: ') || linha === 'data: [DONE]') continue
      const ev = JSON.parse(linha.slice(6)) as { error?: { message?: string }; usage?: UsoOR; choices?: { delta?: { content?: string } }[] }
      if (ev.error) throw new Error(`OpenRouter (${opts.modelo}): ${ev.error.message ?? 'erro no meio da resposta'}`)
      if (ev.usage) u = ev.usage
      const trecho = ev.choices?.[0]?.delta?.content
      if (trecho) {
        texto += trecho
        await opts.aoEscrever?.(trecho)
      }
    }
  }
  return { texto, uso: uso(u) }
}

export async function gerarJsonOR<S extends z.ZodType>(opts: { modelo: string; sistema: string; conteudo: Conteudo; schema: S }): Promise<{ dados: z.infer<S>; uso: Uso }> {
  const schema = z.toJSONSchema(opts.schema) as Record<string, unknown>
  delete schema.$schema
  const r = await chamar({
    model: opts.modelo,
    max_tokens: 32000,
    messages: [
      { role: 'system', content: opts.sistema },
      { role: 'user', content: converter(opts.conteudo) },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'resposta', strict: true, schema } },
    provider: { require_parameters: true },
  })
  const json = (await r.json()) as { usage?: UsoOR; choices?: { message?: { content?: string; refusal?: string } }[] }
  const msg = json.choices?.[0]?.message
  if (msg?.refusal) throw new Error(`O modelo recusou a tarefa: ${msg.refusal}`)
  if (!msg?.content) throw new Error(`OpenRouter (${opts.modelo}) respondeu sem texto`)
  const dados = opts.schema.parse(JSON.parse(msg.content.replace(/^```(?:json)?\s*|\s*```$/g, '')))
  return { dados, uso: uso(json.usage) }
}
