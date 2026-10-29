// Catálogo de IAs que você escolhe por post no Novo post. As chaves são as mesmas de api/_lib/ias.ts.

export type Servico = 'claude' | 'openrouter' | 'kling' | 'fal' | 'elevenlabs'
export type Servicos = Partial<Record<Servico, boolean>>

export interface OpcaoIA {
  id: string
  nome: string
  desc: string
  servico: Servico
}

export const MODELOS_TEXTO: OpcaoIA[] = [
  { id: 'claude-opus-5-5', nome: 'Claude Opus', desc: 'O melhor texto, o mais caro', servico: 'claude' },
  { id: 'claude-sonnet-5-5', nome: 'Claude Sonnet', desc: 'Equilíbrio entre qualidade e custo', servico: 'claude' },
  { id: 'claude-haiku-5-5', nome: 'Claude Haiku', desc: 'Rápido e barato', servico: 'claude' },
  { id: 'openai/gpt-6.1-terra', nome: 'GPT 6.1', desc: 'OpenAI, pelo OpenRouter', servico: 'openrouter' },
  { id: 'google/gemini-4-argon', nome: 'Gemini 4', desc: 'Google, pelo OpenRouter', servico: 'openrouter' },
  { id: 'deepseek/deepseek-v4.1-flash-1017', nome: 'DeepSeek', desc: 'Bem barato, pelo OpenRouter', servico: 'openrouter' },
]

export const MOTORES_VIDEO: OpcaoIA[] = [
  { id: 'kling', nome: 'Kling 2.5', desc: 'Direto na Kling · US$ 0,35 a cada 5 s', servico: 'kling' },
  { id: 'claude', nome: 'Claude', desc: 'Animação com texto, gravada no app · só custo de texto', servico: 'claude' },
  { id: 'fal-kling', nome: 'Kling 3.0', desc: 'Pelo fal.ai · US$ 0,42 a cada 5 s', servico: 'fal' },
  { id: 'fal-hailuo', nome: 'Hailuo 02', desc: 'Pelo fal.ai · US$ 0,27 a cada 6 s', servico: 'fal' },
  { id: 'fal-seedance', nome: 'Seedance 2.0', desc: 'Pelo fal.ai · 720p', servico: 'fal' },
]

/** Imagens que o designer gera para dentro do post (pelo fal.ai), ou nenhuma: só as fotos aprovadas da marca. */
export const MODELOS_IMAGEM: OpcaoIA[] = [
  { id: 'seedream', nome: 'Seedream 4', desc: 'Pelo fal.ai · US$ 0,03 por imagem, até 3 por post', servico: 'fal' },
  { id: 'nano-banana', nome: 'Nano Banana', desc: 'Pelo fal.ai · US$ 0,04 por imagem, mantém bem o produto da referência', servico: 'fal' },
  { id: 'nano-banana-pro', nome: 'Nano Banana Pro', desc: 'Pelo fal.ai · US$ 0,15 por imagem, a melhor qualidade', servico: 'fal' },
  { id: 'nenhuma', nome: 'Sem imagem gerada', desc: 'O designer usa só as fotos aprovadas da marca', servico: 'claude' },
]

/** O narrador escreve com um modelo de texto, ou o Reel vai sem narração. */
export const OPCOES_NARRADOR: OpcaoIA[] = [...MODELOS_TEXTO, { id: 'nenhum', nome: 'Sem narração', desc: 'O Reel vai só com o vídeo', servico: 'claude' }]

/** Funcionários que dá para trocar de IA, e o que usam se você não escolher. */
export const FUNCIONARIOS_IA: { agente: string; nome: string; padrao: string; video?: boolean }[] = [
  { agente: 'chefe', nome: 'Chefe de pauta', padrao: 'claude-sonnet-5-5' },
  { agente: 'pesquisador', nome: 'Pesquisador', padrao: 'claude-sonnet-5-5' },
  { agente: 'redator', nome: 'Redator', padrao: 'claude-opus-5-5' },
  { agente: 'designer', nome: 'Designer', padrao: 'claude-sonnet-5-5' },
  { agente: 'imagens', nome: 'Imagens do designer', padrao: 'seedream' },
  { agente: 'cinegrafista', nome: 'Cinegrafista', padrao: 'kling', video: true },
  { agente: 'narrador', nome: 'Narrador', padrao: 'claude-sonnet-5-5', video: true },
  { agente: 'revisor', nome: 'Revisor', padrao: 'claude-sonnet-5-5' },
]

export const CHAVE_DO_SERVICO: Record<Servico, string> = {
  claude: 'ANTHROPIC_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  kling: 'KLING_API_KEY',
  fal: 'FAL_KEY',
  elevenlabs: 'ELEVENLABS_API_KEY',
}

/** Motor de vídeo padrão conforme as chaves configuradas (mesma regra de api/_lib/ias.ts). */
export function motorPadrao(servicos: Servicos | null | undefined) {
  return servicos?.fal ? 'fal-kling' : servicos?.kling ? 'kling' : 'claude'
}

/** O padrão de cada funcionário; o do cinegrafista depende de qual serviço de vídeo tem chave. */
export function padraoDe(f: { agente: string; padrao: string }, servicos: Servicos | null | undefined) {
  if (f.agente === 'imagens') return servicos?.fal ? 'seedream' : 'nenhuma'
  return f.agente === 'cinegrafista' ? motorPadrao(servicos) : f.padrao
}

export function opcoesDe(agente: string) {
  return agente === 'imagens' ? MODELOS_IMAGEM : agente === 'cinegrafista' ? MOTORES_VIDEO : agente === 'narrador' ? OPCOES_NARRADOR : MODELOS_TEXTO
}

export function nomeDaIA(id: string) {
  return [...OPCOES_NARRADOR, ...MOTORES_VIDEO, ...MODELOS_IMAGEM].find((o) => o.id === id)?.nome ?? id
}
