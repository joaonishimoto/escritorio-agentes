// Métricas do Instagram dos posts publicados (o app busca na Meta a cada 6 horas; aqui só lê).
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface Metricas {
  post_id: string
  alcance: number | null
  visualizacoes: number | null
  curtidas: number | null
  comentarios: number | null
  salvos: number | null
  compartilhamentos: number | null
  atualizado_em: string
}

/** Métricas dos posts pedidos, por id. Fica vazio se a tabela ainda não existe ou não há dados. */
export function useMetricas(postIds: string[]) {
  const [porPost, setPorPost] = useState<Record<string, Metricas>>({})
  const chave = [...postIds].sort().join(',')
  useEffect(() => {
    if (!supabase || !chave) return setPorPost({})
    let vivo = true
    supabase
      .from('metricas')
      .select('post_id, alcance, visualizacoes, curtidas, comentarios, salvos, compartilhamentos, atualizado_em')
      .in('post_id', chave.split(','))
      .then(({ data, error }) => {
        if (!vivo) return
        setPorPost(error ? {} : Object.fromEntries(((data as Metricas[]) ?? []).map((m) => [m.post_id, m])))
      })
    return () => {
      vivo = false
    }
  }, [chave])
  return porPost
}

const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
export const numero = (n: number | null | undefined) => (n == null ? '—' : compacto.format(n))

/** Resumo curto para listas: "1,2 mil alcance · 34 salvos". */
export function resumoMetricas(m: Metricas | undefined) {
  if (!m || m.alcance == null) return null
  return `${numero(m.alcance)} de alcance · ${numero(m.salvos ?? 0)} salvos`
}
