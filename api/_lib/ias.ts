import type { Contexto } from './contexto.js'

// Qual IA cada funcionário usa, escolhida por post no Novo post (preferencias.ias). As chaves são as mesmas de src/lib/ias.ts.

/** Modelos de texto: os do Claude vão direto na Anthropic; os outros passam pelo OpenRouter (OPENROUTER_API_KEY). */
export const MODELOS_TEXTO = [
  'claude-opus-5-5',
  'claude-sonnet-5-5',
  'claude-haiku-5-5',
  'openai/gpt-6.1-terra',
  'google/gemini-4-argon',
  'deepseek/deepseek-v4.1-flash-1017',
] as const
export type ModeloTexto = (typeof MODELOS_TEXTO)[number]

/** Quem gera o vídeo do Reel. */
export const MOTORES_VIDEO = ['kling', 'claude', 'fal-kling', 'fal-hailuo', 'fal-seedance'] as const
export type MotorVideo = (typeof MOTORES_VIDEO)[number]

/** Funcionários que dá para trocar de IA, e o que cada um usa se você não escolher. */
export const PADRAO_TEXTO = {
  chefe: 'claude-sonnet-5-5',
  pesquisador: 'claude-sonnet-5-5',
  redator: 'claude-opus-5-5',
  designer: 'claude-sonnet-5-5',
  revisor: 'claude-sonnet-5-5',
  narrador: 'claude-sonnet-5-5',
} as const satisfies Record<string, ModeloTexto>
export type AgenteDeTexto = keyof typeof PADRAO_TEXTO
export const PADRAO_VIDEO: MotorVideo = 'kling'

export const eModeloTexto = (v: unknown): v is ModeloTexto => MODELOS_TEXTO.includes(v as ModeloTexto)
export const eMotorVideo = (v: unknown): v is MotorVideo => MOTORES_VIDEO.includes(v as MotorVideo)

/** Só fica o que é conhecido: funcionário de texto com modelo de texto, cinegrafista com motor de vídeo, narrador também pode ir sem narração. */
export function limparIas(bruto: unknown): Record<string, string> {
  const ias: Record<string, string> = {}
  if (!bruto || typeof bruto !== 'object') return ias
  for (const [agente, valor] of Object.entries(bruto)) {
    const valido = agente === 'cinegrafista' ? eMotorVideo(valor) : agente in PADRAO_TEXTO && (eModeloTexto(valor) || (agente === 'narrador' && valor === 'nenhum'))
    if (valido) ias[agente] = valor as string
  }
  return ias
}

/** Modelo de texto que o funcionário usa neste post. */
export function modeloDe(ctx: Contexto, agente: AgenteDeTexto): ModeloTexto {
  const escolhido = ctx.post.preferencias?.ias?.[agente]
  return eModeloTexto(escolhido) ? escolhido : PADRAO_TEXTO[agente]
}

/** Motor de vídeo do cinegrafista neste post. */
export function motorDeVideo(ctx: Contexto): MotorVideo {
  const escolhido = ctx.post.preferencias?.ias?.cinegrafista
  return eMotorVideo(escolhido) ? escolhido : PADRAO_VIDEO
}

/** Quais serviços têm chave na Vercel (para o Novo post mostrar o que dá para usar). */
export function servicosDisponiveis() {
  return {
    claude: !!process.env.ANTHROPIC_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    kling: !!process.env.KLING_API_KEY,
    elevenlabs: !!process.env.ELEVENLABS_API_KEY,
    fal: !!process.env.FAL_KEY,
  }
}
