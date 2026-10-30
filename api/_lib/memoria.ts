// Memória da marca: uma ficha curta (tema, ângulo, gancho, linha) de cada post já publicado, feito pelo app
// ou direto no Instagram. Quem cria pauta ou ideia lê as fichas para não repetir o que a marca já postou.
import { z } from 'zod'
import { gerarJson } from './claude.js'
import { db } from './db.js'

const VERSAO = process.env.INSTAGRAM_API_VERSION ?? 'v23.0'
/** Quantos posts antigos do Instagram a leitura busca de uma vez (os mais recentes). */
export const MAX_ANTIGOS = 300
/** Posts por chamada do resumo: cabe folgado no Haiku e mantém cada chamada rápida. */
const POR_RESUMO = 25

export type Formato = 'carrossel' | 'foto' | 'reel'

export interface MidiaIg {
  id: string
  caption?: string
  media_type?: string
  media_product_type?: string
  timestamp?: string
  permalink?: string
}

export interface Ficha {
  publicado_em: string | null
  formato: Formato | null
  tema: string | null
  angulo: string | null
  gancho: string | null
  linha: string | null
  texto: string
}

const corta = (s: string, n: number) => s.replace(/\s+/g, ' ').trim().slice(0, n)

/** Tipo de mídia do Instagram no formato do app. */
export function formatoDaMidia(m: Pick<MidiaIg, 'media_type' | 'media_product_type'>): Formato {
  if (m.media_product_type === 'REELS' || m.media_type === 'VIDEO') return 'reel'
  if (m.media_type === 'CAROUSEL_ALBUM') return 'carrossel'
  return 'foto'
}

/** O que o resumo lê de um post do app: texto dos slides e legenda. */
export function textoDoPost(p: { legenda?: string | null; slides?: unknown; briefing?: string | null }) {
  const slides = (Array.isArray(p.slides) ? p.slides : [])
    .map((s) => (s && typeof s === 'object' ? (s as { texto?: unknown }).texto : undefined))
    .filter((t): t is string => typeof t === 'string' && !!t.trim())
  return corta([slides.length ? `Slides: ${slides.join(' / ')}` : '', p.legenda ? `Legenda: ${p.legenda}` : '', !slides.length && !p.legenda ? p.briefing ?? '' : ''].filter(Boolean).join('\n'), 1500)
}

/** As fichas em texto para o prompt, da mais recente para a mais antiga. */
export function textoDaMemoria(fichas: Ficha[], max = 120): string {
  if (!fichas.length) return ''
  const linhas = fichas.slice(0, max).map((f) => {
    const dia = f.publicado_em ? f.publicado_em.slice(0, 10) : 's/ data'
    const sobre = f.tema ? `${f.tema}${f.angulo ? ` (${f.angulo})` : ''}${f.gancho ? `: "${corta(f.gancho, 90)}"` : ''}` : corta(f.texto, 140)
    return `- ${dia} · ${f.formato ?? 'post'}${f.linha ? ` · ${f.linha}` : ''} · ${sobre}`
  })
  return [
    `## Posts que a marca já publicou (${fichas.length}${fichas.length > max ? `, mostrando os ${max} mais recentes` : ''})`,
    'Não repita tema nem gancho destes. Um tema antigo só volta com um ângulo claramente novo e se o post dele tem mais de 60 dias.',
    ...linhas,
  ].join('\n')
}

/** Busca os posts mais recentes da conta, seguindo a paginação da Graph API. */
export async function listarMidias(contaId: string, token: string, max = MAX_ANTIGOS): Promise<MidiaIg[]> {
  const midias: MidiaIg[] = []
  let url: string | undefined =
    `https://graph.instagram.com/${VERSAO}/${contaId}/media?` +
    new URLSearchParams({ fields: 'id,caption,media_type,media_product_type,timestamp,permalink', limit: '50', access_token: token })
  while (url && midias.length < max) {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    const json = (await r.json().catch(() => ({}))) as { data?: MidiaIg[]; paging?: { next?: string }; error?: { message?: string; code?: number } }
    if (!r.ok || json.error) {
      if (json.error?.code === 190) throw new Error('Token do Instagram expirado ou inválido. Conecte o Instagram da sala de novo.')
      throw new Error(`Instagram: ${json.error?.message ?? `HTTP ${r.status}`}`)
    }
    midias.push(...(json.data ?? []))
    url = json.paging?.next
  }
  return midias.slice(0, max)
}

/** Põe na memória os posts publicados pelo app que ainda não estão lá. */
export async function sincronizarApp(marcaId: string) {
  const { data: posts, error } = await db
    .from('posts')
    .select('id, briefing, legenda, slides, formato, publicado_em, instagram_media_id')
    .eq('marca_id', marcaId)
    .eq('status', 'publicado')
    .order('publicado_em', { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  if (!posts?.length) return 0
  const { data: ja } = await db.from('memoria_posts').select('post_id, instagram_media_id').eq('marca_id', marcaId)
  const temPost = new Set((ja ?? []).map((m) => m.post_id).filter(Boolean))
  const temMidia = new Map((ja ?? []).filter((m) => m.instagram_media_id && !m.post_id).map((m) => [m.instagram_media_id as string, true]))
  const novos = posts.filter((p) => !temPost.has(p.id))
  for (const p of novos) {
    const linha = {
      marca_id: marcaId,
      origem: 'app',
      post_id: p.id,
      instagram_media_id: p.instagram_media_id ?? null,
      formato: p.formato,
      publicado_em: p.publicado_em,
      texto: textoDoPost(p),
      // o texto do app é mais completo que a legenda que veio do Instagram: refaz a ficha
      resumido_em: null,
    }
    // a mesma publicação já tinha entrado pela leitura do Instagram: vira a ficha do app
    const { error: e } = temMidia.has(p.instagram_media_id ?? '')
      ? await db.from('memoria_posts').update({ ...linha, tema: null }).eq('marca_id', marcaId).eq('instagram_media_id', p.instagram_media_id)
      : await db.from('memoria_posts').insert(linha)
    if (e) throw new Error(e.message)
  }
  return novos.length
}

/** Lê os posts antigos do Instagram da sala (inclusive os feitos fora do app) e põe na memória. */
export async function importarInstagram(marcaId: string) {
  const { data: marca } = await db.from('marcas').select('instagram_conta_id').eq('id', marcaId).single()
  const { data: token } = await db.rpc('ler_token_meta', { p_marca: marcaId })
  if (!marca?.instagram_conta_id || !token) throw new Error('Conecte o Instagram desta sala antes de ler os posts antigos.')
  const midias = await listarMidias(marca.instagram_conta_id, token as string)
  const { data: ja } = await db.from('memoria_posts').select('instagram_media_id').eq('marca_id', marcaId).not('instagram_media_id', 'is', null)
  const tem = new Set((ja ?? []).map((m) => m.instagram_media_id))
  const novas = midias.filter((m) => !tem.has(m.id))
  if (novas.length) {
    const { error } = await db.from('memoria_posts').insert(
      novas.map((m) => ({
        marca_id: marcaId,
        origem: 'instagram',
        instagram_media_id: m.id,
        formato: formatoDaMidia(m),
        publicado_em: m.timestamp ?? null,
        permalink: m.permalink ?? null,
        texto: corta(m.caption ?? '', 1500),
      })),
    )
    if (error) throw new Error(error.message)
  }
  return { lidos: midias.length, novos: novas.length }
}

const Resumos = z.object({
  fichas: z.array(
    z.object({
      n: z.number().int().describe('o número do post na lista'),
      tema: z.string().describe('o assunto em até 8 palavras (ex.: "caipirinha de limão com cachaça")'),
      angulo: z.string().describe('o jeito de abordar em até 10 palavras (ex.: "erros comuns que deixam amarga")'),
      gancho: z.string().describe('a frase de abertura ou da capa, curta'),
      linha: z.string().describe('uma palavra: educativo, receita, lista, bastidor, opinião, humor, novidade, promoção ou outro'),
    }),
  ),
})

/** Resume em fichas os posts da memória que ainda não foram resumidos (Haiku, em lotes em paralelo). */
export async function resumirPendentes(marcaId: string, max = MAX_ANTIGOS) {
  const { data: pendentes, error } = await db
    .from('memoria_posts')
    .select('id, texto, formato')
    .eq('marca_id', marcaId)
    .is('resumido_em', null)
    .order('publicado_em', { ascending: false })
    .limit(max)
  if (error) throw new Error(error.message)
  const lotes: (typeof pendentes)[] = []
  for (let i = 0; i < (pendentes ?? []).length; i += POR_RESUMO) lotes.push(pendentes!.slice(i, i + POR_RESUMO))
  const agora = new Date().toISOString()
  const feitos = await Promise.allSettled(
    lotes.map(async (lote) => {
      const { dados, uso } = await gerarJson({
        modelo: 'claude-haiku-5-5',
        effort: 'low',
        sistema: 'Você cataloga posts de Instagram de uma marca para a equipe não repetir assunto. Para cada post, diga o tema, o ângulo, o gancho e a linha de conteúdo. Escreva em português do Brasil, curto e concreto.',
        conteudo: lote.map((p, i) => `### Post ${i + 1} (${p.formato ?? 'post'})\n${p.texto || '(sem legenda)'}`).join('\n\n'),
        schema: Resumos,
      })
      for (const f of dados.fichas) {
        const p = lote[f.n - 1]
        if (!p) continue
        const { error: e } = await db
          .from('memoria_posts')
          .update({ tema: corta(f.tema, 120), angulo: corta(f.angulo, 160), gancho: corta(f.gancho, 200), linha: corta(f.linha, 30).toLowerCase(), resumido_em: agora })
          .eq('id', p.id)
        if (e) throw new Error(e.message)
      }
      return { resumidos: dados.fichas.filter((f) => lote[f.n - 1]).length, custo: uso.custo_usd }
    }),
  )
  const ok = feitos.filter((f): f is PromiseFulfilledResult<{ resumidos: number; custo: number }> => f.status === 'fulfilled').map((f) => f.value)
  const falha = feitos.find((f): f is PromiseRejectedResult => f.status === 'rejected')
  return {
    resumidos: ok.reduce((s, x) => s + x.resumidos, 0),
    custo_usd: ok.reduce((s, x) => s + x.custo, 0),
    erro: falha ? (falha.reason instanceof Error ? falha.reason.message : String(falha.reason)).slice(0, 200) : undefined,
  }
}

/** As fichas da marca, da mais recente para a mais antiga. Sem a tabela (migração não rodou), volta vazio. */
export async function fichasDaMarca(marcaId: string, limite = 200): Promise<Ficha[]> {
  const { data, error } = await db
    .from('memoria_posts')
    .select('publicado_em, formato, tema, angulo, gancho, linha, texto')
    .eq('marca_id', marcaId)
    .order('publicado_em', { ascending: false, nullsFirst: false })
    .limit(limite)
  if (error) return []
  return (data ?? []) as Ficha[]
}

/** Texto da memória para o prompt; antes, põe os posts do app publicados desde a última vez (sem resumir, que fica para o cron). */
export async function memoriaDaMarca(marcaId: string, max?: number) {
  await sincronizarApp(marcaId).catch((e) => console.warn('memória: não sincronizou os posts do app', e))
  return textoDaMemoria(await fichasDaMarca(marcaId), max)
}

/** Do cron das métricas: põe na memória os posts novos de cada sala e resume o que faltar. */
export async function atualizarMemorias() {
  const { data: marcas } = await db.from('posts').select('marca_id').eq('status', 'publicado').gte('publicado_em', new Date(Date.now() - 7 * 86_400_000).toISOString())
  const ids = [...new Set((marcas ?? []).map((m) => m.marca_id as string))]
  const resultado = { salas: ids.length, novos: 0, resumidos: 0, erros: [] as string[] }
  for (const id of ids) {
    try {
      resultado.novos += await sincronizarApp(id)
      const r = await resumirPendentes(id, 50)
      resultado.resumidos += r.resumidos
      if (r.erro) resultado.erros.push(r.erro)
    } catch (e) {
      resultado.erros.push(e instanceof Error ? e.message.slice(0, 160) : String(e))
    }
  }
  return resultado
}
