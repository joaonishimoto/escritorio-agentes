import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { gerarJson } from './_lib/claude.js'
import type { Marca } from './_lib/contexto.js'
import { db, eDonoDaMarca, usuarioDaRequisicao } from './_lib/db.js'
import { rota } from './_lib/http.js'
import { completarMarca } from './_lib/marcas/index.js'

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

/** O pesquisador sugere ideias de posts numa linha que você escolhe. Modelo barato e sem busca na web. */
export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const usuario = await usuarioDaRequisicao(req.headers.authorization)
  if (!usuario) return res.status(401).json({ erro: 'Faça login de novo' })

  const { marca_id, linha } = (req.body ?? {}) as { marca_id?: string; linha?: string }
  if (!marca_id) return res.status(400).json({ erro: 'Escolha a marca' })
  if (!(await eDonoDaMarca(usuario, marca_id))) return res.status(404).json({ erro: 'Marca não encontrada' })

  const [{ data: marca }, { data: recentes }] = await Promise.all([
    db.from('marcas').select('*').eq('id', marca_id).single(),
    db.from('posts').select('briefing').eq('marca_id', marca_id).order('criado_em', { ascending: false }).limit(20),
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
    conteudo: `Linha pedida pelo dono: ${linha?.trim() || 'livre, o que fizer mais sentido para a marca agora'}\n\nPosts que já foram feitos (não repita):\n${(recentes ?? []).map((p) => `- ${p.briefing}`).join('\n') || '(nenhum)'}\n\nSugira 6 ideias variadas dentro dessa linha.`,
    schema: Ideias,
  })
  return res.status(200).json({ ideias: dados.ideias, custo_usd: uso.custo_usd })
})
