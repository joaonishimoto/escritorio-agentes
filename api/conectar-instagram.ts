import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { db, eDonoDaMarca, usuarioDaRequisicao } from './_lib/db.js'
import { rota } from './_lib/http.js'

const VERSAO = process.env.INSTAGRAM_API_VERSION ?? 'v23.0'

/** Confere o token do Instagram, descobre a conta e guarda o token no Vault (nunca em tabela nem em log). */
export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const usuario = await usuarioDaRequisicao(req.headers.authorization)
  if (!usuario) return res.status(401).json({ erro: 'Faça login de novo' })

  const { marca_id, token } = (req.body ?? {}) as { marca_id?: string; token?: string }
  const limpo = token?.trim()
  if (!marca_id || !limpo) return res.status(400).json({ erro: 'Cole o token do Instagram' })
  if (!(await eDonoDaMarca(usuario, marca_id))) return res.status(404).json({ erro: 'Marca não encontrada' })

  // o próprio token diz de qual conta ele é
  const qs = new URLSearchParams({ fields: 'user_id,username,account_type', access_token: limpo })
  const r = await fetch(`https://graph.instagram.com/${VERSAO}/me?${qs}`)
  const conta = (await r.json()) as { user_id?: string; username?: string; account_type?: string; error?: { message: string } }
  if (!r.ok || conta.error || !conta.user_id) {
    return res.status(400).json({ erro: `O Instagram não aceitou esse token: ${conta.error?.message ?? `HTTP ${r.status}`}` })
  }

  // grava no Vault pela função do dono, com a sessão de quem chamou
  const comoUsuario = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.authorization! } },
  })
  const { error } = await comoUsuario.rpc('definir_token_meta', { p_marca: marca_id, p_token: limpo })
  if (error) throw new Error(`Não consegui guardar o token: ${error.message}`)

  const { data: marca } = await db.from('marcas').select('identidade').eq('id', marca_id).single()
  const identidade = { ...((marca?.identidade as Record<string, unknown>) ?? {}), instagram: conta.username, instagram_conectado_em: new Date().toISOString() }
  await db.from('marcas').update({ instagram_conta_id: conta.user_id, identidade }).eq('id', marca_id)
  return res.status(200).json({ ok: true, usuario: conta.username, tipo: conta.account_type })
})
