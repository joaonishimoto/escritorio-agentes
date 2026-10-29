import type { VercelRequest, VercelResponse } from '@vercel/node'
import { rota } from './_lib/http.js'
import { salvarImagens } from './_lib/render-remoto.js'
import { renderizarSlidesConferindo } from './_lib/render.js'

// Desenha os slides de um post numa função só para isso, chamada pelo executor com o segredo dele.
// O Chromium fica com a memória inteira da função e um post não derruba o render de outro.
export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!process.env.EXECUTOR_SECRET || req.headers['x-executor-secret'] !== process.env.EXECUTOR_SECRET) {
    return res.status(401).json({ erro: 'não autorizado' })
  }
  const { html, pasta } = (req.body ?? {}) as { html?: string; pasta?: string }
  if (!html || !pasta || !/^[\w-]+\/[\w.-]+$/.test(pasta)) return res.status(400).json({ erro: 'Faltou o HTML ou a pasta do post' })
  const r = await renderizarSlidesConferindo(html)
  const slides = await salvarImagens(r.imagens, pasta)
  return res.status(200).json({ slides, problemas: r.problemas })
})
