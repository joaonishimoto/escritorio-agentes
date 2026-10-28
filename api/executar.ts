import type { VercelRequest, VercelResponse } from '@vercel/node'
import { acordarExecutor, rodarUmPasso } from './_lib/fila'
import { origemDaRequisicao } from './_lib/http'

// Roda um passo por chamada e se re-dispara enquanto houver fila,
// assim nenhum post estoura o limite de tempo de uma função.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!process.env.EXECUTOR_SECRET || req.headers['x-executor-secret'] !== process.env.EXECUTOR_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' })
  }
  const rodou = await rodarUmPasso()
  if (rodou) acordarExecutor(origemDaRequisicao(req))
  return res.status(200).json({ rodou })
}
