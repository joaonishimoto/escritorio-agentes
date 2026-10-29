import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, eDonoDaMarca, usuarioDaRequisicao } from './_lib/db.js'
import { acordarExecutor, enfileirar } from './_lib/fila.js'
import { origemDaRequisicao, rota } from './_lib/http.js'
import { limparIas, servicosDisponiveis } from './_lib/ias.js'
import { gastoDoMes, tetoDaMarca } from './_lib/teto.js'
import { ESTRUTURAS, LAYOUTS, VOZES } from './_lib/variacao.js'

/** POST cria um post e põe o chefe de pauta para trabalhar. GET diz quais IAs têm chave configurada. */
export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end()
  const usuario = await usuarioDaRequisicao(req.headers.authorization)
  if (!usuario) return res.status(401).json({ erro: 'Faça login de novo' })
  if (req.method === 'GET') return res.status(200).json({ servicos: servicosDisponiveis() })

  const { marca_id, briefing, referencias, preferencias } = (req.body ?? {}) as { marca_id?: string; briefing?: string; referencias?: unknown; preferencias?: Record<string, unknown> }
  if (!marca_id || !briefing?.trim()) return res.status(400).json({ erro: 'Escolha a marca e escreva o pedido' })
  if (!(await eDonoDaMarca(usuario, marca_id))) return res.status(403).json({ erro: 'Essa marca não é sua' })

  const { data: marca } = await db.from('marcas').select('identidade').eq('id', marca_id).single()
  const teto = tetoDaMarca(marca?.identidade as Record<string, unknown> | null)
  if (teto.mes !== null) {
    const gasto = await gastoDoMes(marca_id)
    if (gasto >= teto.mes)
      return res.status(400).json({ erro: `Esta marca já gastou US$ ${gasto.toFixed(2)} este mês e o teto é US$ ${teto.mes.toFixed(2)}. Aumente o teto no perfil da marca (aba Sala) para pedir mais posts.` })
  }

  // imagens só do armazenamento do próprio app; links só http(s)
  const base = `${process.env.SUPABASE_URL}/storage/v1/object/public/marcas/${marca_id}/`
  const refs = (Array.isArray(referencias) ? referencias : [])
    .filter((r): r is { tipo: 'imagem' | 'link'; url: string } => !!r && typeof r.url === 'string' && (r.tipo === 'imagem' || r.tipo === 'link'))
    .filter((r) => (r.tipo === 'imagem' ? r.url.startsWith(base) : /^https?:\/\//.test(r.url)))
    .slice(0, 12)
    .map((r) => ({ tipo: r.tipo, url: r.url }))

  // escolhas do Novo post: só valores conhecidos; o que vier vazio fica com a equipe
  const p = preferencias ?? {}
  const prefs: Record<string, unknown> = {}
  if (['carrossel', 'foto', 'reel'].includes(p.formato as string)) prefs.formato = p.formato
  if (typeof p.estrutura === 'string' && p.estrutura in ESTRUTURAS) prefs.estrutura = p.estrutura
  if (typeof p.layout === 'string' && p.layout in LAYOUTS) prefs.layout = p.layout
  if (typeof p.voz === 'string' && p.voz in VOZES) prefs.voz = p.voz
  if (Number.isInteger(p.slides) && (p.slides as number) >= 2 && (p.slides as number) <= 10) prefs.slides = p.slides
  const ias = limparIas(p.ias)
  if (Object.keys(ias).length) prefs.ias = ias
  // aprovar o texto antes do designer: ligado, a não ser que o Novo post desligue
  prefs.aprovar_texto = p.aprovar_texto !== false
  if (typeof p.agendar_para === 'string' && !Number.isNaN(Date.parse(p.agendar_para))) prefs.agendar_para = new Date(p.agendar_para).toISOString()

  const { data: roteiro } = await db.from('roteiro_ativo').select('id').eq('marca_id', marca_id).maybeSingle()
  const { data: post, error } = await db
    .from('posts')
    .insert({ marca_id, briefing: briefing.trim(), roteiro_id: roteiro?.id ?? null, status: 'em_producao', referencias: refs, preferencias: prefs, ...(prefs.formato ? { formato: prefs.formato } : {}) })
    .select()
    .single()
  if (error || !post) return res.status(500).json({ erro: error?.message ?? 'Falha ao criar o post' })

  await enfileirar(post.id, 'chefe')
  acordarExecutor(origemDaRequisicao(req))
  return res.status(201).json({ post })
})
