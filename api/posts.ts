import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, eDonoDaMarca, usuarioDaRequisicao } from './_lib/db.js'
import { acordarExecutor, enfileirar } from './_lib/fila.js'
import { origemDaRequisicao, rota } from './_lib/http.js'
import { limparIas, servicosDisponiveis } from './_lib/ias.js'
import { gastoDoMes, tetoDaMarca } from './_lib/teto.js'
import { limparPedidoAnuncio } from './_lib/anuncio.js'
import { ESTRUTURAS, LAYOUTS, VOZES } from './_lib/variacao.js'
import { briefingDireto, montarPublicacaoDireta } from './_lib/publicacao-direta.js'

/**
 * POST cria um post e põe o chefe de pauta para trabalhar. GET diz quais IAs têm chave configurada.
 * Com `direto`, o post já vem pronto (vídeo ou imagens enviados por você, mais a legenda) e vai direto para o publicador.
 */
export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end()
  const usuario = await usuarioDaRequisicao(req.headers.authorization)
  if (!usuario) return res.status(401).json({ erro: 'Faça login de novo' })
  if (req.method === 'GET') return res.status(200).json({ servicos: servicosDisponiveis() })

  const { marca_id, briefing, referencias, preferencias, vaga_id, direto } = (req.body ?? {}) as {
    /** publicação direta: { legenda, midias: [{ tipo, url }], quando? } */
    direto?: { legenda?: unknown; midias?: unknown; quando?: unknown }
    marca_id?: string
    briefing?: string
    referencias?: unknown
    preferencias?: Record<string, unknown>
    /** a vaga do plano editorial que virou este post */
    vaga_id?: string
  }
  if (direto && marca_id) {
    if (!(await eDonoDaMarca(usuario, marca_id))) return res.status(403).json({ erro: 'Essa marca não é sua' })
    return publicarDireto(req, res, marca_id, direto)
  }
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
  // passar pelo revisor antes da sua mesa: ligado, a não ser que o Novo post desligue
  prefs.revisar = p.revisar !== false
  if (typeof p.agendar_para === 'string' && !Number.isNaN(Date.parse(p.agendar_para))) prefs.agendar_para = new Date(p.agendar_para).toISOString()
  // anúncio no Meta: uma arte (em 4:5 e 9:16) com objetivo de campanha; não se agenda, fica na gaveta
  const anuncio = p.formato === 'anuncio' ? limparPedidoAnuncio(p.anuncio) : null
  if (p.formato === 'anuncio' && !anuncio) return res.status(400).json({ erro: 'Escolha o objetivo do anúncio' })
  if (anuncio) {
    prefs.formato = 'foto'
    delete prefs.slides
    delete prefs.agendar_para
  }

  const { data: roteiro } = await db.from('roteiro_ativo').select('id').eq('marca_id', marca_id).maybeSingle()
  const { data: post, error } = await db
    .from('posts')
    .insert({ marca_id, briefing: briefing.trim(), roteiro_id: roteiro?.id ?? null, status: 'em_producao', referencias: refs, preferencias: prefs, ...(anuncio ? { anuncio } : {}), ...(prefs.formato ? { formato: prefs.formato } : {}) })
    .select()
    .single()
  if (error || !post) return res.status(500).json({ erro: error?.message ?? 'Falha ao criar o post' })

  if (typeof vaga_id === 'string') await db.from('vagas').update({ post_id: post.id }).eq('id', vaga_id).eq('marca_id', marca_id)
  await enfileirar(post.id, 'chefe')
  acordarExecutor(origemDaRequisicao(req))
  return res.status(201).json({ post })
})

/** Você manda o arquivo pronto e a legenda: o post nasce aprovado (ou agendado) e o publicador sobe no Instagram. */
async function publicarDireto(req: VercelRequest, res: VercelResponse, marca_id: string, direto: { legenda?: unknown; midias?: unknown; quando?: unknown }) {
  const { data: marca } = await db.from('marcas').select('instagram_conta_id, meta_token_secret_id').eq('id', marca_id).single()
  if (!marca?.instagram_conta_id || !marca.meta_token_secret_id) return res.status(400).json({ erro: 'Esta marca ainda não tem o Instagram conectado. Conecte no perfil da sala antes de publicar.' })
  const base = `${process.env.SUPABASE_URL}/storage/v1/object/public/marcas/`
  const montado = montarPublicacaoDireta(direto, `${base}${marca_id}/`)
  if ('erro' in montado) return res.status(400).json({ erro: montado.erro })
  const { formato, legenda, slides, video, agendado_para } = montado.post

  const { data: roteiro } = await db.from('roteiro_ativo').select('id').eq('marca_id', marca_id).maybeSingle()
  const { data: post, error } = await db
    .from('posts')
    .insert({
      marca_id,
      briefing: briefingDireto(legenda, formato),
      roteiro_id: roteiro?.id ?? null,
      status: agendado_para ? 'agendado' : 'aprovado',
      formato,
      legenda,
      slides,
      video,
      agendado_para,
      preferencias: { formato, direto: true, revisar: false, aprovar_texto: false },
    })
    .select()
    .single()
  if (error || !post) return res.status(500).json({ erro: error?.message ?? 'Falha ao criar o post' })

  if (agendado_para) {
    // o banco chama o app nesse endereço quando chegar a hora
    await db.from('config_app').upsert({ chave: 'url_app', valor: origemDaRequisicao(req), atualizado_em: new Date().toISOString() })
    const quandoTexto = new Date(agendado_para).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    await db.from('eventos').insert({ post_id: post.id, agente: 'voce', tipo: 'fim', mensagem: `Enviado pronto e agendado para ${quandoTexto}` })
    return res.status(201).json({ post })
  }
  await db.from('eventos').insert({ post_id: post.id, agente: 'voce', tipo: 'entrega', mensagem: 'Enviado pronto para publicar', para: 'publicador' })
  await enfileirar(post.id, 'publicador')
  acordarExecutor(origemDaRequisicao(req))
  return res.status(201).json({ post })
}
