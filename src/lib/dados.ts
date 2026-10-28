import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useEscritorio, type Evento } from '../store/escritorio'

export interface Marca {
  id: string
  nome: string
  identidade?: Record<string, unknown> | null
  instagram_conta_id?: string | null
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
  /** Reel: vídeo gerado na Kling */
  video?: { url: string; segundos: number } | null
  custo_usd: number
  agendado_para: string | null
  /** escolhas do Novo post; agendar_para pré-preenche o horário na aprovação */
  preferencias?: { formato?: string; estrutura?: string; layout?: string; voz?: string; slides?: number; agendar_para?: string } | null
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
export function useMarcas(ativo: boolean, versao = 0) {
  const [marcas, setMarcas] = useState<Marca[] | null>(null)
  useEffect(() => {
    if (!supabase || !ativo) return
    supabase
      .from('marcas')
      .select('id, nome, identidade, instagram_conta_id')
      .order('criado_em')
      .then(({ data }) => setMarcas(data ?? []))
  }, [ativo, versao])
  return marcas
}

export function usePosts(marcaId: string | null, recarregar: number) {
  const [posts, setPosts] = useState<Post[]>([])
  useEffect(() => {
    // trocou de marca: some a lista da anterior na hora
    setPosts((atual) => (atual.length && atual[0].marca_id !== marcaId ? [] : atual))
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
  const anterior = useRef<string | null>(null)

  useEffect(() => {
    const tinha = anterior.current
    anterior.current = postId
    if (!supabase) return
    if (!postId) {
      // fechou o post (ex.: abriu uma marca nova): ninguém trabalhando e nada do post anterior na tela
      setPost(null)
      if (tinha) reiniciar()
      return
    }
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

/** Para os quadros da parede de cada sala: dias deste mês com post agendado ou publicado e quantas regras estão ativas. */
export function useQuadrosDoAndar(marcaIds: string[], recarregar: number) {
  const [quadros, setQuadros] = useState<Record<string, { dias: number[]; regras: number }>>({})
  const chave = marcaIds.join(',')
  useEffect(() => {
    if (!supabase || !marcaIds.length) return
    const hoje = new Date()
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1).toISOString()
    Promise.all([
      supabase
        .from('posts')
        .select('marca_id, status, agendado_para, publicado_em')
        .in('marca_id', marcaIds)
        .or(`and(agendado_para.gte.${inicio},agendado_para.lt.${fim}),and(publicado_em.gte.${inicio},publicado_em.lt.${fim})`),
      supabase.from('regras').select('marca_id').in('marca_id', marcaIds).eq('status', 'ativa'),
    ]).then(([posts, regras]) => {
      const novo: Record<string, { dias: number[]; regras: number }> = Object.fromEntries(marcaIds.map((id) => [id, { dias: [], regras: 0 }]))
      for (const p of posts.data ?? []) {
        const data = p.status === 'publicado' ? p.publicado_em : p.agendado_para
        if (data && novo[p.marca_id]) novo[p.marca_id].dias.push(new Date(data).getDate())
      }
      for (const r of regras.data ?? []) if (novo[r.marca_id]) novo[r.marca_id].regras++
      setQuadros(novo)
    })
  }, [chave, recarregar]) // eslint-disable-line react-hooks/exhaustive-deps
  return quadros
}

/** Todas as regras da marca que não foram arquivadas: as ativas e as que o curador propôs. */
export function useRegrasDaMarca(marcaId: string | null, recarregar: number) {
  const [regras, setRegras] = useState<Regra[] | null>(null)
  useEffect(() => {
    if (!supabase || !marcaId) return
    supabase
      .from('regras')
      .select('id, agente, regra, motivo, status')
      .eq('marca_id', marcaId)
      .neq('status', 'arquivada')
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
  porAgente: { agente: string; custo: number; segundos: number }[]
  /** da criação do post até ele chegar na sua mesa; null se ainda não chegou */
  ateVoceSeg: number | null
  /** soma do tempo em que algum agente estava trabalhando */
  trabalhandoSeg: number
  /** quando o post foi criado (para contar o tempo ao vivo enquanto não chega) */
  criadoEm: string | null
}

/** Quanto já foi gasto: no post aberto (por agente) e no mês, somando todos os posts da marca. */
export function useCustos(marcaId: string | null, postId: string | null, custoDoPost: number | undefined, status?: string) {
  const [custos, setCustos] = useState<Custos | null>(null)
  useEffect(() => {
    if (!supabase || !marcaId) return
    const sb = supabase
    const inicioDoMes = new Date()
    inicioDoMes.setDate(1)
    inicioDoMes.setHours(0, 0, 0, 0)
    const vazio = Promise.resolve({ data: [] as unknown[] })
    Promise.all([
      sb.from('posts').select('custo_usd').eq('marca_id', marcaId).gte('criado_em', inicioDoMes.toISOString()),
      postId ? sb.from('passos').select('agente, custo_usd, iniciado_em, terminado_em').eq('post_id', postId) : vazio,
      postId ? sb.from('posts').select('criado_em').eq('id', postId).maybeSingle() : Promise.resolve({ data: null }),
      // primeira vez que o post chegou na sua mesa (pasta do revisor para você)
      postId
        ? sb.from('eventos').select('criado_em').eq('post_id', postId).eq('tipo', 'entrega').eq('para', 'voce').eq('agente', 'revisor').order('criado_em').limit(1)
        : vazio,
    ]).then(([mes, passos, post, chegou]) => {
      const seg = (a?: string | null, b?: string | null) => (a && b ? Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 1000) : 0)
      const soma = new Map<string, { custo: number; segundos: number }>()
      for (const p of (passos.data ?? []) as { agente: string; custo_usd: number; iniciado_em: string | null; terminado_em: string | null }[]) {
        const atual = soma.get(p.agente) ?? { custo: 0, segundos: 0 }
        soma.set(p.agente, { custo: atual.custo + Number(p.custo_usd), segundos: atual.segundos + seg(p.iniciado_em, p.terminado_em) })
      }
      const lista = (mes.data ?? []) as { custo_usd: number }[]
      const criadoEm = (post.data as { criado_em: string } | null)?.criado_em ?? null
      const chegada = ((chegou.data ?? []) as { criado_em: string }[])[0]?.criado_em
      setCustos({
        post: Number(custoDoPost ?? 0),
        mes: lista.reduce((s, p) => s + Number(p.custo_usd), 0),
        postsNoMes: lista.length,
        porAgente: [...soma].map(([agente, v]) => ({ agente, ...v })).sort((a, b) => b.custo - a.custo),
        ateVoceSeg: chegada && criadoEm ? seg(criadoEm, chegada) : null,
        trabalhandoSeg: [...soma.values()].reduce((s, v) => s + v.segundos, 0),
        criadoEm,
      })
    })
  }, [marcaId, postId, custoDoPost, status])
  return custos
}
