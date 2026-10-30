import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { gerarJson } from './_lib/claude.js'
import type { Marca } from './_lib/contexto.js'
import { db, eDonoDaMarca, usuarioDaRequisicao } from './_lib/db.js'
import { rota } from './_lib/http.js'
import { eAgenteAvulso, pedidoAvulso, type Troca } from './_lib/pedido-avulso.js'
import { completarMarca } from './_lib/marcas/index.js'
import { memoriaDaMarca } from './_lib/memoria.js'
import { gerarPlano, limparVagas, outraIdeia } from './_lib/plano.js'

const Ideias = z.object({
  ideias: z.array(
    z.object({
      titulo: z.string().describe('nome curto da ideia'),
      formato: z.enum(['carrossel', 'foto', 'reel']),
      gancho: z.string().describe('a frase da capa ou dos primeiros segundos'),
      briefing: z.string().describe('o pedido completo para a equipe produzir o post, em 1 a 3 frases'),
    }),
  ),
})

/**
 * O pesquisador sugere ideias de posts numa linha que você escolhe (modelo barato e sem busca na web).
 * Com `agente` e `pedido`, é um pedido avulso a qualquer funcionário (ver _lib/pedido-avulso.ts); mora nesta
 * mesma rota para não passar do limite de funções da Vercel. Com `acao` "plano" ou "outra_ideia", é o Social Media
 * montando o plano editorial (ver _lib/plano.ts), pelo mesmo motivo.
 */
export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const usuario = await usuarioDaRequisicao(req.headers.authorization)
  if (!usuario) return res.status(401).json({ erro: 'Faça login de novo' })

  const { marca_id, linha, agente, pedido, anteriores, acao, config, vagas, vaga_id } = (req.body ?? {}) as {
    marca_id?: string
    linha?: string
    agente?: string
    pedido?: string
    anteriores?: Troca[]
    acao?: string
    config?: unknown
    vagas?: unknown
    vaga_id?: string
  }
  if (!marca_id) return res.status(400).json({ erro: 'Escolha a marca' })
  if (!(await eDonoDaMarca(usuario, marca_id))) return res.status(404).json({ erro: 'Marca não encontrada' })

  const pedidoLimpo = typeof pedido === 'string' ? pedido.trim().slice(0, 2000) : undefined
  if (acao === 'plano') {
    const lista = limparVagas(vagas)
    if (!lista.length) return res.status(400).json({ erro: 'O plano ficou sem vagas: confira o período, o ritmo e se os dias já não estão ocupados.' })
    const cfg = config && typeof config === 'object' && !Array.isArray(config) ? (config as Record<string, unknown>) : {}
    return res.status(201).json(await gerarPlano(marca_id, cfg, lista, pedidoLimpo))
  }
  if (acao === 'outra_ideia') {
    const { data: vaga } = await db.from('vagas').select('id').eq('id', vaga_id ?? '').eq('marca_id', marca_id).maybeSingle()
    if (!vaga) return res.status(404).json({ erro: 'Vaga não encontrada' })
    return res.status(200).json(await outraIdeia(vaga.id, pedidoLimpo))
  }

  if (agente !== undefined) {
    if (!eAgenteAvulso(agente)) return res.status(400).json({ erro: 'Esse funcionário não recebe pedidos avulsos' })
    if (!pedido?.trim()) return res.status(400).json({ erro: 'Escreva o que você quer pedir' })
    const trocas = Array.isArray(anteriores) ? anteriores.filter((t) => typeof t?.pedido === 'string' && typeof t?.resposta === 'string') : []
    return res.status(200).json(await pedidoAvulso(marca_id, agente, pedido.trim().slice(0, 8000), trocas))
  }

  const [{ data: marca }, { data: recentes }, memoria] = await Promise.all([
    db.from('marcas').select('*').eq('id', marca_id).single(),
    // os publicados já estão na memória; aqui entram os que ainda estão em produção, na mesa ou agendados
    db.from('posts').select('briefing').eq('marca_id', marca_id).neq('status', 'publicado').order('criado_em', { ascending: false }).limit(20),
    memoriaDaMarca(marca_id),
  ])
  if (!marca) return res.status(404).json({ erro: 'Marca não encontrada' })
  const m = completarMarca(marca as Marca)

  const { dados, uso } = await gerarJson({
    modelo: 'claude-haiku-5-5',
    effort: 'low',
    sistema: [
      `Você é o pesquisador de uma equipe que cria posts de Instagram${m.identidade?.neutra ? '' : ` para a marca ${m.nome}`}. Sugira ideias de posts boas para salvar e compartilhar. Escreva em português do Brasil.`,
      m.tom_de_voz ? `## Tom de voz da marca\n${m.tom_de_voz.slice(0, 4000)}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    conteudo: `Linha pedida pelo dono: ${linha?.trim() || 'livre, o que fizer mais sentido para a marca agora'}\n\n${memoria || '## Posts que a marca já publicou\n(nenhum na memória)'}\n\n## Posts em andamento ou agendados (não repita)\n${(recentes ?? []).map((p) => `- ${p.briefing.replace(/\s+/g, ' ').slice(0, 200)}`).join('\n') || '(nenhum)'}\n\nSugira 6 ideias variadas dentro dessa linha, que não repitam o tema de nenhum post acima.`,
    schema: Ideias,
  })
  return res.status(200).json({ ideias: dados.ideias, custo_usd: uso.custo_usd })
})
