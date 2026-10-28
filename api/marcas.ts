import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, usuarioDaRequisicao } from './_lib/db.js'
import { rota } from './_lib/http.js'
import { completarMarca } from './_lib/marcas/index.js'

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

  const corpo = (req.body ?? {}) as { acao?: string; id?: string; campos?: Record<string, unknown> }
  if (corpo.acao === 'ler' || corpo.acao === 'salvar') return perfil(res, usuario, corpo)

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

const CAMPOS_PERFIL = 'id, nome, instagram_usuario, instagram_conta_id, tom_de_voz, identidade, hashtags_fixas, aviso_final, checklist_revisor, modelo_slides_html'
// chaves da identidade que o app mantém sozinho: o formulário não apaga nem troca
const PROTEGIDAS = ['instagram', 'instagram_conectado_em', 'neutra', 'tom_editado']

/** Perfil da marca para editar no app: lê o que os agentes usam de verdade e salva o que o dono mudou. */
async function perfil(res: VercelResponse, usuario: string, corpo: { acao?: string; id?: string; campos?: Record<string, unknown> }) {
  const { data: atual } = await db.from('marcas').select(CAMPOS_PERFIL).eq('id', corpo.id ?? '').eq('dono_id', usuario).maybeSingle()
  if (!atual) return res.status(404).json({ erro: 'Marca não encontrada' })
  const sem = ({ modelo_slides_html: _m, ...m }: typeof atual) => m

  if (corpo.acao === 'ler') return res.json({ marca: sem(completarMarca(atual)) })

  const c = corpo.campos ?? {}
  const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)
  const efetivo = completarMarca(atual)
  const novoTom = texto(c.tom_de_voz, 8000)
  const identidadeAntiga = (atual.identidade ?? {}) as Record<string, unknown>
  const identidade: Record<string, unknown> = c.identidade && typeof c.identidade === 'object' ? { ...(c.identidade as Record<string, unknown>) } : { ...identidadeAntiga }
  for (const k of PROTEGIDAS) {
    if (k in identidadeAntiga) identidade[k] = identidadeAntiga[k]
    else delete identidade[k]
  }
  if (novoTom !== undefined && novoTom !== efetivo.tom_de_voz) identidade.tom_editado = true

  const mudancas: Record<string, unknown> = { identidade }
  const nome = texto(c.nome, 40)
  if (nome) mudancas.nome = nome
  if (c.instagram_usuario !== undefined) mudancas.instagram_usuario = texto(c.instagram_usuario, 60)?.replace(/^@/, '') || null
  if (novoTom !== undefined && identidade.tom_editado) mudancas.tom_de_voz = novoTom
  if (Array.isArray(c.hashtags_fixas))
    mudancas.hashtags_fixas = c.hashtags_fixas
      .filter((h): h is string => typeof h === 'string')
      .map((h) => h.trim())
      .filter(Boolean)
      .map((h) => (h.startsWith('#') ? h : `#${h}`))
      .slice(0, 30)
  if (c.aviso_final !== undefined) mudancas.aviso_final = texto(c.aviso_final, 500) || null
  const checklist = texto(c.checklist_revisor, 8000)
  if (checklist !== undefined) mudancas.checklist_revisor = checklist

  const { data, error } = await db.from('marcas').update(mudancas).eq('id', atual.id).select(CAMPOS_PERFIL).single()
  if (error || !data) throw new Error(error?.message ?? 'Não consegui salvar a marca')
  return res.json({ marca: sem(completarMarca(data)) })
}
