import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_lib/db.js'
import { enfileirar, rodarAteOLimite } from './_lib/fila.js'
import { rota } from './_lib/http.js'

/** Chamado pelo banco a cada minuto quando algum post agendado chegou na hora (manda para o publicador) ou quando há passo parado na fila (roda a fila). */
export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { data: token } = await db.from('config_app').select('valor').eq('chave', 'token_agendador').single()
  if (!token?.valor || req.headers['x-agendador'] !== token.valor) return res.status(401).end()

  const { data: vencidos } = await db
    .from('posts')
    .select('id')
    .eq('status', 'agendado')
    .lte('agendado_para', new Date().toISOString())
    .limit(10)
  let enviados = 0
  for (const p of vencidos ?? []) {
    // só um chamado pega cada post, mesmo que dois cheguem juntos
    const { data: pego } = await db.from('posts').update({ status: 'aprovado' }).eq('id', p.id).eq('status', 'agendado').select('id')
    if (!pego?.length) continue
    await db.from('eventos').insert({ post_id: p.id, agente: 'voce', tipo: 'entrega', mensagem: 'Chegou a hora agendada', para: 'publicador' })
    await enfileirar(p.id, 'publicador')
    enviados++
  }
  // rede de segurança: passo pendente parado há mais de 2 minutos (navegador fechado, executor que não se re-disparou)
  const { count: parados } = await db
    .from('passos')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pendente')
    .lt('criado_em', new Date(Date.now() - 2 * 60_000).toISOString())
  let rodou = 0
  if (enviados || parados) rodou = (await rodarAteOLimite(240_000)).rodou
  return res.status(200).json({ ok: true, enviados, rodou })
})
