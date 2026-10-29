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

/** Guarda como o dono decorou a sala (e a cor dela) na identidade da marca. Lê a identidade na hora para não apagar o que mudou em outro lugar. */
export async function salvarSala(marcaId: string, sala: Record<string, unknown> | null, cor: string) {
  if (!supabase) return
  const { data, error } = await supabase.from('marcas').select('identidade').eq('id', marcaId).single()
  if (error) throw error
  const identidade: Record<string, unknown> = { ...((data?.identidade as Record<string, unknown>) ?? {}), cor_sala: cor }
  if (sala && Object.keys(sala).length) identidade.sala = sala
  else delete identidade.sala
  const { error: e2 } = await supabase.from('marcas').update({ identidade }).eq('id', marcaId)
  if (e2) throw e2
}

export interface Post {
  id: string
  marca_id: string
  briefing: string
  status: string
  legenda: string | null
  slides: { ordem: number; url: string }[]
  /** Reel: vídeo gerado pela IA escolhida, com a narração quando tem */
  video?: { url: string; segundos: number; prompt?: string; narracao?: { texto: string; voz?: string } | null } | null
  custo_usd: number
  agendado_para: string | null
  /** escolhas do Novo post; agendar_para pré-preenche o horário na aprovação */
  preferencias?: { formato?: string; estrutura?: string; layout?: string; voz?: string; slides?: number; agendar_para?: string; ias?: Record<string, string> } | null
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

/** Posts da marca aberta, e de qual marca é a lista que está na mão (para não mostrar a da sala anterior enquanto carrega). */
export function usePosts(marcaId: string | null, recarregar: number) {
  const [lista, setLista] = useState<{ de: string | null; posts: Post[] }>({ de: null, posts: [] })
  useEffect(() => {
    if (!supabase || !marcaId) return
    let valendo = true
    supabase
      .from('posts')
      .select('*')
      .eq('marca_id', marcaId)
      .order('criado_em', { ascending: false })
      .limit(100)
      .then(({ data }) => valendo && setLista({ de: marcaId, posts: (data as Post[]) ?? [] }))
    return () => {
      valendo = false
    }
  }, [marcaId, recarregar])
  // trocou de marca: a lista da anterior some na hora, sem esperar o banco
  const daMarca = lista.de === marcaId
  return { posts: daMarca ? lista.posts : SEM_POSTS, carregado: daMarca }
}
const SEM_POSTS: Post[] = []

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
  const [quadros, setQuadros] = useState<Record<string, { dias: number[]; regras: number; referencias: number }>>({})
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
      supabase.from('midias').select('marca_id').in('marca_id', marcaIds),
    ]).then(([posts, regras, midias]) => {
      const novo: Record<string, { dias: number[]; regras: number; referencias: number }> = Object.fromEntries(marcaIds.map((id) => [id, { dias: [], regras: 0, referencias: 0 }]))
      for (const p of posts.data ?? []) {
        const data = p.status === 'publicado' ? p.publicado_em : p.agendado_para
        if (data && novo[p.marca_id]) novo[p.marca_id].dias.push(new Date(data).getDate())
      }
      for (const r of regras.data ?? []) if (novo[r.marca_id]) novo[r.marca_id].regras++
      for (const m of midias.data ?? []) if (novo[m.marca_id]) novo[m.marca_id].referencias++
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

/** Passa a regra para outro agente (ex.: o curador anotou para um agente que não existe). */
export async function moverRegra(id: string, agente: string) {
  await supabase?.from('regras').update({ agente }).eq('id', id)
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

export type EstadoNaSala = 'ocioso' | 'na_fila' | 'trabalhando' | 'concluido' | 'esperando_voce' | 'erro'
export interface Andar {
  /** o que cada agente está fazendo em cada sala, pelo post em andamento dela */
  porSala: Record<string, Partial<Record<string, EstadoNaSala>>>
  /** posts de todas as marcas esperando você (aprovação ou erro), mais novos primeiro */
  naSuaMesa: Post[]
  /** gasto do mês em cada sala */
  mes: Record<string, number>
  /** posts prontos guardados na gaveta de cada sala, mais novos primeiro */
  gaveta: Record<string, Post[]>
  /** posts com data de todas as marcas (agendados, publicados e os que falharam na hora), para o calendário geral */
  comData: Post[]
  carregado: boolean
}
const ANDAR_VAZIO: Andar = { porSala: {}, naSuaMesa: [], mes: {}, gaveta: {}, comData: [], carregado: false }
const DO_PASSO: Record<string, EstadoNaSala> = { pendente: 'na_fila', rodando: 'trabalhando', feito: 'concluido', falhou: 'erro' }

/** O andar inteiro ao vivo: cada sala com o próprio post trabalhando e tudo que está esperando na sua mesa. */
export function useAndar(marcaIds: string[], recarregar: number): Andar {
  const [andar, setAndar] = useState<Andar>(ANDAR_VAZIO)
  const chave = marcaIds.join(',')
  useEffect(() => {
    if (!supabase || !marcaIds.length) return setAndar(ANDAR_VAZIO)
    const sb = supabase
    let valendo = true
    const buscar = async () => {
      const inicioDoMes = new Date()
      inicioDoMes.setDate(1)
      inicioDoMes.setHours(0, 0, 0, 0)
      const [vivos, mes, guardados, comData] = await Promise.all([
        sb.from('posts').select('*').in('marca_id', marcaIds).in('status', ['em_producao', 'aprovado', 'aguardando_aprovacao', 'erro']).order('criado_em', { ascending: false }).limit(60),
        sb.from('posts').select('marca_id, custo_usd').in('marca_id', marcaIds).gte('criado_em', inicioDoMes.toISOString()),
        sb.from('posts').select('*').in('marca_id', marcaIds).eq('status', 'guardado').order('criado_em', { ascending: false }).limit(200),
        sb
          .from('posts')
          .select('id, marca_id, briefing, status, legenda, slides, agendado_para, publicado_em, criado_em, custo_usd')
          .in('marca_id', marcaIds)
          .or('status.eq.agendado,status.eq.publicado,and(status.eq.erro,agendado_para.not.is.null)')
          .order('criado_em', { ascending: false })
          .limit(500),
      ])
      const gaveta: Andar['gaveta'] = {}
      for (const p of (guardados.data as Post[]) ?? []) (gaveta[p.marca_id] ??= []).push(p)
      const posts = (vivos.data as Post[]) ?? []
      // a sala mostra o post que está andando; se nenhum, o mais novo parado esperando você
      const daSala = new Map<string, Post>()
      for (const p of posts) if (['em_producao', 'aprovado'].includes(p.status) && !daSala.has(p.marca_id)) daSala.set(p.marca_id, p)
      for (const p of posts) if (!daSala.has(p.marca_id)) daSala.set(p.marca_id, p)
      const ids = [...daSala.values()].map((p) => p.id)
      const { data: passos } = ids.length ? await sb.from('passos').select('post_id, agente, status, ordem').in('post_id', ids) : { data: [] }
      const ultimo = new Map<string, { status: string; ordem: number }>()
      for (const x of (passos ?? []) as { post_id: string; agente: string; status: string; ordem: number }[]) {
        const k = `${x.post_id}:${x.agente}`
        if ((ultimo.get(k)?.ordem ?? -1) < x.ordem) ultimo.set(k, x)
      }
      const porSala: Andar['porSala'] = {}
      for (const [marca, p] of daSala) {
        const estados: Partial<Record<string, EstadoNaSala>> = {}
        for (const [k, x] of ultimo) if (k.startsWith(`${p.id}:`) && DO_PASSO[x.status]) estados[k.slice(p.id.length + 1)] = DO_PASSO[x.status]
        porSala[marca] = estados
      }
      const gasto: Record<string, number> = {}
      for (const x of (mes.data ?? []) as { marca_id: string; custo_usd: number }[]) gasto[x.marca_id] = (gasto[x.marca_id] ?? 0) + Number(x.custo_usd)
      if (valendo) setAndar({ porSala, naSuaMesa: posts.filter((p) => p.status === 'aguardando_aprovacao' || p.status === 'erro'), mes: gasto, gaveta, comData: (comData.data as Post[]) ?? [], carregado: true })
    }
    buscar().catch((e) => console.error('não consegui ver o andar', e))
    // mudou um post em qualquer sala (status, slides, agendamento): busca de novo na hora, juntando mudanças próximas
    let agendado: number | undefined
    const logo = () => {
      window.clearTimeout(agendado)
      agendado = window.setTimeout(() => buscar().catch(() => {}), 400)
    }
    const canal = sb
      .channel(`andar:${chave}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `marca_id=in.(${marcaIds.join(',')})` }, logo)
      .subscribe()
    // o polling fica como reserva (passos não entram no Realtime) e só quando a aba está visível
    const id = window.setInterval(() => document.visibilityState === 'visible' && buscar().catch(() => {}), 20_000)
    return () => {
      valendo = false
      window.clearTimeout(agendado)
      window.clearInterval(id)
      sb.removeChannel(canal)
    }
  }, [chave, recarregar]) // eslint-disable-line react-hooks/exhaustive-deps
  return andar
}

/** Guarda a ordem das salas no andar (da esquerda para a direita) na identidade de cada marca. */
export async function salvarOrdemDasSalas(ids: string[]) {
  if (!supabase) return
  const sb = supabase
  const { data, error } = await sb.from('marcas').select('id, identidade').in('id', ids)
  if (error) throw error
  await Promise.all(
    ((data ?? []) as { id: string; identidade: Record<string, unknown> | null }[]).map((m) =>
      sb.from('marcas').update({ identidade: { ...(m.identidade ?? {}), posicao: ids.indexOf(m.id) } }).eq('id', m.id).then(({ error: e }) => {
        if (e) throw e
      }),
    ),
  )
}
