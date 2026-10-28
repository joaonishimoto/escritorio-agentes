import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, eDonoDaMarca, usuarioDaRequisicao } from './_lib/db.js'
import { acordarExecutor, rodarAteOLimite } from './_lib/fila.js'
import { origemDaRequisicao, rota } from './_lib/http.js'

/**
 * Rede de segurança: o app chama quando um post em produção fica parado.
 * Roda a fila daqui mesmo, sem depender do executor ter se re-disparado.
 */
export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const usuario = await usuarioDaRequisicao(req.headers.authorization)
  if (!usuario) return res.status(401).json({ erro: 'Faça login de novo' })
  const { post_id } = (req.body ?? {}) as { post_id?: string }
  const { data: post } = await db.from('posts').select('marca_id').eq('id', post_id ?? '').maybeSingle()
  if (!post || !(await eDonoDaMarca(usuario, post.marca_id))) return res.status(404).json({ erro: 'Post não encontrado' })

  const { rodou, sobrou } = await rodarAteOLimite()
  if (sobrou) acordarExecutor(origemDaRequisicao(req))
  return res.status(200).json({ rodou })
})
