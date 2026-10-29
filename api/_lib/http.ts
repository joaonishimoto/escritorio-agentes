import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Endereço do próprio app, para o executor se chamar de novo e para o banco chamar o agendador.
 * Vem de variável de ambiente, nunca do cabeçalho Host: quem forja o Host receberia o EXECUTOR_SECRET.
 * Ordem: APP_URL; em produção, o domínio de produção da Vercel; numa prévia, o endereço do deploy;
 * só fora da Vercel (rodando local) usa o cabeçalho.
 */
export function origemConfiavel(env: Record<string, string | undefined>, headers: Record<string, string | string[] | undefined>) {
  const limpa = (u: string) => u.replace(/\/+$/, '')
  if (env.APP_URL) return limpa(env.APP_URL)
  if (env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${limpa(env.VERCEL_PROJECT_PRODUCTION_URL)}`
  if (env.VERCEL_URL) return `https://${limpa(env.VERCEL_URL)}`
  const host = headers['x-forwarded-host'] ?? headers.host
  const proto = headers['x-forwarded-proto'] ?? 'http'
  return `${proto}://${host}`
}

export function origemDaRequisicao(req: VercelRequest) {
  return origemConfiavel(process.env, req.headers)
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
