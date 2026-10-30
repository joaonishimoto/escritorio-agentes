// Planos editoriais da marca: lê do banco e grava as edições do dono direto (RLS); montar e trocar ideias passa pela API.
import { useCallback, useEffect, useState } from 'react'
import { chamarApi } from './api'
import type { ConfigPlano, FormatoPlano, VagaNova } from './plano'
import { supabase } from './supabase'

export interface Vaga {
  id: string
  plano_id: string
  ordem: number
  quando: string
  formato: FormatoPlano
  linha: string | null
  tema_obrigatorio: string | null
  titulo: string
  gancho: string
  briefing: string
  novidade: 'inedito' | 'angulo_novo' | null
  parecido_com: string | null
  status: 'proposta' | 'aprovada' | 'descartada'
  post_id: string | null
}

export interface Plano {
  id: string
  marca_id: string
  config: Partial<ConfigPlano>
  status: 'rascunho' | 'aprovado' | 'encerrado'
  custo_usd: number
  criado_em: string
  vagas: Vaga[]
}

const sb = () => {
  if (!supabase) throw new Error('Sem conexão com o banco')
  return supabase
}

/** O plano mais recente que não foi encerrado, com as vagas em ordem. Sem a tabela (migração não rodou), nenhum. */
export async function lerPlanoAtual(marcaId: string): Promise<Plano | null> {
  const { data, error } = await sb().from('planos').select('*, vagas(*)').eq('marca_id', marcaId).neq('status', 'encerrado').order('criado_em', { ascending: false }).limit(1).maybeSingle()
  if (error || !data) return null
  const p = data as Plano
  return { ...p, custo_usd: Number(p.custo_usd ?? 0), vagas: [...(p.vagas ?? [])].sort((a, b) => a.quando.localeCompare(b.quando) || a.ordem - b.ordem) }
}

export function usePlanoAtual(marcaId: string | null | undefined) {
  const [plano, setPlano] = useState<Plano | null | undefined>(undefined)
  const recarregar = useCallback(async () => {
    if (!marcaId) return setPlano(null)
    setPlano(await lerPlanoAtual(marcaId).catch(() => null))
  }, [marcaId])
  useEffect(() => {
    void recarregar()
  }, [recarregar])
  return { plano, setPlano, recarregar }
}

export async function gerarPlano(marcaId: string, config: ConfigPlano, vagas: VagaNova[], pedido: string) {
  return chamarApi<{ plano_id: string; custo_usd: number }>('ideias', { acao: 'plano', marca_id: marcaId, config, vagas, pedido: pedido.trim() || undefined })
}

export async function pedirOutraIdeia(marcaId: string, vagaId: string, pedido?: string) {
  return chamarApi<{ vaga: Vaga; custo_usd: number }>('ideias', { acao: 'outra_ideia', marca_id: marcaId, vaga_id: vagaId, pedido })
}

type Editavel = Partial<Pick<Vaga, 'titulo' | 'gancho' | 'briefing' | 'formato' | 'quando' | 'status'>>

export async function salvarVaga(id: string, campos: Editavel) {
  const { error } = await sb().from('vagas').update(campos).eq('id', id)
  if (error) throw new Error(error.message)
}

/** Aprova a grade: o plano fica aprovado e as vagas que você não tirou viram aprovadas. */
export async function aprovarPlano(id: string) {
  const { error: e1 } = await sb().from('vagas').update({ status: 'aprovada' }).eq('plano_id', id).eq('status', 'proposta')
  if (e1) throw new Error(e1.message)
  const { error } = await sb().from('planos').update({ status: 'aprovado', aprovado_em: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}

/** Rascunho vai para o lixo; plano aprovado fica no histórico como encerrado. */
export async function descartarPlano(plano: Pick<Plano, 'id' | 'status'>) {
  const q = plano.status === 'rascunho' ? sb().from('planos').delete().eq('id', plano.id) : sb().from('planos').update({ status: 'encerrado' }).eq('id', plano.id)
  const { error } = await q
  if (error) throw new Error(error.message)
}

/** Vagas aprovadas que ainda não viraram post, para o calendário mostrar como planejadas. */
export function vagasPlanejadas(plano: Plano | null | undefined) {
  return plano?.status === 'aprovado' ? plano.vagas.filter((v) => v.status === 'aprovada' && !v.post_id) : []
}
