import { supabase } from './supabase'

/** Chama uma rota /api do app com o login do usuário. */
export async function chamarApi<T>(rota: string, corpo: unknown): Promise<T> {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } }
  const r = await fetch(`/api/${rota}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(corpo),
  })
  const texto = await r.text()
  let json: { erro?: string } = {}
  try {
    json = JSON.parse(texto)
  } catch {
    // a Vercel às vezes responde com texto puro quando a função nem sobe
  }
  if (!r.ok) throw new Error(json.erro ?? `Erro ${r.status}: ${texto.slice(0, 160) || 'sem detalhes'}`)
  return json as T
}

/** Lê uma rota /api do app (GET) com o login do usuário. */
export async function lerApi<T>(rota: string): Promise<T> {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } }
  const r = await fetch(`/api/${rota}`, { headers: { authorization: `Bearer ${data.session?.access_token ?? ''}` } })
  const json = (await r.json().catch(() => ({}))) as { erro?: string }
  if (!r.ok) throw new Error(json.erro ?? `Erro ${r.status}`)
  return json as T
}
