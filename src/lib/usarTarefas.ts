import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Tarefa } from './tarefas'

const CAMPOS = 'id, marca_id, titulo, topico, notas, prazo, importante, feita_em, criado_em'
// a tabela ainda não existe no banco (migração 20261102000100_tarefas.sql não aplicada)
const semTabela = (e: { code?: string; message?: string } | null) => !!e && (e.code === 'PGRST205' || e.code === '42P01' || /relation .*tarefas.* does not exist/i.test(e.message ?? ''))

export type NovaTarefa = Pick<Tarefa, 'titulo' | 'topico' | 'marca_id' | 'prazo' | 'importante'> & { notas?: string | null }

/** Suas tarefas: carregam uma vez ao entrar (são poucas) e cada mudança aparece na hora, antes do banco responder. */
export function useTarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [faltaTabela, setFaltaTabela] = useState(false)

  const carregar = useCallback(() => {
    if (!supabase) return
    supabase
      .from('tarefas')
      .select(CAMPOS)
      // as feitas há mais de 30 dias saem da lista
      .or(`feita_em.is.null,feita_em.gte.${new Date(Date.now() - 30 * 86_400_000).toISOString()}`)
      .order('criado_em', { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (semTabela(error)) {
          setFaltaTabela(true)
          setTarefas([])
        } else if (error) {
          setErro('Não consegui carregar suas tarefas.')
          setTarefas((t) => t ?? [])
        } else setTarefas(Array.isArray(data) ? (data as Tarefa[]) : [])
      })
  }, [])
  useEffect(carregar, [carregar])

  const falhou = (msg: string) => (e: { code?: string; message?: string } | null) => {
    if (semTabela(e)) setFaltaTabela(true)
    setErro(msg)
    carregar()
  }

  const criar = async (n: NovaTarefa) => {
    if (!supabase) return
    setErro(null)
    const provisoria: Tarefa = { id: `nova-${crypto.randomUUID()}`, notas: null, feita_em: null, criado_em: new Date().toISOString(), ...n }
    setTarefas((t) => [provisoria, ...(t ?? [])])
    const { data, error } = await supabase.from('tarefas').insert(n).select(CAMPOS).single()
    if (error || !data) return falhou('Não consegui guardar a tarefa. Tente de novo.')(error)
    setTarefas((t) => (t ?? []).map((x) => (x.id === provisoria.id ? (data as Tarefa) : x)))
  }

  const mudar = async (id: string, campos: Partial<Omit<Tarefa, 'id' | 'criado_em'>>) => {
    if (!supabase || id.startsWith('nova-')) return
    setErro(null)
    setTarefas((t) => (t ?? []).map((x) => (x.id === id ? { ...x, ...campos } : x)))
    const { error } = await supabase.from('tarefas').update(campos).eq('id', id)
    if (error) falhou('Não consegui salvar a mudança.')(error)
  }

  const apagar = async (id: string) => {
    if (!supabase || id.startsWith('nova-')) return
    setErro(null)
    setTarefas((t) => (t ?? []).filter((x) => x.id !== id))
    const { error } = await supabase.from('tarefas').delete().eq('id', id)
    if (error) falhou('Não consegui apagar a tarefa.')(error)
  }

  return { tarefas, erro, faltaTabela, criar, mudar, apagar, limparErro: () => setErro(null) }
}
