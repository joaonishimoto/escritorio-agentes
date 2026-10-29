import type { Contexto } from './contexto.js'
import { db } from './db.js'
import { buscarMetricas, textoDoQueFuncionou, type PostComMetricas } from './metricas.js'

const DIA = 86_400_000

/** Busca na Meta as métricas dos posts publicados nos últimos 60 dias que não foram atualizados nas últimas 5 horas. */
export async function atualizarMetricas(agora = new Date()) {
  const { data: posts, error } = await db
    .from('posts')
    .select('id, marca_id, instagram_media_id')
    .eq('status', 'publicado')
    .not('instagram_media_id', 'is', null)
    .gte('publicado_em', new Date(agora.getTime() - 60 * DIA).toISOString())
    .order('publicado_em', { ascending: false })
    .limit(80)
  if (error) throw new Error(error.message)
  const ids = (posts ?? []).map((p) => p.id as string)
  const { data: feitas } = ids.length ? await db.from('metricas').select('post_id, atualizado_em').in('post_id', ids) : { data: [] }
  const recente = new Set((feitas ?? []).filter((f) => agora.getTime() - new Date(f.atualizado_em).getTime() < 5 * 3_600_000).map((f) => f.post_id))

  const tokens = new Map<string, string | null>()
  const resultado = { atualizados: 0, falhas: 0, pulados: 0, erros: [] as string[] }
  for (const p of posts ?? []) {
    if (recente.has(p.id)) {
      resultado.pulados++
      continue
    }
    if (!tokens.has(p.marca_id)) {
      const { data } = await db.rpc('ler_token_meta', { p_marca: p.marca_id })
      tokens.set(p.marca_id, (data as string | null) ?? null)
    }
    const token = tokens.get(p.marca_id)
    if (!token) {
      resultado.pulados++
      continue
    }
    try {
      const m = await buscarMetricas(p.instagram_media_id as string, token)
      const { error: e } = await db.from('metricas').upsert({ post_id: p.id, marca_id: p.marca_id, ...m, atualizado_em: agora.toISOString() })
      if (e) throw new Error(e.message)
      resultado.atualizados++
    } catch (e) {
      resultado.falhas++
      if (resultado.erros.length < 5) resultado.erros.push(e instanceof Error ? e.message.slice(0, 160) : String(e))
    }
  }
  return resultado
}

/** Os posts da marca com métricas (últimos 90 dias), com o ângulo e a estrutura que o chefe escolheu, em texto para o chefe. */
export async function oQueFuncionou(ctx: Contexto): Promise<string> {
  const { data: metricas, error } = await db
    .from('metricas')
    .select('post_id, alcance, curtidas, comentarios, salvos, compartilhamentos, posts!inner(briefing, publicado_em)')
    .eq('marca_id', ctx.marca.id)
    .gte('posts.publicado_em', new Date(Date.now() - 90 * DIA).toISOString())
    .limit(60)
  // sem a tabela (migração ainda não rodou) ou sem dados: o chefe segue sem essa pista
  if (error || !metricas?.length) return ''
  const ids = metricas.map((m) => m.post_id as string)
  const { data: pautas } = await db.from('passos').select('post_id, saida').in('post_id', ids).eq('agente', 'chefe').eq('status', 'feito')
  const pauta = new Map((pautas ?? []).map((p) => [p.post_id as string, (p.saida ?? {}) as { angulo?: string; estrutura?: string }]))
  const posts: PostComMetricas[] = metricas.map((m) => {
    const post = (Array.isArray(m.posts) ? m.posts[0] : m.posts) as { briefing?: string } | null
    return { ...m, briefing: post?.briefing ?? '', angulo: pauta.get(m.post_id)?.angulo, estrutura: pauta.get(m.post_id)?.estrutura }
  })
  return textoDoQueFuncionou(posts)
}
