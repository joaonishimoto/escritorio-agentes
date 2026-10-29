import type { VercelRequest, VercelResponse } from '@vercel/node'
import { claude } from './_lib/claude.js'
import { db, usuarioDaRequisicao } from './_lib/db.js'
import { rota } from './_lib/http.js'
import { AVISAR_COM_DIAS, diasParaVencer, infoDoToken } from './_lib/token-meta.js'
import { MODELO_KLING } from './_lib/kling.js'

// "Testar serviços" no perfil da marca: uma chamada mínima em cada serviço, para descobrir chave errada,
// saldo zerado ou Instagram desconectado antes de gastar um post inteiro.

export interface Resultado {
  id: string
  nome: string
  /** 'ok' funcionou, 'erro' a chave ou o serviço falhou, 'falta' não tem chave, 'incerto' não deu para confirmar */
  estado: 'ok' | 'erro' | 'falta' | 'incerto'
  detalhe: string
}

const TEMPO = 8000
const semChave = (id: string, nome: string, variavel: string): Resultado => ({ id, nome, estado: 'falta', detalhe: `Sem ${variavel} na Vercel` })
const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 160)

async function testarClaude(): Promise<Resultado> {
  const base = { id: 'claude', nome: 'Claude (Anthropic)' }
  if (!process.env.ANTHROPIC_API_KEY) return semChave(base.id, base.nome, 'ANTHROPIC_API_KEY')
  try {
    await claude.models.list({ limit: 1 }, { timeout: TEMPO })
    return { ...base, estado: 'ok', detalhe: 'Chave aceita' }
  } catch (e) {
    return { ...base, estado: 'erro', detalhe: mensagem(e) }
  }
}

async function testarOpenRouter(): Promise<Resultado> {
  const base = { id: 'openrouter', nome: 'OpenRouter (GPT, Gemini, DeepSeek)' }
  const chave = process.env.OPENROUTER_API_KEY
  if (!chave) return semChave(base.id, base.nome, 'OPENROUTER_API_KEY')
  try {
    const r = await fetch('https://openrouter.ai/api/v1/auth/key', { headers: { Authorization: `Bearer ${chave}` }, signal: AbortSignal.timeout(TEMPO) })
    if (r.status === 401 || r.status === 403) return { ...base, estado: 'erro', detalhe: 'Chave recusada' }
    if (!r.ok) return { ...base, estado: 'incerto', detalhe: `HTTP ${r.status}` }
    const { data } = (await r.json()) as { data?: { usage?: number; limit?: number | null; limit_remaining?: number | null } }
    const resto = data?.limit_remaining
    return { ...base, estado: 'ok', detalhe: typeof resto === 'number' ? `Chave aceita · US$ ${resto.toFixed(2)} restantes` : 'Chave aceita' }
  } catch (e) {
    return { ...base, estado: 'erro', detalhe: mensagem(e) }
  }
}

async function testarKling(): Promise<Resultado> {
  const base = { id: 'kling', nome: 'Kling (direto)' }
  const chave = process.env.KLING_API_KEY
  if (!chave) return semChave(base.id, base.nome, 'KLING_API_KEY')
  try {
    const url = `${process.env.KLING_API_BASE ?? 'https://api-singapore.klingai.com'}/text-to-video/${MODELO_KLING}?pageNum=1&pageSize=1`
    const r = await fetch(url, { headers: { Authorization: `Bearer ${chave}` }, signal: AbortSignal.timeout(TEMPO) })
    if (r.status === 401 || r.status === 403) return { ...base, estado: 'erro', detalhe: 'Chave recusada' }
    if (r.ok) return { ...base, estado: 'ok', detalhe: 'Chave aceita · o saldo só aparece ao gerar um vídeo' }
    return { ...base, estado: 'incerto', detalhe: `Chave não recusada, mas a resposta foi HTTP ${r.status}` }
  } catch (e) {
    return { ...base, estado: 'erro', detalhe: mensagem(e) }
  }
}

async function testarFal(): Promise<Resultado> {
  const base = { id: 'fal', nome: 'fal.ai (Kling 3.0, Hailuo, Seedance)' }
  const chave = process.env.FAL_KEY
  if (!chave) return semChave(base.id, base.nome, 'FAL_KEY')
  try {
    // consulta um pedido que não existe: a fal confere a chave antes de procurar o pedido
    const r = await fetch('https://queue.fal.run/fal-ai/kling-video/requests/00000000-0000-0000-0000-000000000000/status', {
      headers: { Authorization: `Key ${chave}` },
      signal: AbortSignal.timeout(TEMPO),
    })
    if (r.status === 401 || r.status === 403) return { ...base, estado: 'erro', detalhe: 'Chave recusada' }
    if (r.ok || r.status === 404 || r.status === 422 || r.status === 400) return { ...base, estado: 'ok', detalhe: 'Chave aceita · cobra por vídeo, sem pacote' }
    return { ...base, estado: 'incerto', detalhe: `Chave não recusada, mas a resposta foi HTTP ${r.status}` }
  } catch (e) {
    return { ...base, estado: 'erro', detalhe: mensagem(e) }
  }
}

async function testarElevenLabs(): Promise<Resultado> {
  const base = { id: 'elevenlabs', nome: 'ElevenLabs (voz)' }
  const chave = process.env.ELEVENLABS_API_KEY
  if (!chave) return semChave(base.id, base.nome, 'ELEVENLABS_API_KEY')
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': chave }, signal: AbortSignal.timeout(TEMPO) })
    if (r.status === 401 || r.status === 403) {
      const json = (await r.json().catch(() => null)) as { detail?: { message?: string } } | null
      const dica = /api key id/i.test(json?.detail?.message ?? '') ? 'Foi colado o ID da chave, não a chave. A chave começa com sk_' : 'Chave recusada'
      return { ...base, estado: 'erro', detalhe: dica }
    }
    if (!r.ok) return { ...base, estado: 'incerto', detalhe: `HTTP ${r.status}` }
    const s = (await r.json()) as { character_count?: number; character_limit?: number }
    const usados = s.character_count ?? 0
    const limite = s.character_limit ?? 0
    return { ...base, estado: 'ok', detalhe: limite ? `Chave aceita · ${(limite - usados).toLocaleString('pt-BR')} de ${limite.toLocaleString('pt-BR')} caracteres restantes no mês` : 'Chave aceita' }
  } catch (e) {
    return { ...base, estado: 'erro', detalhe: mensagem(e) }
  }
}

async function testarInstagram(marca: { id: string; nome: string; instagram_conta_id: string | null; meta_token_secret_id: string | null; identidade: unknown }): Promise<Resultado> {
  const base = { id: `instagram:${marca.id}`, nome: `Instagram da ${marca.nome}` }
  if (!marca.instagram_conta_id || !marca.meta_token_secret_id) return { ...base, estado: 'falta', detalhe: 'Conta não conectada' }
  const { data: token, error } = await db.rpc('ler_token_meta', { p_marca: marca.id })
  if (error || !token) return { ...base, estado: 'erro', detalhe: 'Não consegui ler o token no Vault' }
  try {
    const versao = process.env.INSTAGRAM_API_VERSION ?? 'v23.0'
    const r = await fetch(`https://graph.instagram.com/${versao}/${marca.instagram_conta_id}?fields=username&access_token=${encodeURIComponent(token as string)}`, {
      signal: AbortSignal.timeout(TEMPO),
    })
    const json = (await r.json().catch(() => null)) as { username?: string; error?: { message?: string; code?: number } } | null
    if (!r.ok || json?.error) {
      const msg = json?.error?.message ?? `HTTP ${r.status}`
      return { ...base, estado: 'erro', detalhe: json?.error?.code === 190 ? `Token expirado ou inválido: reconecte pelo celular da sala. (${msg})` : msg.slice(0, 160) }
    }
    const info = infoDoToken(marca.identidade)
    const dias = diasParaVencer(info)
    const conta = `Conectado como @${json?.username ?? '?'}`
    if (info.erro) return { ...base, estado: 'incerto', detalhe: `${conta}, mas a última renovação automática falhou: ${info.erro}` }
    if (dias === null) return { ...base, estado: 'ok', detalhe: `${conta} · sem data de validade: reconecte uma vez para o app passar a renovar sozinho` }
    if (dias <= AVISAR_COM_DIAS) return { ...base, estado: 'incerto', detalhe: `${conta}, mas o token vence em ${dias} dia${dias === 1 ? '' : 's'}` }
    return { ...base, estado: 'ok', detalhe: `${conta} · token ${info.estimado ? 'vence em até' : 'vale mais'} ${dias} dias e renova sozinho` }
  } catch (e) {
    return { ...base, estado: 'erro', detalhe: mensagem(e) }
  }
}

/** GET: testa cada serviço com uma chamada mínima e devolve o estado de cada um. */
export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const usuario = await usuarioDaRequisicao(req.headers.authorization)
  if (!usuario) return res.status(401).json({ erro: 'Faça login de novo' })

  const { data: marcas } = await db.from('marcas').select('id, nome, instagram_conta_id, meta_token_secret_id, identidade').eq('dono_id', usuario).order('criado_em')
  const resultados = await Promise.all([
    testarClaude(),
    testarOpenRouter(),
    testarFal(),
    testarKling(),
    testarElevenLabs(),
    ...(marcas ?? []).map((m) => testarInstagram(m as Parameters<typeof testarInstagram>[0])),
  ])
  res.status(200).json({ servicos: resultados, testado_em: new Date().toISOString() })
})
