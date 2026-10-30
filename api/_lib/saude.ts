// Saúde da produção, na aba Serviços: posts parados, falhas da semana por agente e a última faxina.
import type { Resultado } from '../servicos.js'
import { db } from './db.js'

const MIN = 60_000

export interface PassoVisto {
  agente: string
  status: string
  criado_em: string
  iniciado_em: string | null
  terminado_em: string | null
  saida: { erro?: string } | null
  briefing: string
}

const NOMES: Record<string, string> = {
  chefe: 'Chefe de pauta',
  pesquisador: 'Pesquisador',
  redator: 'Copywriter',
  designer: 'Designer',
  criativos: 'Designer de criativos',
  cinegrafista: 'Cinegrafista',
  narrador: 'Narrador',
  revisor: 'Revisor',
  publicador: 'Publicador',
  curador: 'Curador',
}
const curto = (s: string, n = 60) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** Transforma os passos recentes em linhas da saúde. */
export function classificarSaude(passos: PassoVisto[], postsComErro: number, limpeza: { em?: string; eventos?: number; arquivos?: number } | null, agora = new Date()): Resultado[] {
  const t = agora.getTime()
  const parados = passos.filter(
    (p) => (p.status === 'rodando' && p.iniciado_em && t - new Date(p.iniciado_em).getTime() > 15 * MIN) || (p.status === 'pendente' && t - new Date(p.criado_em).getTime() > 10 * MIN),
  )
  const linhas: Resultado[] = [
    parados.length
      ? {
          id: 'saude:parados',
          nome: 'Posts parados',
          estado: 'erro',
          detalhe: `${parados.length} passo${parados.length > 1 ? 's' : ''} sem andar: ${[...new Set(parados.map((p) => `${NOMES[p.agente] ?? p.agente} em “${curto(p.briefing)}”`))].slice(0, 3).join('; ')}. A fila tenta de novo sozinha a cada minuto.`,
        }
      : { id: 'saude:parados', nome: 'Posts parados', estado: 'ok', detalhe: 'Nenhum post parado agora' },
    postsComErro
      ? { id: 'saude:erro', nome: 'Posts com erro', estado: 'incerto', detalhe: `${postsComErro} post${postsComErro > 1 ? 's' : ''} esperando você tentar de novo (lista de posts, grupo “Com erro”)` }
      : { id: 'saude:erro', nome: 'Posts com erro', estado: 'ok', detalhe: 'Nenhum' },
  ]
  const semana = passos.filter((p) => p.status === 'falhou' && t - new Date(p.terminado_em ?? p.criado_em).getTime() < 7 * 24 * 60 * MIN)
  const porAgente = new Map<string, PassoVisto[]>()
  for (const p of semana) porAgente.set(p.agente, [...(porAgente.get(p.agente) ?? []), p])
  const ordenados = [...porAgente.entries()].sort((a, b) => b[1].length - a[1].length)
  if (!ordenados.length) linhas.push({ id: 'saude:falhas', nome: 'Falhas nos últimos 7 dias', estado: 'ok', detalhe: 'Nenhuma' })
  for (const [agente, falhas] of ordenados) {
    const ultima = [...falhas].sort((a, b) => (b.terminado_em ?? b.criado_em).localeCompare(a.terminado_em ?? a.criado_em))[0]
    linhas.push({
      id: `saude:falhas:${agente}`,
      nome: `${NOMES[agente] ?? agente}: ${falhas.length} falha${falhas.length > 1 ? 's' : ''} em 7 dias`,
      estado: 'incerto',
      detalhe: `Última: ${curto(ultima.saida?.erro ?? 'sem mensagem', 160)}`,
    })
  }
  linhas.push(
    limpeza?.em
      ? {
          id: 'saude:limpeza',
          nome: 'Faxina automática',
          estado: t - new Date(limpeza.em).getTime() < 2 * 24 * 60 * MIN ? 'ok' : 'incerto',
          detalhe: `Última em ${new Date(limpeza.em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}: ${limpeza.eventos ?? 0} registros antigos e ${limpeza.arquivos ?? 0} arquivos apagados`,
        }
      : { id: 'saude:limpeza', nome: 'Faxina automática', estado: 'incerto', detalhe: 'Ainda não rodou (precisa da migração da faxina no Supabase)' },
  )
  return linhas
}

export async function saudeDaProducao(marcaIds: string[]): Promise<Resultado[]> {
  if (!marcaIds.length) return []
  const desde = new Date(Date.now() - 7 * 24 * 60 * MIN).toISOString()
  const [{ data: passos }, { count: comErro }, { data: limpeza }] = await Promise.all([
    db
      .from('passos')
      .select('agente, status, criado_em, iniciado_em, terminado_em, saida, posts!inner(briefing, marca_id)')
      .in('posts.marca_id', marcaIds)
      .or(`status.in.(rodando,pendente),and(status.eq.falhou,criado_em.gte.${desde})`)
      .limit(300),
    db.from('posts').select('id', { count: 'exact', head: true }).in('marca_id', marcaIds).eq('status', 'erro'),
    db.from('config_app').select('valor').eq('chave', 'ultima_limpeza').maybeSingle(),
  ])
  const vistos: PassoVisto[] = (passos ?? []).map((p) => {
    const post = (Array.isArray(p.posts) ? p.posts[0] : p.posts) as { briefing?: string } | null
    // a saída de um passo que falhou guarda só o erro; não manda o resto para o navegador
    const saida = p.saida as { erro?: string } | null
    return { ...p, saida: saida?.erro ? { erro: saida.erro } : null, briefing: post?.briefing ?? '' }
  })
  let ultima = null
  try {
    ultima = limpeza?.valor ? JSON.parse(limpeza.valor) : null
  } catch {
    // valor estranho: trata como se nunca tivesse rodado
  }
  return classificarSaude(vistos, comErro ?? 0, ultima)
}
