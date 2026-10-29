// Ideias de posts que o pesquisador sugeriu e você guardou para usar depois.
// Ficam na identidade da marca (campo `ideias_guardadas`), lidas na hora para não apagar o que mudou em outro lugar.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface Ideia {
  titulo: string
  formato: string
  gancho: string
  briefing: string
}

export interface IdeiaGuardada extends Ideia {
  id: string
  guardada_em: string
}

const CAMPO = 'ideias_guardadas'

function lista(identidade: unknown): IdeiaGuardada[] {
  const x = (identidade as Record<string, unknown> | null)?.[CAMPO]
  return Array.isArray(x) ? (x as IdeiaGuardada[]) : []
}

async function lerIdentidade(marcaId: string) {
  if (!supabase) throw new Error('Sem conexão com o banco')
  const { data, error } = await supabase.from('marcas').select('identidade').eq('id', marcaId).single()
  if (error) throw error
  return (data?.identidade as Record<string, unknown> | null) ?? {}
}

async function gravar(marcaId: string, identidade: Record<string, unknown>, ideias: IdeiaGuardada[]) {
  const nova: Record<string, unknown> = { ...identidade, [CAMPO]: ideias }
  if (!ideias.length) delete nova[CAMPO]
  const { error } = await supabase!.from('marcas').update({ identidade: nova }).eq('id', marcaId)
  if (error) throw error
  return ideias
}

export async function lerIdeiasGuardadas(marcaId: string) {
  return lista(await lerIdentidade(marcaId))
}

/** Guarda uma ideia (a mesma ideia, pelo briefing, não entra duas vezes). Devolve a lista nova. */
export async function guardarIdeia(marcaId: string, ideia: Ideia) {
  const identidade = await lerIdentidade(marcaId)
  const atuais = lista(identidade)
  if (atuais.some((i) => i.briefing === ideia.briefing)) return atuais
  const nova: IdeiaGuardada = { id: crypto.randomUUID(), titulo: ideia.titulo, formato: ideia.formato, gancho: ideia.gancho, briefing: ideia.briefing, guardada_em: new Date().toISOString() }
  return gravar(marcaId, identidade, [nova, ...atuais])
}

/** Tira uma ideia da lista (quando você usou ou desistiu dela). Devolve a lista nova. */
export async function tirarIdeia(marcaId: string, id: string) {
  const identidade = await lerIdentidade(marcaId)
  return gravar(marcaId, identidade, lista(identidade).filter((i) => i.id !== id))
}

/** As ideias guardadas de uma marca, com guardar e tirar já atualizando a lista. */
export function useIdeiasGuardadas(marcaId: string | null | undefined) {
  const [ideias, setIdeias] = useState<IdeiaGuardada[]>([])
  const [carregado, setCarregado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    setIdeias([])
    setCarregado(false)
    if (!marcaId || !supabase) return setCarregado(true)
    let vivo = true
    lerIdeiasGuardadas(marcaId)
      .then((x) => vivo && setIdeias(x))
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : 'Não deu para ler as ideias guardadas'))
      .finally(() => vivo && setCarregado(true))
    return () => {
      vivo = false
    }
  }, [marcaId])
  const guardar = useCallback(
    async (ideia: Ideia) => {
      if (!marcaId) return
      try {
        setIdeias(await guardarIdeia(marcaId, ideia))
        setErro(null)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não deu para guardar a ideia')
      }
    },
    [marcaId],
  )
  const tirar = useCallback(
    async (id: string) => {
      if (!marcaId) return
      try {
        setIdeias(await tirarIdeia(marcaId, id))
        setErro(null)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não deu para tirar a ideia')
      }
    },
    [marcaId],
  )
  const guardada = useCallback((ideia: Ideia) => ideias.find((i) => i.briefing === ideia.briefing), [ideias])
  return { ideias, carregado, erro, guardar, tirar, guardada }
}
