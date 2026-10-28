import { waitUntil } from '@vercel/functions'
import { chefe, cinegrafista, designer, narrador, pesquisador, redator, revisor } from './agentes/producao.js'
import { curador, publicador } from './agentes/pos.js'
import type { Agente } from './agentes/tipos.js'
import { carregarContexto, fluxoDeProducao, type Passo } from './contexto.js'
import { db } from './db.js'
import { Emissor } from './eventos.js'

const AGENTES: Record<string, Agente> = { chefe, pesquisador, redator, designer, cinegrafista, narrador, revisor, publicador, curador }

/** Põe um agente na fila do post. A `ordem` é o banco que dá (gatilho em passos), para dois passos juntos não repetirem o número. */
export async function enfileirar(postId: string, agente: string, entrada: Record<string, unknown> = {}) {
  const { error } = await db.from('passos').insert({ post_id: postId, agente, entrada })
  if (error) throw new Error(`Falha ao enfileirar ${agente}: ${error.message}`)
}

// Instabilidade passageira (IA sobrecarregada, limite de taxa, rede, navegador que caiu): o passo volta para a fila
// em vez de parar o post. Erro de verdade (chave errada, sem crédito, conteúdo recusado) não entra aqui.
const TRANSITORIO = /overloaded|sobrecarreg|rate.?limit|too many requests|\b(429|500|502|503|504|529)\b|timeout|timed out|demorou demais|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|fetch failed|network|browser has been closed|target page, context or browser|internal server error/i
const MAX_TENTATIVAS = 3

export const eErroTransitorio = (msg: string) => TRANSITORIO.test(msg) && !/sem cr[ée]ditos|sem saldo|saldo insuficiente|recusou a chave|falta configurar/i.test(msg)

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
      const fluxo = fluxoDeProducao(ctx.etapas, ctx.post.formato)
      const seguinte = fluxo[fluxo.indexOf(passo.agente) + 1]
      // numa correção sua ou numa devolução do revisor, os próximos agentes continuam sabendo o que foi pedido
      const { correcao, feedback } = passo.entrada
      const entrada: Record<string, unknown> = {}
      if (correcao) entrada.correcao = correcao
      if (feedback && seguinte !== 'revisor') entrada.feedback = feedback
      proximos = seguinte ? [{ agente: seguinte, entrada }] : null
    }
    for (const p of proximos ?? []) await enfileirar(passo.post_id, p.agente, p.entrada)
    await em.entrega(r.para ?? proximos?.[0]?.agente ?? 'voce', r.entrega, r.uso.custo_usd)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`passo ${passo.id} (${passo.agente}) falhou (tentativa ${passo.tentativas})`, e)
    if (eErroTransitorio(msg) && passo.tentativas < MAX_TENTATIVAS) {
      // espera um pouco (mais a cada tentativa) e devolve o mesmo passo para a fila; o escritório avisa
      const espera = 5_000 * passo.tentativas
      await em.acao(`Instabilidade no serviço, tentando de novo em ${Math.round(espera / 1000)} s (${passo.tentativas + 1}ª de ${MAX_TENTATIVAS})`)
      await new Promise((ok) => setTimeout(ok, espera))
      const { error } = await db.from('passos').update({ status: 'pendente', saida: { erro_anterior: msg } }).eq('id', passo.id).eq('status', 'rodando')
      if (!error) return true
    }
    await db.from('passos').update({ status: 'falhou', saida: { erro: msg }, terminado_em: new Date().toISOString() }).eq('id', passo.id)
    await db.from('posts').update({ status: 'erro' }).eq('id', passo.post_id)
    await em.erro(msg.slice(0, 300))
  }
  return true
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
