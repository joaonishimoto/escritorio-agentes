import { db } from './db'
import { completarMarca } from './marcas'

export interface Etapa {
  agente: string
  ativo: boolean
  instrucoes: string
}

export interface Marca {
  id: string
  nome: string
  instagram_usuario: string | null
  instagram_conta_id: string | null
  meta_token_secret_id: string | null
  tom_de_voz: string
  identidade: Record<string, unknown>
  hashtags_fixas: string[]
  aviso_final: string | null
  modelo_slides_html: string | null
  checklist_revisor: string
}

export interface Post {
  id: string
  marca_id: string
  roteiro_id: string | null
  briefing: string
  formato: string
  status: string
  legenda: string | null
  slides: { ordem: number; url: string; caminho: string }[]
  voltas_revisao: number
  custo_usd: number
}

export interface Passo {
  id: string
  post_id: string
  agente: string
  ordem: number
  entrada: Record<string, unknown>
  tentativas: number
}

export interface Contexto {
  post: Post
  marca: Marca
  etapas: Etapa[]
  regras: { agente: string; regra: string }[]
  /** a saída mais recente de cada agente neste post */
  saidas: Record<string, unknown>
}

export const NOMES: Record<string, string> = {
  chefe: 'Chefe de pauta',
  pesquisador: 'Pesquisador',
  redator: 'Redator',
  designer: 'Designer',
  revisor: 'Revisor',
  publicador: 'Publicador',
  curador: 'Curador',
}

export async function carregarContexto(postId: string): Promise<Contexto> {
  const { data: post, error } = await db.from('posts').select('*').eq('id', postId).single()
  if (error || !post) throw new Error(`Post ${postId} não encontrado`)
  const [{ data: marca }, { data: roteiro }, { data: regras }, { data: passos }] = await Promise.all([
    db.from('marcas').select('*').eq('id', post.marca_id).single(),
    // lê sempre a versão mais nova: o roteiro editado no meio do post vale a partir do próximo passo
    db.from('roteiro_ativo').select('etapas').eq('marca_id', post.marca_id).maybeSingle(),
    db.from('regras').select('agente, regra').eq('marca_id', post.marca_id).eq('status', 'ativa').order('criado_em'),
    db.from('passos').select('agente, saida').eq('post_id', postId).eq('status', 'feito').order('terminado_em'),
  ])
  if (!marca) throw new Error('Marca do post não encontrada')
  const saidas: Record<string, unknown> = {}
  for (const p of passos ?? []) saidas[p.agente] = p.saida
  return { post: post as Post, marca: completarMarca(marca as Marca), etapas: (roteiro?.etapas as Etapa[]) ?? [], regras: regras ?? [], saidas }
}

/** Monta o prompt de sistema de um agente a partir do roteiro, da marca e das regras aprendidas. */
export function sistemaDoAgente(ctx: Contexto, agente: string, papel: string) {
  const etapa = ctx.etapas.find((e) => e.agente === agente)
  const regras = ctx.regras.filter((r) => r.agente === agente || r.agente === 'todos')
  const outrasRegras = ctx.regras.filter((r) => !regras.includes(r))
  const m = ctx.marca

  return [
    `Você é o ${NOMES[agente] ?? agente} de uma equipe que cria posts de Instagram para a marca ${m.nome}${m.instagram_usuario ? ` (@${m.instagram_usuario})` : ''}. ${papel}`,
    'Escreva sempre em português do Brasil.',
    etapa?.instrucoes ? `## Instruções do roteiro (definidas pelo dono da marca)\n${etapa.instrucoes}` : '',
    regras.length
      ? `## Regras aprendidas para você (têm prioridade sobre todo o resto)\n${regras.map((r) => `- ${r.regra}`).join('\n')}`
      : '',
    outrasRegras.length ? `## Regras dos outros agentes (para contexto)\n${outrasRegras.map((r) => `- [${r.agente}] ${r.regra}`).join('\n')}` : '',
    m.tom_de_voz ? `## Tom de voz da marca\n${m.tom_de_voz}` : '',
    Object.keys(m.identidade ?? {}).length ? `## Identidade visual\n${JSON.stringify(m.identidade, null, 2)}` : '',
    m.hashtags_fixas?.length ? `## Hashtags fixas\n${m.hashtags_fixas.join(' ')}` : '',
    m.aviso_final ? `## Aviso obrigatório no fim da legenda\n${m.aviso_final}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Agentes do fluxo de produção, na ordem do roteiro, só os ativos. */
export function fluxoDeProducao(etapas: Etapa[]) {
  const producao = ['chefe', 'pesquisador', 'redator', 'designer', 'revisor']
  const ordem = etapas.filter((e) => e.ativo && producao.includes(e.agente)).map((e) => e.agente)
  return ordem.length ? ordem : producao
}
