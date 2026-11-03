import { AsyncLocalStorage } from 'node:async_hooks'
import type { Uso } from './claude.js'
import { db } from './db.js'

// O medidor de gastos: toda chamada paga (Claude, OpenRouter, imagem, vídeo) anota aqui o que custou,
// na hora em que a resposta chega. Assim o que deu erro no meio do caminho também entra na conta,
// e o Financeiro mostra o que a conta das IAs vai cobrar, não só o que terminou bem.

export interface Medicao {
  custo_usd: number
  tokens_entrada: number
  tokens_saida: number
  /** quais IAs foram usadas, na ordem em que apareceram */
  modelos: string[]
}

const medidor = new AsyncLocalStorage<Medicao>()

const vazia = (): Medicao => ({ custo_usd: 0, tokens_entrada: 0, tokens_saida: 0, modelos: [] })

/** Anota um gasto no medidor do trabalho atual (passo da fila ou pedido avulso). Fora de um medidor, não faz nada. */
export function anotarGasto(modelo: string, uso: Uso) {
  const m = medidor.getStore()
  if (!m) return
  m.custo_usd += uso.custo_usd
  m.tokens_entrada += uso.tokens_entrada
  m.tokens_saida += uso.tokens_saida
  if (!m.modelos.includes(modelo)) m.modelos.push(modelo)
}

/** Roda `fn` medindo tudo o que ela gastar. O gasto volta mesmo se `fn` falhar. */
export async function medir<T>(fn: () => Promise<T>): Promise<{ ok: true; valor: T; gasto: Medicao } | { ok: false; erro: unknown; gasto: Medicao }> {
  const gasto = vazia()
  try {
    const valor = await medidor.run(gasto, fn)
    return { ok: true, valor, gasto }
  } catch (erro) {
    return { ok: false, erro, gasto }
  }
}

/** De onde veio um gasto fora dos posts (aparece no Financeiro com este nome). */
export type OrigemGasto = 'ideias' | 'pedido_avulso' | 'plano' | 'outra_ideia' | 'juntar_regras' | 'memoria' | 'financeiro'

/**
 * Gasto fora da produção de um post (ideias, pedidos avulsos, plano editorial, mural de regras, memória, análise do
 * Financeiro): roda medindo e guarda na tabela `gastos`, mesmo se der erro. Sem a tabela no banco, só avisa no log.
 */
export async function comGasto<T>(quem: { dono_id: string; marca_id?: string | null; origem: OrigemGasto; descricao?: string }, fn: () => Promise<T>): Promise<T> {
  const r = await medir(fn)
  if (r.gasto.custo_usd > 0 || r.gasto.tokens_entrada > 0) {
    const { error } = await db.from('gastos').insert({
      dono_id: quem.dono_id,
      marca_id: quem.marca_id ?? null,
      origem: quem.origem,
      descricao: quem.descricao?.slice(0, 200) ?? null,
      modelos: r.gasto.modelos,
      tokens_entrada: r.gasto.tokens_entrada,
      tokens_saida: r.gasto.tokens_saida,
      custo_usd: r.gasto.custo_usd,
      deu_erro: !r.ok,
    })
    if (error) console.error('não consegui guardar o gasto avulso', error.message)
  }
  if (!r.ok) throw r.erro
  return r.valor
}
