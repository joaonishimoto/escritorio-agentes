import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, usuarioDaRequisicao } from './_lib/db.js'
import { rota } from './_lib/http.js'

const CHECKLIST_PADRAO = `- Português correto, sem erro de digitação
- Capa com gancho curto e legível no celular
- Texto do corpo com no mínimo 28 px e sem nada cortado ou sobreposto
- Nenhum caractere quebrado (quadradinho) nos slides
- Último slide com chamada clara
- Legenda com gancho na primeira linha e chamada no fim`

/** Cria uma sala nova: uma marca com Instagram próprio, ou uma sala neutra que segue as referências de cada pedido. */
export default rota(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const usuario = await usuarioDaRequisicao(req.headers.authorization)
  if (!usuario) return res.status(401).json({ erro: 'Faça login de novo' })

  const { nome, instagram, cor, tom_de_voz, neutra } = (req.body ?? {}) as {
    nome?: string
    instagram?: string
    cor?: string
    tom_de_voz?: string
    neutra?: boolean
  }
  const limpo = nome?.trim()
  if (!limpo) return res.status(400).json({ erro: 'Dê um nome para a sala' })
  const corSala = /^#[0-9a-f]{6}$/i.test(cor ?? '') ? cor : neutra ? '#8a8f98' : '#1e3d66'

  const { data: marca, error } = await db
    .from('marcas')
    .insert({
      dono_id: usuario,
      nome: limpo.slice(0, 40),
      instagram_usuario: instagram?.trim().replace(/^@/, '') || null,
      tom_de_voz: tom_de_voz?.trim() ?? '',
      identidade: { cor_sala: corSala, ...(neutra ? { neutra: true } : {}) },
      checklist_revisor: CHECKLIST_PADRAO,
    })
    .select('id, nome, identidade, instagram_conta_id')
    .single()
  if (error || !marca) throw new Error(error?.message ?? 'Não consegui criar a sala')
  return res.status(201).json({ marca })
})
