import type { VercelRequest, VercelResponse } from '@vercel/node'
import { acordarExecutor, rodarUmPasso } from './_lib/fila.js'
import { origemDaRequisicao, rota } from './_lib/http.js'

// Roda um passo por chamada e se re-dispara enquanto houver fila,
// assim nenhum post estoura o limite de tempo de uma função.
export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!process.env.EXECUTOR_SECRET || req.headers['x-executor-secret'] !== process.env.EXECUTOR_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' })
  }
  const rodou = await rodarUmPasso()
  if (rodou) acordarExecutor(origemDaRequisicao(req))
  return res.status(200).json({ rodou })
})
