import type { VercelRequest } from '@vercel/node'

export function origemDaRequisicao(req: VercelRequest) {
  const host = req.headers['x-forwarded-host'] ?? req.headers.host
  const proto = req.headers['x-forwarded-proto'] ?? 'https'
  return `${proto}://${host}`
}
