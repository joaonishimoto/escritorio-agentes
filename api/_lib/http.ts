import type { VercelRequest, VercelResponse } from '@vercel/node'

export function origemDaRequisicao(req: VercelRequest) {
  const host = req.headers['x-forwarded-host'] ?? req.headers.host
  const proto = req.headers['x-forwarded-proto'] ?? 'https'
  return `${proto}://${host}`
}

const OBRIGATORIAS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY', 'EXECUTOR_SECRET']

/** Envolve uma rota: avisa qual variável de ambiente falta e devolve qualquer erro como JSON legível. */
export function rota(fn: (req: VercelRequest, res: VercelResponse) => Promise<unknown>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const faltando = OBRIGATORIAS.filter((v) => !process.env[v])
    if (faltando.length) return res.status(500).json({ erro: `Falta configurar na Vercel: ${faltando.join(', ')}` })
    try {
      await fn(req, res)
    } catch (e) {
      console.error(e)
      if (!res.headersSent) res.status(500).json({ erro: e instanceof Error ? e.message : 'Erro inesperado' })
    }
  }
}
