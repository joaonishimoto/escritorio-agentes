import { waitUntil } from '@vercel/functions'
import { chefe, designer, pesquisador, redator, revisor } from './agentes/producao.js'
import { curador, publicador } from './agentes/pos.js'
import type { Agente } from './agentes/tipos.js'
import { carregarContexto, fluxoDeProducao, type Passo } from './contexto.js'
import { db } from './db.js'
import { Emissor } from './eventos.js'

const AGENTES: Record<string, Agente> = { chefe, pesquisador, redator, designer, revisor, publicador, curador }

export async function enfileirar(postId: string, agente: string, entrada: Record<string, unknown> = {}) {
  const { count } = await db.from('passos').select('id', { count: 'exact', head: true }).eq('post_id', postId)
  const { error } = await db.from('passos').insert({ post_id: postId, agente, ordem: (count ?? 0) + 1, entrada })
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
  try {
    const agente = AGENTES[passo.agente]
    if (!agente) throw new Error(`Agente desconhecido: ${passo.agente}`)
    const ctx = await carregarContexto(passo.post_id)
    const r = await agente(ctx, passo, em)

    await db
      .from('passos')
      .update({
        status: 'feito',
        saida: r.saida,
        tokens_entrada: r.uso.tokens_entrada,
        tokens_saida: r.uso.tokens_saida,
        custo_usd: r.uso.custo_usd,
        terminado_em: new Date().toISOString(),
      })
      .eq('id', passo.id)
    await db.from('posts').update({ custo_usd: Number(ctx.post.custo_usd) + r.uso.custo_usd }).eq('id', ctx.post.id)

    let proximos = r.proximos
    if (proximos === undefined) {
      const fluxo = fluxoDeProducao(ctx.etapas)
      const seguinte = fluxo[fluxo.indexOf(passo.agente) + 1]
      proximos = seguinte ? [{ agente: seguinte }] : null
    }
    for (const p of proximos ?? []) await enfileirar(passo.post_id, p.agente, p.entrada)
    await em.entrega(r.para ?? proximos?.[0]?.agente ?? 'voce', r.entrega, r.uso.custo_usd)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`passo ${passo.id} (${passo.agente}) falhou`, e)
    await db.from('passos').update({ status: 'falhou', saida: { erro: msg }, terminado_em: new Date().toISOString() }).eq('id', passo.id)
    await db.from('posts').update({ status: 'erro' }).eq('id', passo.post_id)
    await em.erro(msg.slice(0, 300))
  }
  return true
}
