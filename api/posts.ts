import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, eDonoDaMarca, usuarioDaRequisicao } from './_lib/db.js'
import { acordarExecutor, enfileirar } from './_lib/fila.js'
import { origemDaRequisicao, rota } from './_lib/http.js'

/** Cria um post e põe o chefe de pauta para trabalhar. */
export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const usuario = await usuarioDaRequisicao(req.headers.authorization)
  if (!usuario) return res.status(401).json({ erro: 'Faça login de novo' })

  const { marca_id, briefing, referencias } = (req.body ?? {}) as { marca_id?: string; briefing?: string; referencias?: unknown }
  if (!marca_id || !briefing?.trim()) return res.status(400).json({ erro: 'Escolha a marca e escreva o pedido' })
  if (!(await eDonoDaMarca(usuario, marca_id))) return res.status(403).json({ erro: 'Essa marca não é sua' })

  // imagens só do armazenamento do próprio app; links só http(s)
  const base = `${process.env.SUPABASE_URL}/storage/v1/object/public/marcas/${marca_id}/`
  const refs = (Array.isArray(referencias) ? referencias : [])
    .filter((r): r is { tipo: 'imagem' | 'link'; url: string } => !!r && typeof r.url === 'string' && (r.tipo === 'imagem' || r.tipo === 'link'))
    .filter((r) => (r.tipo === 'imagem' ? r.url.startsWith(base) : /^https?:\/\//.test(r.url)))
    .slice(0, 12)
    .map((r) => ({ tipo: r.tipo, url: r.url }))

  const { data: roteiro } = await db.from('roteiro_ativo').select('id').eq('marca_id', marca_id).maybeSingle()
  const { data: post, error } = await db
    .from('posts')
    .insert({ marca_id, briefing: briefing.trim(), roteiro_id: roteiro?.id ?? null, status: 'em_producao', referencias: refs })
    .select()
    .single()
  if (error || !post) return res.status(500).json({ erro: error?.message ?? 'Falha ao criar o post' })

  await enfileirar(post.id, 'chefe')
  acordarExecutor(origemDaRequisicao(req))
  return res.status(201).json({ post })
})
