import { supabase } from './supabase'

/** Chama uma rota /api do app com o login do usuário. */
export async function chamarApi<T>(rota: string, corpo: unknown): Promise<T> {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } }
  const r = await fetch(`/api/${rota}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(corpo),
  })
  const json = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(json.erro ?? `Erro ${r.status}`)
  return json as T
}
