import type { Contexto } from './contexto.js'
import { eMotorImagem, MOTOR_IMAGEM_PADRAO, type MotorImagem } from './imagens.js'

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
  designer: 'claude-opus-5-5',
  criativos: 'claude-opus-5-5',
  revisor: 'claude-opus-5-5',
  narrador: 'claude-sonnet-5-5',
} as const satisfies Record<string, ModeloTexto>
export type AgenteDeTexto = keyof typeof PADRAO_TEXTO

/**
 * Motor de vídeo padrão: a animação do Claude, que só custa texto. Kling, Hailuo e Seedance custam por vídeo
 * (um Reel de 10 s na Kling 3.0 sai uns US$ 0,85, e cada ajuste paga de novo), então só entram por escolha no post.
 * Mesma regra de src/lib/ias.ts.
 */
export function motorPadrao(): MotorVideo {
  return 'claude'
}

export const eModeloTexto = (v: unknown): v is ModeloTexto => MODELOS_TEXTO.includes(v as ModeloTexto)
export const eMotorVideo = (v: unknown): v is MotorVideo => MOTORES_VIDEO.includes(v as MotorVideo)

/** Só fica o que é conhecido: funcionário de texto com modelo de texto, cinegrafista com motor de vídeo, narrador também pode ir sem narração. */
export function limparIas(bruto: unknown): Record<string, string> {
  const ias: Record<string, string> = {}
  if (!bruto || typeof bruto !== 'object') return ias
  for (const [agente, valor] of Object.entries(bruto)) {
    const valido = agente === 'cinegrafista' ? eMotorVideo(valor) : agente === 'imagens' ? eMotorImagem(valor) || valor === 'nenhuma' : agente in PADRAO_TEXTO && (eModeloTexto(valor) || (agente === 'narrador' && valor === 'nenhum'))
    if (valido) ias[agente] = valor as string
  }
  return ias
}

/** Modelo de texto que o funcionário usa neste post. */
export function modeloDe(ctx: Contexto, agente: AgenteDeTexto): ModeloTexto {
  const escolhido = ctx.post.preferencias?.ias?.[agente]
  return eModeloTexto(escolhido) ? escolhido : PADRAO_TEXTO[agente]
}

/**
 * Modelo numa volta (devolução do revisor ou correção sua): se o post não escolheu uma IA para o agente,
 * usa o modelo mais leve indicado, porque a volta só mexe no que foi apontado.
 */
export function modeloNaVolta(ctx: Contexto, agente: AgenteDeTexto, leve: ModeloTexto): ModeloTexto {
  const escolhido = ctx.post.preferencias?.ias?.[agente]
  return eModeloTexto(escolhido) ? escolhido : leve
}

/** Motor de vídeo do cinegrafista neste post. */
export function motorDeVideo(ctx: Contexto): MotorVideo {
  const escolhido = ctx.post.preferencias?.ias?.cinegrafista
  return eMotorVideo(escolhido) ? escolhido : motorPadrao()
}

/** Modelo que gera as imagens do designer neste post; null quando o post vai sem imagem gerada ou falta a FAL_KEY. */
export function motorDeImagem(ctx: Contexto): MotorImagem | null {
  if (!process.env.FAL_KEY) return null
  const escolhido = ctx.post.preferencias?.ias?.imagens
  if (escolhido === 'nenhuma') return null
  return eMotorImagem(escolhido) ? escolhido : MOTOR_IMAGEM_PADRAO
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
