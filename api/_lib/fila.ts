import { waitUntil } from '@vercel/functions'
import { chefe, cinegrafista, criativos, designer, narrador, pesquisador, redator, revisor } from './agentes/producao.js'
import { curador, publicador } from './agentes/pos.js'
import { ErroRetomavel } from './agentes/tipos.js'
import type { Agente } from './agentes/tipos.js'
import { eAnuncio } from './anuncio.js'
import { carregarContexto, fluxoDeProducao, pulaRevisor, type Passo } from './contexto.js'
import { db } from './db.js'
import { Emissor } from './eventos.js'
import { medir, type Medicao } from './gastos.js'
import { passouDoTeto, tetoDaMarca } from './teto.js'
import { eErroTransitorio, MAX_TENTATIVAS } from './transitorio.js'

const AGENTES: Record<string, Agente> = { chefe, pesquisador, redator, designer, criativos, cinegrafista, narrador, revisor, publicador, curador }

/** Põe um agente na fila do post, com a próxima `ordem` (o gatilho `passos_ordem` no banco faz o mesmo se ela vier vazia). */
export async function enfileirar(postId: string, agente: string, entrada: Record<string, unknown> = {}) {
  const { data: ultimo } = await db.from('passos').select('ordem').eq('post_id', postId).order('ordem', { ascending: false }).limit(1).maybeSingle()
  const { error } = await db.from('passos').insert({ post_id: postId, agente, ordem: (ultimo?.ordem ?? 0) + 1, entrada })
  if (error) throw new Error(`Falha ao enfileirar ${agente}: ${error.message}`)
}


/** Dispara o executor sem esperar a resposta (a função continua viva até o fetch sair). */
export function acordarExecutor(origem: string) {
  waitUntil(
    fetch(`${origem}/api/executar`, { method: 'POST', headers: { 'x-executor-secret': process.env.EXECUTOR_SECRET ?? '' } }).catch((e) =>
      console.error('não consegui acordar o executor', e),
    ),
  )
}

/** Roda um passo da fila. Devolve false se a fila estava vazia. */
export async function rodarUmPasso(): Promise<boolean> {
  const { data, error } = await db.rpc('pegar_proximo_passo')
  if (error) throw new Error(`Fila: ${error.message}`)
  const passo = data as Passo | null
  if (!passo?.id) return false

  const em = new Emissor(passo.post_id, passo.agente)
  // o que este passo já gastou em tentativas anteriores (instabilidade, render que caiu) continua na conta
  const jaGasto = { custo_usd: Number(passo.custo_usd ?? 0), tokens_entrada: Number(passo.tokens_entrada ?? 0), tokens_saida: Number(passo.tokens_saida ?? 0) }
  let gasto: Medicao | null = null
  try {
    const agente = AGENTES[passo.agente]
    if (!agente) throw new Error(`Agente desconhecido: ${passo.agente}`)
    const ctx = await carregarContexto(passo.post_id)
    const medido = await medir(() => agente(ctx, passo, em))
    gasto = medido.gasto
    if (!medido.ok) throw medido.erro
    const r = medido.valor
    // vale o maior: o medidor pega o que o agente pagou e não somou (uma tentativa que falhou dentro dele)
    const desta = {
      custo_usd: Math.max(gasto.custo_usd, r.uso.custo_usd),
      tokens_entrada: Math.max(gasto.tokens_entrada, r.uso.tokens_entrada),
      tokens_saida: Math.max(gasto.tokens_saida, r.uso.tokens_saida),
    }
    gasto = null

    await atualizarPasso(passo.id, {
        status: 'feito',
        saida: r.saida,
        tokens_entrada: jaGasto.tokens_entrada + desta.tokens_entrada,
        tokens_saida: jaGasto.tokens_saida + desta.tokens_saida,
        custo_usd: jaGasto.custo_usd + desta.custo_usd,
        ...(medido.gasto.modelos.length ? { modelos: medido.gasto.modelos } : {}),
        terminado_em: new Date().toISOString(),
      })
    const custoDoPost = Number(ctx.post.custo_usd) + desta.custo_usd
    await db.from('posts').update({ custo_usd: custoDoPost }).eq('id', ctx.post.id)

    let proximos = r.proximos
    if (proximos === undefined) {
      // numa devolução do revisor a rota diz quem ainda refaz; sem rota, segue o fluxo do roteiro
      const { correcao, feedback, rota } = passo.entrada as { correcao?: unknown; feedback?: string; rota?: unknown }
      const fluxo = fluxoDeProducao(ctx.etapas, ctx.post.formato, eAnuncio(ctx.post))
      const naRota = Array.isArray(rota) && rota.length ? (rota as string[]) : null
      let seguinte: string | undefined = naRota ? naRota[0] : fluxo[fluxo.indexOf(passo.agente) + 1]
      // sem revisor neste post: o que ficou pronto vai direto para a sua mesa
      if (seguinte === 'revisor' && pulaRevisor(ctx.post)) {
        seguinte = undefined
        await db.from('posts').update({ status: 'aguardando_aprovacao' }).eq('id', ctx.post.id).eq('status', 'em_producao')
      }
      // numa correção sua ou numa devolução do revisor, os próximos agentes continuam sabendo o que foi pedido
      const entrada: Record<string, unknown> = {}
      if (correcao) entrada.correcao = correcao
      if (feedback && seguinte !== 'revisor') entrada.feedback = feedback
      if (naRota && naRota.length > 1) entrada.rota = naRota.slice(1)
      proximos = seguinte ? [{ agente: seguinte, entrada }] : null
    }
    const teto = tetoDaMarca(ctx.marca.identidade)
    if (passouDoTeto({ agente: passo.agente, proximo: proximos?.[0]?.agente, custoDoPost, teto })) {
      // para a produção e manda o que tiver para você decidir, em vez de seguir gastando
      const temSlides = (ctx.post.slides ?? []).length > 0 || Array.isArray((r.saida as { slides?: unknown[] })?.slides)
      await db.from('posts').update({ status: temSlides ? 'aguardando_aprovacao' : 'erro' }).eq('id', ctx.post.id)
      await em.entrega(r.para ?? proximos?.[0]?.agente ?? 'voce', r.entrega, r.uso.custo_usd)
      const msg = `Parei: o post chegou a US$ ${custoDoPost.toFixed(2)} e o teto por post desta marca é US$ ${teto.post!.toFixed(2)}. ${temSlides ? 'Mandei como está para você decidir.' : 'Ainda não tem slides; aumente o teto no perfil da marca e peça de novo.'}`
      if (temSlides) await new Emissor(passo.post_id, 'revisor').entrega('voce', msg)
      else await em.erro(msg)
      return true
    }
    for (const p of proximos ?? []) await enfileirar(passo.post_id, p.agente, p.entrada)
    await em.entrega(r.para ?? proximos?.[0]?.agente ?? 'voce', r.entrega, r.uso.custo_usd)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`passo ${passo.id} (${passo.agente}) falhou (tentativa ${passo.tentativas})`, e)
    // o que a tentativa gastou antes de falhar foi cobrado: fica no passo e no post
    const perdido = gasto ? await guardarGastoDaFalha(passo, jaGasto, gasto) : {}
    // o que já estava pronto fica no registro do passo e entra na próxima tentativa
    const guardar = e instanceof ErroRetomavel ? e.saida : {}
    const entrada = e instanceof ErroRetomavel ? { ...passo.entrada, ...e.entrada } : passo.entrada
    // o publicador não repete sozinho: uma falha de rede depois de publicar faria o post sair duas vezes
    if (passo.agente !== 'publicador' && eErroTransitorio(msg) && passo.tentativas < MAX_TENTATIVAS) {
      // espera um pouco (mais a cada tentativa) e devolve o mesmo passo para a fila; o escritório avisa
      const espera = 5_000 * passo.tentativas
      await em.acao(`Instabilidade no serviço, tentando de novo em ${Math.round(espera / 1000)} s (${passo.tentativas + 1}ª de ${MAX_TENTATIVAS})`)
      await new Promise((ok) => setTimeout(ok, espera))
      const { error } = await atualizarPasso(passo.id, { status: 'pendente', entrada, saida: { erro_anterior: msg, ...guardar }, ...perdido }, 'rodando')
      if (!error) return true
    }
    await atualizarPasso(passo.id, { status: 'falhou', entrada, saida: { erro: msg, ...guardar }, ...perdido, terminado_em: new Date().toISOString() })
    await db.from('posts').update({ status: 'erro' }).eq('id', passo.post_id)
    await em.erro(msg.slice(0, 300))
  }
  return true
}

/** Atualiza o passo; num banco ainda sem a coluna `modelos`, grava sem ela em vez de deixar o passo preso. */
async function atualizarPasso(id: string, campos: Record<string, unknown>, statusAtual?: string) {
  const gravar = (c: Record<string, unknown>) => {
    const q = db.from('passos').update(c).eq('id', id)
    return statusAtual ? q.eq('status', statusAtual) : q
  }
  const r = await gravar(campos)
  if (r.error && 'modelos' in campos && /modelos/.test(r.error.message)) {
    const sem = { ...campos }
    delete sem.modelos
    return gravar(sem)
  }
  return r
}

/** Soma ao post o que uma tentativa que falhou gastou; devolve os campos do passo com o gasto acumulado. */
async function guardarGastoDaFalha(passo: Passo, jaGasto: { custo_usd: number; tokens_entrada: number; tokens_saida: number }, gasto: Medicao) {
  if (gasto.custo_usd <= 0 && gasto.tokens_entrada <= 0) return {}
  const { data: post } = await db.from('posts').select('custo_usd').eq('id', passo.post_id).maybeSingle()
  if (post) await db.from('posts').update({ custo_usd: Number(post.custo_usd ?? 0) + gasto.custo_usd }).eq('id', passo.post_id)
  return {
    custo_usd: jaGasto.custo_usd + gasto.custo_usd,
    tokens_entrada: jaGasto.tokens_entrada + gasto.tokens_entrada,
    tokens_saida: jaGasto.tokens_saida + gasto.tokens_saida,
    ...(gasto.modelos.length ? { modelos: gasto.modelos } : {}),
  }
}

/** Roda passos seguidos enquanto houver fila e tempo (para caber nos 300 s da função com folga). */
export async function rodarAteOLimite(limiteMs = 120_000) {
  const inicio = Date.now()
  let rodou = 0
  while (Date.now() - inicio < limiteMs) {
    if (!(await rodarUmPasso())) return { rodou, sobrou: false }
    rodou++
  }
  return { rodou, sobrou: true }
}
