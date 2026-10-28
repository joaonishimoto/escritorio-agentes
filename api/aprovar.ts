import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, eDonoDaMarca, usuarioDaRequisicao } from './_lib/db.js'
import { acordarExecutor, enfileirar } from './_lib/fila.js'
import { limparIas } from './_lib/ias.js'
import { origemDaRequisicao, rota } from './_lib/http.js'

type Acao = 'aprovar' | 'agendar' | 'desagendar' | 'tentar_de_novo' | 'corrigir' | 'reprovar'
const ACOES: Acao[] = ['aprovar', 'agendar', 'desagendar', 'tentar_de_novo', 'corrigir', 'reprovar']

/** Sua decisão sobre um post: publicar agora, agendar, pedir ajuste (vira regra) ou reprovar. */
export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const usuario = await usuarioDaRequisicao(req.headers.authorization)
  if (!usuario) return res.status(401).json({ erro: 'Faça login de novo' })

  const { post_id, acao, comentario, quando, ia } = (req.body ?? {}) as { post_id?: string; acao?: Acao; comentario?: string; quando?: string; ia?: string }
  if (!post_id || !acao || !ACOES.includes(acao)) return res.status(400).json({ erro: 'Pedido inválido' })
  if ((acao === 'corrigir' || acao === 'reprovar') && !comentario?.trim()) return res.status(400).json({ erro: 'Diga o que precisa mudar' })

  const { data: post } = await db.from('posts').select('id, marca_id, status, agendado_para, slides, preferencias').eq('id', post_id).single()
  if (!post || !(await eDonoDaMarca(usuario, post.marca_id))) return res.status(404).json({ erro: 'Post não encontrado' })

  // post que deu erro: o mesmo agente que falhou tenta de novo, do ponto em que parou
  if (acao === 'tentar_de_novo') {
    if (post.status !== 'erro') return res.status(409).json({ erro: 'Esse post não está com erro' })
    const { data: falhou } = await db
      .from('passos')
      .select('agente, entrada')
      .eq('post_id', post_id)
      .eq('status', 'falhou')
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle()
    const agente = falhou?.agente ?? 'chefe'
    const publicar = agente === 'publicador'
    let entrada = (falhou?.entrada as Record<string, unknown>) ?? {}
    // tentar de novo com outra IA: troca só a do agente que falhou, e o vídeo começa um pedido novo
    const trocar = ia ? limparIas({ [agente]: ia }) : {}
    if (trocar[agente]) {
      const preferencias = (post.preferencias as { ias?: Record<string, string> } | null) ?? {}
      await db.from('posts').update({ preferencias: { ...preferencias, ias: { ...preferencias.ias, ...trocar } } }).eq('id', post_id)
      if (agente === 'cinegrafista') {
        entrada = Object.fromEntries(Object.entries(entrada).filter(([k]) => !['pedido', 'kling_id', 'esperas', 'animacao'].includes(k)))
      }
    }
    await db.from('posts').update({ status: publicar ? 'aprovado' : 'em_producao' }).eq('id', post_id).eq('status', 'erro')
    await db.from('eventos').insert({ post_id, agente: 'voce', tipo: 'entrega', mensagem: publicar ? 'Tentar publicar de novo' : 'Tentar de novo', para: agente })
    await enfileirar(post_id, agente, entrada)
    acordarExecutor(origemDaRequisicao(req))
    return res.status(200).json({ ok: true, agente })
  }

  if (acao === 'desagendar') {
    // também serve para um agendado que não conseguiu publicar: volta para você decidir de novo
    if (post.status !== 'agendado' && !(post.status === 'erro' && (post.agendado_para || (post.slides as unknown[] | null)?.length))) return res.status(409).json({ erro: 'Esse post não está agendado' })
    await db.from('posts').update({ status: 'aguardando_aprovacao', agendado_para: null }).eq('id', post_id).eq('status', post.status)
    return res.status(200).json({ ok: true })
  }
  if (post.status !== 'aguardando_aprovacao') return res.status(409).json({ erro: 'Esse post não está esperando aprovação' })

  if (acao === 'agendar') {
    const data = quando ? new Date(quando) : null
    if (!data || Number.isNaN(data.getTime())) return res.status(400).json({ erro: 'Escolha a data e a hora' })
    if (data.getTime() < Date.now() + 60_000) return res.status(400).json({ erro: 'Escolha um horário no futuro' })
    // o banco chama este endereço quando chegar a hora
    await db.from('config_app').upsert({ chave: 'url_app', valor: origemDaRequisicao(req), atualizado_em: new Date().toISOString() })
    await db.from('posts').update({ status: 'agendado', agendado_para: data.toISOString() }).eq('id', post_id)
    const quandoTexto = data.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    // sem pasta voando: o publicador só começa na hora marcada
    await db.from('eventos').insert({ post_id, agente: 'voce', tipo: 'fim', mensagem: `Agendado para ${quandoTexto}` })
    return res.status(200).json({ ok: true })
  }

  await db.from('eventos').insert({
    post_id,
    agente: 'voce',
    tipo: 'entrega',
    mensagem: acao === 'aprovar' ? 'Aprovado para publicar' : acao === 'corrigir' ? `Ajuste pedido: ${comentario}` : `Reprovado: ${comentario}`,
    para: acao === 'aprovar' ? 'publicador' : 'curador',
  })

  if (acao === 'aprovar') {
    await db.from('posts').update({ status: 'aprovado' }).eq('id', post_id)
    await enfileirar(post_id, 'publicador')
  } else {
    await db.from('posts').update({ status: acao === 'reprovar' ? 'reprovado' : 'em_producao' }).eq('id', post_id)
    await enfileirar(post_id, 'curador', { acao, comentario })
  }
  acordarExecutor(origemDaRequisicao(req))
  return res.status(200).json({ ok: true })
})
