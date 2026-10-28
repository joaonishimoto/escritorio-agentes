import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useEscritorio, type Evento } from '../store/escritorio'

export interface Marca {
  id: string
  nome: string
}

export interface Post {
  id: string
  marca_id: string
  briefing: string
  status: string
  legenda: string | null
  slides: { ordem: number; url: string }[]
  custo_usd: number
  criado_em: string
}

export interface Regra {
  id: string
  agente: string
  regra: string
  motivo: string | null
  status: 'proposta' | 'ativa' | 'arquivada'
}

export function useMarcas(ativo: boolean) {
  const [marcas, setMarcas] = useState<Marca[]>([])
  useEffect(() => {
    if (!supabase || !ativo) return
    supabase
      .from('marcas')
      .select('id, nome')
      .order('criado_em')
      .then(({ data }) => setMarcas(data ?? []))
  }, [ativo])
  return marcas
}

export function usePosts(marcaId: string | null, recarregar: number) {
  const [posts, setPosts] = useState<Post[]>([])
  useEffect(() => {
    if (!supabase || !marcaId) return
    supabase
      .from('posts')
      .select('*')
      .eq('marca_id', marcaId)
      .order('criado_em', { ascending: false })
      .limit(20)
      .then(({ data }) => setPosts((data as Post[]) ?? []))
  }, [marcaId, recarregar])
  return posts
}

/** Acompanha um post: reconstrói o escritório com os eventos já gravados e assina os novos. */
export function usePostAoVivo(postId: string | null) {
  const [post, setPost] = useState<Post | null>(null)
  const aplicar = useEscritorio((s) => s.aplicar)
  const reiniciar = useEscritorio((s) => s.reiniciar)

  useEffect(() => {
    if (!supabase || !postId) return
    const sb = supabase
    let ativo = true
    reiniciar()

    sb.from('posts')
      .select('*')
      .eq('id', postId)
      .single()
      .then(({ data }) => ativo && setPost(data as Post))
    sb.from('eventos')
      .select('*')
      .eq('post_id', postId)
      .order('criado_em')
      .then(({ data }) => {
        if (!ativo) return
        for (const e of (data as Evento[]) ?? []) aplicar(e, false)
      })

    const canal = sb
      .channel(`post:${postId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'eventos', filter: `post_id=eq.${postId}` }, (p) =>
        aplicar(p.new as Evento),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts', filter: `id=eq.${postId}` }, (p) =>
        setPost(p.new as Post),
      )
      .subscribe()

    return () => {
      ativo = false
      sb.removeChannel(canal)
    }
  }, [postId, aplicar, reiniciar])

  return post
}

export function useRegrasPropostas(marcaId: string | null, recarregar: number) {
  const [regras, setRegras] = useState<Regra[]>([])
  useEffect(() => {
    if (!supabase || !marcaId) return
    supabase
      .from('regras')
      .select('id, agente, regra, motivo, status')
      .eq('marca_id', marcaId)
      .eq('status', 'proposta')
      .order('criado_em')
      .then(({ data }) => setRegras((data as Regra[]) ?? []))
  }, [marcaId, recarregar])
  return regras
}

export async function decidirRegra(id: string, status: 'ativa' | 'arquivada') {
  await supabase?.from('regras').update({ status }).eq('id', id)
}
