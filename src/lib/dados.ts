import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useEscritorio, type Evento } from '../store/escritorio'

export interface Marca {
  id: string
  nome: string
  identidade?: Record<string, unknown> | null
}

/** Cor que representa a marca no escritório: a escolhida na sala, senão a primeira cor da identidade visual. */
export function corDaMarca(m: Marca): string {
  const id = m.identidade ?? {}
  if (typeof id.cor_sala === 'string') return id.cor_sala
  const achar = (v: unknown): string | null => {
    if (typeof v === 'string') return /^#[0-9a-f]{6}$/i.test(v) ? v : null
    if (v && typeof v === 'object') for (const x of Object.values(v)) { const c = achar(x); if (c) return c }
    return null
  }
  return achar(id.cores) ?? achar(id) ?? '#2a5288'
}

/** Guarda a cor da sala na identidade da marca (o dono pode editar a própria marca). */
export async function salvarCorDaMarca(m: Marca, cor: string) {
  if (!supabase) return
  await supabase.from('marcas').update({ identidade: { ...(m.identidade ?? {}), cor_sala: cor } }).eq('id', m.id)
}

export interface Post {
  id: string
  marca_id: string
  briefing: string
  status: string
  legenda: string | null
  slides: { ordem: number; url: string }[]
  custo_usd: number
  agendado_para: string | null
  publicado_em: string | null
  criado_em: string
}

export interface Regra {
  id: string
  agente: string
  regra: string
  motivo: string | null
  status: 'proposta' | 'ativa' | 'arquivada'
}

/** Marcas da conta; `null` enquanto ainda não chegaram do banco. */
export function useMarcas(ativo: boolean) {
  const [marcas, setMarcas] = useState<Marca[] | null>(null)
  useEffect(() => {
    if (!supabase || !ativo) return
    supabase
      .from('marcas')
      .select('id, nome, identidade')
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
      .limit(100)
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

export interface Custos {
  post: number
  mes: number
  postsNoMes: number
  porAgente: { agente: string; custo: number }[]
}

/** Quanto já foi gasto: no post aberto (por agente) e no mês, somando todos os posts da marca. */
export function useCustos(marcaId: string | null, postId: string | null, custoDoPost: number | undefined) {
  const [custos, setCustos] = useState<Custos | null>(null)
  useEffect(() => {
    if (!supabase || !marcaId) return
    const sb = supabase
    const inicioDoMes = new Date()
    inicioDoMes.setDate(1)
    inicioDoMes.setHours(0, 0, 0, 0)
    Promise.all([
      sb.from('posts').select('custo_usd').eq('marca_id', marcaId).gte('criado_em', inicioDoMes.toISOString()),
      postId ? sb.from('passos').select('agente, custo_usd').eq('post_id', postId) : Promise.resolve({ data: [] }),
    ]).then(([mes, passos]) => {
      const soma = new Map<string, number>()
      for (const p of (passos.data ?? []) as { agente: string; custo_usd: number }[]) soma.set(p.agente, (soma.get(p.agente) ?? 0) + Number(p.custo_usd))
      const lista = (mes.data ?? []) as { custo_usd: number }[]
      setCustos({
        post: Number(custoDoPost ?? 0),
        mes: lista.reduce((s, p) => s + Number(p.custo_usd), 0),
        postsNoMes: lista.length,
        porAgente: [...soma].map(([agente, custo]) => ({ agente, custo })).sort((a, b) => b.custo - a.custo),
      })
    })
  }, [marcaId, postId, custoDoPost])
  return custos
}
