import type { VercelRequest, VercelResponse } from '@vercel/node'
import { gerarJson } from './_lib/claude.js'
import { db, usuarioDaRequisicao } from './_lib/db.js'
import { rota } from './_lib/http.js'
import { completarMarca } from './_lib/marcas/index.js'
import { AGENTES_DE_REGRA, Juntadas, montarProposta, pedidoDeJuntar, SISTEMA_JUNTAR, type RegraAntiga } from './_lib/regras.js'
import { gastoDoMes } from './_lib/teto.js'

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
  if (corpo.acao === 'juntar_regras' || corpo.acao === 'aplicar_regras') return juntarRegras(res, usuario, req.body)

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
const PROTEGIDAS = ['instagram', 'instagram_conectado_em', 'instagram_token', 'neutra', 'tom_editado', 'sala', 'posicao']

/** Perfil da marca para editar no app: lê o que os agentes usam de verdade e salva o que o dono mudou. */
async function perfil(res: VercelResponse, usuario: string, corpo: { acao?: string; id?: string; campos?: Record<string, unknown> }) {
  const { data: atual } = await db.from('marcas').select(CAMPOS_PERFIL).eq('id', corpo.id ?? '').eq('dono_id', usuario).maybeSingle()
  if (!atual) return res.status(404).json({ erro: 'Marca não encontrada' })
  const sem = (m: typeof atual) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'modelo_slides_html')) as Omit<typeof atual, 'modelo_slides_html'>

  if (corpo.acao === 'ler') return res.json({ marca: sem(completarMarca(atual)), gasto_mes: await gastoDoMes(atual.id) })

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

/** Regras ativas de um agente da marca, da mais antiga para a mais recente. */
async function regrasAtivas(marcaId: string, agente: string) {
  const { data, error } = await db.from('regras').select('id, regra, motivo').eq('marca_id', marcaId).eq('agente', agente).eq('status', 'ativa').order('criado_em')
  if (error) throw new Error(error.message)
  return (data ?? []) as RegraAntiga[]
}

/**
 * Mural de regras: `juntar_regras` pede ao modelo uma lista menor (não muda nada no banco);
 * `aplicar_regras` grava o que o dono confirmou: as novas entram ativas e as substituídas vão para o arquivo.
 */
async function juntarRegras(res: VercelResponse, usuario: string, corpo: { acao?: string; id?: string; agente?: string; novas?: unknown }) {
  const { data: marca } = await db.from('marcas').select('id').eq('id', corpo.id ?? '').eq('dono_id', usuario).maybeSingle()
  if (!marca) return res.status(404).json({ erro: 'Marca não encontrada' })
  const agente = corpo.agente ?? ''
  if (!(AGENTES_DE_REGRA as readonly string[]).includes(agente)) return res.status(400).json({ erro: 'Agente desconhecido' })
  const atuais = await regrasAtivas(marca.id, agente)

  if (corpo.acao === 'juntar_regras') {
    if (atuais.length < 2) return res.json({ proposta: { novas: [], ficam: atuais.map((r) => r.id) }, custo_usd: 0 })
    const { dados, uso } = await gerarJson({
      modelo: 'claude-sonnet-5-5',
      effort: 'low',
      sistema: SISTEMA_JUNTAR,
      conteudo: pedidoDeJuntar(agente, atuais),
      schema: Juntadas,
    })
    return res.json({ proposta: montarProposta(atuais, dados), custo_usd: uso.custo_usd })
  }

  const ids = new Set(atuais.map((r) => r.id))
  const novas = (Array.isArray(corpo.novas) ? corpo.novas : [])
    .map((n) => n as { regra?: unknown; motivo?: unknown; substitui?: unknown })
    .map((n) => ({
      regra: typeof n.regra === 'string' ? n.regra.trim().slice(0, 600) : '',
      motivo: typeof n.motivo === 'string' ? n.motivo.trim().slice(0, 300) : '',
      substitui: Array.isArray(n.substitui) ? n.substitui.filter((id): id is string => typeof id === 'string' && ids.has(id)) : [],
    }))
    .filter((n) => n.regra && n.substitui.length)
  // alguma regra mudou no meio do caminho (arquivada em outra aba): melhor pedir de novo
  if (!novas.length) return res.status(409).json({ erro: 'As regras mudaram. Peça para juntar de novo.' })

  const { error: erroNovas } = await db
    .from('regras')
    .insert(novas.map((n) => ({ marca_id: marca.id, agente, regra: n.regra, motivo: n.motivo || null, origem_correcao: 'Juntada no mural de regras', status: 'ativa' })))
  if (erroNovas) throw new Error(erroNovas.message)
  const arquivar = [...new Set(novas.flatMap((n) => n.substitui))]
  const { error } = await db.from('regras').update({ status: 'arquivada' }).in('id', arquivar)
  if (error) throw new Error(error.message)
  return res.json({ criadas: novas.length, arquivadas: arquivar.length })
}
