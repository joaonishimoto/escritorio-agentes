import { createClient } from '@supabase/supabase-js'

function exigir(nome: string): string {
  const v = process.env[nome]
  if (!v) throw new Error(`Variável de ambiente ${nome} não configurada`)
  return v
}

/** Cliente com service role: só no servidor. Ignora RLS, então toda rota confere o dono antes. */
export const db = createClient(exigir('SUPABASE_URL'), exigir('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const BUCKET_POSTS = 'posts'

export function urlPublica(caminho: string) {
  return db.storage.from(BUCKET_POSTS).getPublicUrl(caminho).data.publicUrl
}

/** Confere o JWT do usuário que chamou a rota e devolve o id dele. */
export async function usuarioDaRequisicao(authorization: string | undefined): Promise<string | null> {
  const token = authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

export async function eDonoDaMarca(usuarioId: string, marcaId: string) {
  const { data } = await db.from('marcas').select('id').eq('id', marcaId).eq('dono_id', usuarioId).maybeSingle()
  return !!data
}
