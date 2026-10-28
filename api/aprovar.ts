import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, eDonoDaMarca, usuarioDaRequisicao } from './_lib/db'
import { acordarExecutor, enfileirar } from './_lib/fila'
import { origemDaRequisicao } from './_lib/http'

type Acao = 'aprovar' | 'corrigir' | 'reprovar'

/** Sua decisão sobre um post: publicar, pedir ajuste (vira regra) ou reprovar. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const usuario = await usuarioDaRequisicao(req.headers.authorization)
  if (!usuario) return res.status(401).json({ erro: 'Faça login de novo' })

  const { post_id, acao, comentario } = (req.body ?? {}) as { post_id?: string; acao?: Acao; comentario?: string }
  if (!post_id || !acao || !['aprovar', 'corrigir', 'reprovar'].includes(acao)) return res.status(400).json({ erro: 'Pedido inválido' })
  if (acao !== 'aprovar' && !comentario?.trim()) return res.status(400).json({ erro: 'Diga o que precisa mudar' })

  const { data: post } = await db.from('posts').select('id, marca_id, status').eq('id', post_id).single()
  if (!post || !(await eDonoDaMarca(usuario, post.marca_id))) return res.status(404).json({ erro: 'Post não encontrado' })
  if (post.status !== 'aguardando_aprovacao') return res.status(409).json({ erro: 'Esse post não está esperando aprovação' })

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
}
