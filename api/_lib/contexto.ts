import type { Anuncio } from './anuncio.js'
import { db } from './db.js'
import { completarMarca } from './marcas/index.js'

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
  /** vídeo do Reel, gerado pela IA escolhida e guardado no armazenamento do app */
  video?: {
    url: string
    caminho: string
    prompt: string
    segundos: number
    modelo: string
    motor?: string
    pedido_id?: string
    kling_id?: string
    /** vídeo sem a narração, para narrar de novo sem voz por cima de voz */
    original?: { url: string; caminho: string; segundos: number }
    narracao?: { texto: string; voz: string; modelo: string }
  } | null
  voltas_revisao: number
  custo_usd: number
  referencias?: Referencia[]
  /** só nos anúncios: objetivo da campanha, público e, depois do copywriter, o pacote de textos para o Meta */
  anuncio?: Anuncio | null
  /** escolhas do dono no Novo post */
  preferencias?: { formato?: string; estrutura?: string; layout?: string; voz?: string; slides?: number; agendar_para?: string; ias?: Record<string, string>; aprovar_texto?: boolean; revisar?: boolean }
}

export type Referencia = { tipo: 'imagem'; url: string } | { tipo: 'link'; url: string }

/** Referências que você mandou com o pedido: imagens viram blocos que o modelo enxerga, links viram texto. */
export function referenciasDoPost(ctx: Contexto) {
  const refs = ctx.post.referencias ?? []
  const imagens = refs.filter((r) => r.tipo === 'imagem').map((r) => r.url)
  const links = refs.filter((r) => r.tipo === 'link').map((r) => r.url)
  const partes = [
    imagens.length ? `Imagens de referência:\n${imagens.map((u) => `- ${u}`).join('\n')}` : '',
    links.length ? `Links de referência:\n${links.map((u) => `- ${u}`).join('\n')}` : '',
  ].filter(Boolean)
  const texto = partes.length ? `## Referências enviadas pelo dono neste pedido\n${partes.join('\n\n')}` : ''
  const blocos = imagens.map((url) => ({ type: 'image' as const, source: { type: 'url' as const, url } }))
  return { texto, blocos, tem: refs.length > 0 }
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
  /** `vezes`: quantas vezes o dono corrigiu o que a regra cobre (2 ou mais = erro reincidente) */
  regras: { id?: string; agente: string; regra: string; vezes?: number }[]
  /** a saída mais recente de cada agente neste post */
  saidas: Record<string, unknown>
}

export const NOMES: Record<string, string> = {
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

export async function carregarContexto(postId: string): Promise<Contexto> {
  const { data: post, error } = await db.from('posts').select('*').eq('id', postId).single()
  if (error || !post) throw new Error(`Post ${postId} não encontrado`)
  const [{ data: marca }, { data: roteiro }, { data: regras }, { data: passos }] = await Promise.all([
    db.from('marcas').select('*').eq('id', post.marca_id).single(),
    // lê sempre a versão mais nova: o roteiro editado no meio do post vale a partir do próximo passo
    db.from('roteiro_ativo').select('etapas').eq('marca_id', post.marca_id).maybeSingle(),
    lerRegrasAtivas(post.marca_id),
    db.from('passos').select('agente, saida').eq('post_id', postId).eq('status', 'feito').order('terminado_em'),
  ])
  if (!marca) throw new Error('Marca do post não encontrada')
  const saidas: Record<string, unknown> = {}
  for (const p of passos ?? []) saidas[p.agente] = p.saida
  return { post: post as Post, marca: completarMarca(marca as Marca), etapas: (roteiro?.etapas as Etapa[]) ?? [], regras: regras ?? [], saidas }
}

/** Regras ativas da marca, com a contagem de reincidências quando o banco já tem a coluna. */
async function lerRegrasAtivas(marcaId: string) {
  const ler = (campos: string) => db.from('regras').select(campos).eq('marca_id', marcaId).eq('status', 'ativa').order('criado_em')
  let r = await ler('id, agente, regra, vezes')
  // sem a migração das reincidências, os agentes não podem ficar sem regra nenhuma
  if (r.error && /vezes/.test(r.error.message)) r = await ler('id, agente, regra')
  return { data: (r.data ?? null) as Contexto['regras'] | null, error: r.error }
}

/** Regras que valem para o agente (as do designer valem também para o designer de criativos). */
export function regrasDoAgente(ctx: Pick<Contexto, 'regras'>, agente: string) {
  return ctx.regras.filter((r) => r.agente === agente || r.agente === 'todos' || (agente === 'criativos' && r.agente === 'designer'))
}

/** Regras do agente que o dono já teve de cobrar mais de uma vez, da mais cobrada para a menos. */
export function reincidentes(ctx: Pick<Contexto, 'regras'>, agente: string) {
  return regrasDoAgente(ctx, agente)
    .filter((r) => (r.vezes ?? 1) >= 2)
    .sort((a, b) => (b.vezes ?? 1) - (a.vezes ?? 1))
}

/** Lista para conferir item por item (autoconferência e revisor); vazio se não há reincidência. */
export function textoReincidentes(ctx: Pick<Contexto, 'regras'>, agente: string) {
  const lista = reincidentes(ctx, agente)
  if (!lista.length) return ''
  return `## Erros que o dono já corrigiu mais de uma vez (confira cada um, um por um, nas imagens)\n${lista.map((r) => `- (${r.vezes}x) ${r.regra}`).join('\n')}\nSe algum destes aparece, é problema: não passe adiante.`
}

// Cada agente recebe só as partes do perfil da marca que usa: menos tokens de entrada em toda chamada.
const PRECISA: Record<string, { tom?: boolean; identidade?: boolean; legenda?: boolean; outrasRegras?: boolean }> = {
  chefe: { tom: true, identidade: true, outrasRegras: true },
  pesquisador: { tom: true },
  redator: { tom: true, legenda: true },
  designer: { identidade: true },
  criativos: { identidade: true },
  cinegrafista: { identidade: true },
  narrador: { tom: true },
  revisor: { tom: true, identidade: true, legenda: true, outrasRegras: true },
  curador: { outrasRegras: true },
}

/** O que o app guarda na identidade e não é identidade visual (decoração da sala, ordem no andar, ideias guardadas): fica fora do prompt. */
const CAMPOS_DO_APP = ['sala', 'posicao', 'cor_sala', 'tom_editado', 'ideias_guardadas', 'teto']
export function identidadeVisual(identidade: Record<string, unknown> | null | undefined) {
  return Object.fromEntries(Object.entries(identidade ?? {}).filter(([k]) => !CAMPOS_DO_APP.includes(k)))
}

/** Monta o prompt de sistema de um agente a partir do roteiro, da marca e das regras aprendidas. */
export function sistemaDoAgente(ctx: Pick<Contexto, 'marca' | 'etapas' | 'regras'>, agente: string, papel: string) {
  const etapa = ctx.etapas.find((e) => e.agente === agente)
  // as regras visuais da marca que o designer aprendeu valem também para o designer de criativos
  const regras = regrasDoAgente(ctx, agente)
  const repetidos = regras.filter((r) => (r.vezes ?? 1) >= 2).sort((a, b) => (b.vezes ?? 1) - (a.vezes ?? 1))
  const demais = regras.filter((r) => !repetidos.includes(r))
  const precisa = PRECISA[agente] ?? { tom: true, identidade: true, legenda: true, outrasRegras: true }
  const outrasRegras = precisa.outrasRegras ? ctx.regras.filter((r) => !regras.includes(r)) : []
  const m = ctx.marca

  return [
    m.identidade?.neutra
      ? `Você é o ${NOMES[agente] ?? agente} de uma equipe que cria posts de Instagram. ${papel}\nEsta é uma sala neutra: não existe marca fixa. O assunto, o tom e a identidade visual saem do pedido e das referências que o dono enviou com ele. Siga as referências de perto.`
      : `Você é o ${NOMES[agente] ?? agente} de uma equipe que cria posts de Instagram e anúncios no Meta para a marca ${m.nome}${m.instagram_usuario ? ` (@${m.instagram_usuario})` : ''}. ${papel}`,
    'Escreva sempre em português do Brasil.',
    etapa?.instrucoes ? `## Instruções do roteiro (definidas pelo dono da marca)\n${etapa.instrucoes}` : '',
    repetidos.length
      ? `## Erros que já voltaram (o dono corrigiu mais de uma vez; prioridade máxima)\n${repetidos.map((r) => `- (${r.vezes}x) ${r.regra}`).join('\n')}`
      : '',
    demais.length
      ? `## Regras aprendidas para você (têm prioridade sobre todo o resto)\n${demais.map((r) => `- ${r.regra}`).join('\n')}`
      : '',
    outrasRegras.length ? `## Regras dos outros agentes (para contexto)\n${outrasRegras.map((r) => `- [${r.agente}] ${r.regra}`).join('\n')}` : '',
    precisa.tom && m.tom_de_voz ? `## Tom de voz da marca\n${m.tom_de_voz}` : '',
    precisa.identidade && Object.keys(identidadeVisual(m.identidade)).length ? `## Identidade visual\n${JSON.stringify(identidadeVisual(m.identidade))}` : '',
    precisa.legenda && m.hashtags_fixas?.length ? `## Hashtags fixas\n${m.hashtags_fixas.join(' ')}` : '',
    precisa.legenda && m.aviso_final ? `## Aviso obrigatório no fim da legenda\n${m.aviso_final}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** O dono pediu para pular o revisor neste post: o que sai do último agente de produção vai direto para a mesa dele. */
export function pulaRevisor(post: { preferencias?: { revisar?: boolean } | null }) {
  return post.preferencias?.revisar === false
}

/** Quem desenha neste post: nos anúncios, o designer de criativos; nos posts, o designer. */
export const quemDesenha = (post: { anuncio?: unknown }) => (post.anuncio && typeof post.anuncio === 'object' ? 'criativos' : 'designer')

/**
 * Agentes do fluxo de produção, na ordem do roteiro, só os ativos. Em Reel, o cinegrafista e o narrador entram antes do revisor.
 * Num anúncio, o designer de criativos fica no lugar do designer (o roteiro da marca só conhece o designer).
 */
export function fluxoDeProducao(etapas: Etapa[], formato?: string, anuncio = false) {
  const producao = ['chefe', 'pesquisador', 'redator', 'designer', 'revisor']
  const ativos = etapas.filter((e) => e.ativo && producao.includes(e.agente)).map((e) => e.agente)
  const ordem = ativos.length ? ativos : producao
  if (anuncio) return ordem.map((a) => (a === 'designer' ? 'criativos' : a))
  if (formato !== 'reel') return ordem
  const revisor = ordem.indexOf('revisor')
  const video = ['cinegrafista', 'narrador']
  return revisor < 0 ? [...ordem, ...video] : [...ordem.slice(0, revisor), ...video, ...ordem.slice(revisor)]
}

/**
 * Quem refaz numa devolução do revisor: só os apontados, na ordem do fluxo, e o revisor no fim.
 * Pesquisa corrigida muda o texto (entra o redator); texto corrigido muda os slides (entra o designer).
 * Vídeo e narração só entram se forem apontados: ajuste de legenda não refaz o Reel.
 */
export function rotaDaDevolucao(apontados: string[], fluxo: string[]) {
  const desenha = fluxo.includes('criativos') ? 'criativos' : 'designer'
  // o revisor aponta "designer" para o visual; num anúncio quem refaz é o designer de criativos
  const quem = new Set(apontados.map((a) => (a === 'designer' ? desenha : a)))
  if (quem.has('pesquisador')) quem.add('redator')
  if (quem.has('redator') && fluxo.includes(desenha)) quem.add(desenha)
  const rota = fluxo.filter((a) => quem.has(a) && a !== 'revisor')
  return [...(rota.length ? rota : [desenha]), 'revisor']
}
