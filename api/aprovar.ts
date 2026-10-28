import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, eDonoDaMarca, usuarioDaRequisicao } from './_lib/db.js'
import { acordarExecutor, enfileirar } from './_lib/fila.js'
import { origemDaRequisicao, rota } from './_lib/http.js'

type Acao = 'aprovar' | 'agendar' | 'desagendar' | 'corrigir' | 'reprovar'
const ACOES: Acao[] = ['aprovar', 'agendar', 'desagendar', 'corrigir', 'reprovar']

/** Sua decisão sobre um post: publicar agora, agendar, pedir ajuste (vira regra) ou reprovar. */
export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const usuario = await usuarioDaRequisicao(req.headers.authorization)
  if (!usuario) return res.status(401).json({ erro: 'Faça login de novo' })

  const { post_id, acao, comentario, quando } = (req.body ?? {}) as { post_id?: string; acao?: Acao; comentario?: string; quando?: string }
  if (!post_id || !acao || !ACOES.includes(acao)) return res.status(400).json({ erro: 'Pedido inválido' })
  if ((acao === 'corrigir' || acao === 'reprovar') && !comentario?.trim()) return res.status(400).json({ erro: 'Diga o que precisa mudar' })

  const { data: post } = await db.from('posts').select('id, marca_id, status').eq('id', post_id).single()
  if (!post || !(await eDonoDaMarca(usuario, post.marca_id))) return res.status(404).json({ erro: 'Post não encontrado' })

  if (acao === 'desagendar') {
    if (post.status !== 'agendado') return res.status(409).json({ erro: 'Esse post não está agendado' })
    await db.from('posts').update({ status: 'aguardando_aprovacao', agendado_para: null }).eq('id', post_id).eq('status', 'agendado')
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
