import { z } from 'zod'
import { gerarJson } from '../claude.js'
import { sistemaDoAgente } from '../contexto.js'
import { db } from '../db.js'
import { publicarCarrossel } from '../instagram.js'
import { USO_ZERO, type Agente } from './tipos.js'

// ───────── Publicador (sem IA) ─────────
export const publicador: Agente = async (ctx, _passo, em) => {
  await em.inicio('Preparando a publicação')
  const { marca, post } = ctx
  if (!marca.instagram_conta_id || !marca.meta_token_secret_id) {
    throw new Error(`A marca ${marca.nome} ainda não tem conta do Instagram conectada (id da conta e token).`)
  }
  const { data: token, error } = await db.rpc('ler_token_meta', { p_marca: marca.id })
  if (error || !token) throw new Error('Não consegui ler o token da Meta no Vault')

  const { mediaId, permalink } = await publicarCarrossel({
    contaId: marca.instagram_conta_id,
    token: token as string,
    imagens: post.slides.sort((a, b) => a.ordem - b.ordem).map((s) => s.url),
    legenda: post.legenda ?? '',
    aoProgredir: (m) => em.acao(m),
  })
  await db
    .from('posts')
    .update({ status: 'publicado', instagram_media_id: mediaId, publicado_em: new Date().toISOString() })
    .eq('id', post.id)
  await em.texto(permalink)
  return { saida: { mediaId, permalink }, uso: USO_ZERO, entrega: 'Publicado no Instagram', proximos: null, para: 'voce' }
}

// ───────── Curador ─────────
const Curadoria = z.object({
  regras: z.array(
    z.object({
      agente: z.enum(['chefe', 'pesquisador', 'redator', 'designer', 'revisor', 'publicador', 'todos']),
      regra: z.string().describe('curta e verificável, no imperativo'),
      motivo: z.string(),
    }),
  ),
  refazer_a_partir_de: z
    .enum(['chefe', 'pesquisador', 'redator', 'designer', 'nenhum'])
    .describe('primeiro agente que precisa refazer para atender a correção'),
  instrucao: z.string().describe('o que esse agente deve mudar, em uma ou duas frases'),
})

export const curador: Agente = async (ctx, passo, em) => {
  const comentario = String(passo.entrada.comentario ?? '')
  const reprovado = passo.entrada.acao === 'reprovar'
  await em.inicio('Transformando sua correção em regra')
  const { dados, uso } = await gerarJson({
    modelo: 'claude-haiku-5-5',
    sistema: sistemaDoAgente(
      ctx,
      'curador',
      'Você transforma a correção do dono da marca em regras curtas e verificáveis para a equipe não repetir o erro. Não duplique regras que já existem; se uma regra parecida existe, não crie outra.',
    ),
    conteudo: `Pedido original: ${ctx.post.briefing}\n\nLegenda atual:\n${ctx.post.legenda ?? ''}\n\nCorreção do dono da marca:\n${comentario}`,
    schema: Curadoria,
  })

  if (dados.regras.length) {
    await db.from('regras').insert(
      dados.regras.map((r) => ({
        marca_id: ctx.marca.id,
        agente: r.agente,
        regra: r.regra,
        motivo: r.motivo,
        origem_correcao: comentario,
        status: 'proposta',
        post_id: ctx.post.id,
      })),
    )
  }
  await em.texto(dados.regras.map((r) => `[${r.agente}] ${r.regra}`).join('\n') || 'Nenhuma regra nova.')

  if (reprovado || dados.refazer_a_partir_de === 'nenhum') {
    if (!reprovado) await db.from('posts').update({ status: 'aguardando_aprovacao' }).eq('id', ctx.post.id)
    return { saida: dados, uso, entrega: `${dados.regras.length} regra(s) proposta(s) para você aceitar`, proximos: null, para: 'voce' }
  }
  await db.from('posts').update({ status: 'em_producao', voltas_revisao: 0 }).eq('id', ctx.post.id)
  return {
    saida: dados,
    uso,
    entrega: `Correção repassada ao ${dados.refazer_a_partir_de}`,
    proximos: [{ agente: dados.refazer_a_partir_de, entrada: { feedback: `Correção do dono da marca: ${comentario}\n${dados.instrucao}` } }],
  }
}
