// Voz da narração dos Reels pela ElevenLabs. A chave fica em ELEVENLABS_API_KEY na Vercel.
const BASE = 'https://api.elevenlabs.io/v1'
export const MODELO_VOZ = 'eleven_multilingual_v2'

/** Vozes prontas para escolher no perfil da marca; dá para usar qualquer outra pelo ID da voz. */
export const VOZES_NARRACAO = [
  { id: 'YU8EsJtXFMyKMxYtheDk', nome: 'Mário' },
  { id: 'zNEsdgTUa3ndwKry8Xcq', nome: 'Elvis' },
] as const

export interface ConfigNarracao {
  /** false desliga a narração nos Reels da marca */
  ativa?: boolean
  voz?: string
  velocidade?: number
  estabilidade?: number
}

export const NARRACAO_PADRAO = { ativa: true, voz: VOZES_NARRACAO[0].id, velocidade: 0.95, estabilidade: 0.5 }

/** Configuração da marca (identidade.narracao), com os valores padrão no que faltar ou vier fora da faixa. */
export function configDaMarca(identidade: Record<string, unknown> | undefined) {
  const c = (identidade?.narracao ?? {}) as ConfigNarracao
  const entre = (v: unknown, min: number, max: number, padrao: number) => (typeof v === 'number' && v >= min && v <= max ? v : padrao)
  return {
    ativa: c.ativa !== false,
    voz: typeof c.voz === 'string' && /^[A-Za-z0-9]{10,40}$/.test(c.voz) ? c.voz : NARRACAO_PADRAO.voz,
    velocidade: entre(c.velocidade, 0.7, 1.2, NARRACAO_PADRAO.velocidade),
    estabilidade: entre(c.estabilidade, 0, 1, NARRACAO_PADRAO.estabilidade),
  }
}

/**
 * Erro da ElevenLabs em português, com o que fazer. A chave pode ser recusada por três motivos diferentes:
 * colaram o ID da chave em vez da chave, a chave foi criada sem a permissão de voz, ou ela está errada.
 */
export function explicarErroElevenLabs(status: number, msg: string, detalhe?: string) {
  if (/api key id/i.test(msg)) return 'ElevenLabs: foi colado o ID da chave, não a chave. A chave começa com sk_ e só aparece quando é criada.'
  const permissao = /missing the permission (\w+)/i.exec(msg)?.[1]
  if (permissao) {
    const nome = permissao === 'text_to_speech' ? 'Text to Speech' : permissao
    return `ElevenLabs: a chave não tem a permissão "${nome}". Na ElevenLabs, em Developers → API Keys, edite a chave (ou crie outra) com "${nome}" liberado e troque ELEVENLABS_API_KEY na Vercel.`
  }
  if (detalhe === 'quota_exceeded') return `ElevenLabs: acabaram os créditos do mês. (${msg})`
  if (status === 401) return `ElevenLabs recusou a chave. Confira ELEVENLABS_API_KEY na Vercel. (${msg})`
  return `ElevenLabs: ${msg}`
}

/** Gera o áudio (MP3) da narração. */
export async function gerarVoz(texto: string, cfg: ReturnType<typeof configDaMarca>): Promise<Buffer> {
  const chave = process.env.ELEVENLABS_API_KEY
  if (!chave) throw new Error('Falta configurar ELEVENLABS_API_KEY na Vercel para narrar o Reel')
  const r = await fetch(`${BASE}/text-to-speech/${cfg.voz}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': chave, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: texto,
      model_id: MODELO_VOZ,
      voice_settings: { stability: cfg.estabilidade, similarity_boost: 0.75, speed: cfg.velocidade },
    }),
  })
  if (!r.ok) {
    const json = (await r.json().catch(() => null)) as { detail?: { message?: string; status?: string } | string } | null
    const det = json?.detail
    const msg = typeof det === 'string' ? det : (det?.message ?? `HTTP ${r.status}`)
    if (r.status === 404 && /voice/i.test(msg)) throw new Error(`ElevenLabs não achou a voz ${cfg.voz}. Confira a voz na aba Narração do perfil da marca.`)
    throw new Error(explicarErroElevenLabs(r.status, msg, typeof det === 'object' ? det?.status : undefined))
  }
  return Buffer.from(await r.arrayBuffer())
}
