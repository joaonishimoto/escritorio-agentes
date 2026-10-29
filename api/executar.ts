import { waitUntil } from '@vercel/functions'
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
  const origem = origemDaRequisicao(req)
  definirOrigem(origem)
  // responde na hora e roda a fila em segundo plano: quem acorda o executor (aprovar, posts, o próprio executor)
  // não fica esperando os 2 minutos da fila e estourando o próprio limite de 30 s
  waitUntil(
    rodarAteOLimite()
      .then(({ sobrou }) => {
        if (sobrou) acordarExecutor(origem)
      })
      .catch((e) => console.error('executor', e)),
  )
  return res.status(202).json({ ok: true })
})
