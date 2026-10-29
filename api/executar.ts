import type { VercelRequest, VercelResponse } from '@vercel/node'
import { acordarExecutor, rodarAteOLimite } from './_lib/fila.js'
import { origemDaRequisicao, rota } from './_lib/http.js'
import { definirOrigem } from './_lib/render-remoto.js'

// Roda passos em sequência por até ~2 minutos e, se ainda sobrar fila, se re-dispara,
// assim nenhum post estoura o limite de tempo de uma função.
export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!process.env.EXECUTOR_SECRET || req.headers['x-executor-secret'] !== process.env.EXECUTOR_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' })
  }
  definirOrigem(origemDaRequisicao(req))
  const { rodou, sobrou } = await rodarAteOLimite()
  if (sobrou) acordarExecutor(origemDaRequisicao(req))
  return res.status(200).json({ rodou })
})
