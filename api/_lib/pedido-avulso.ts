// Pedido avulso: você pede algo direto a um funcionário (ex.: uma copy de anúncio ao copywriter), sem abrir um post.
// Ele usa o mesmo perfil da marca e as regras aprendidas que usaria num post, e responde em texto.
import { gerarTexto } from './claude.js'
import { sistemaDoAgente, type Marca } from './contexto.js'
import { db } from './db.js'
import { PADRAO_TEXTO, type ModeloTexto } from './ias.js'
import { completarMarca } from './marcas/index.js'
import { CLICHES, ESCRITA } from './variacao.js'

const FORA_DO_POST = 'Agora o dono da marca pede uma tarefa avulsa, fora do fluxo de um post: faça só o que ele pediu, pronto para usar, sem explicar o processo.'

/** O que cada funcionário faz num pedido avulso. O publicador não entra: publicar sempre passa por um post. */
export const PAPEL_AVULSO = {
  chefe: 'Você planeja pautas e calendários de conteúdo: transforma objetivos em uma lista de posts com formato, ângulo e ordem.',
  pesquisador: 'Você pesquisa fatos, tendências e referências na web e responde com o que encontrou, citando as fontes (link) de cada fato.',
  redator:
    'Você é copywriter: escreve copys de anúncio, legendas, títulos, ganchos, roteiros curtos, textos de site e e-mail no tom de voz da marca, como um copywriter humano que conhece a marca. Quando for anúncio, entregue texto principal, título, descrição e botão, e uma ou duas variações para testar.',
  designer: 'Você dá direção visual: layout, hierarquia, paleta, tipografia e o que deve aparecer em cada peça, seguindo a identidade visual da marca. Responda em texto (você não gera a imagem aqui).',
  cinegrafista: 'Você escreve cenas e roteiros de vídeo curto (Reels, anúncios): plano a plano, o que aparece, movimento de câmera e duração, e o prompt pronto para a IA de vídeo.',
  narrador: 'Você escreve a fala de narrações e locuções no tom da marca, no ritmo de quem fala (frases curtas, fáceis de dizer), com a duração aproximada.',
  revisor: 'Você revisa o texto ou a ideia que o dono mandar: aponta erro, frase confusa, promessa arriscada e o que quebra as regras da marca, e devolve a versão corrigida.',
  curador: 'Você transforma correções e preferências do dono em regras curtas e verificáveis para a equipe seguir.',
} as const
export type AgenteAvulso = keyof typeof PAPEL_AVULSO
export const eAgenteAvulso = (v: unknown): v is AgenteAvulso => typeof v === 'string' && Object.hasOwn(PAPEL_AVULSO, v)

// quem não troca de IA no Novo post usa o modelo do catálogo
const MODELO_AVULSO: Record<AgenteAvulso, ModeloTexto> = { ...PADRAO_TEXTO, cinegrafista: 'claude-sonnet-5-5', curador: 'claude-sonnet-5-5' }

export interface Troca {
  pedido: string
  resposta: string
}

/** O pedido, com as trocas anteriores da mesma conversa quando você pede um ajuste. */
export function conteudoDoPedido(pedido: string, anteriores: Troca[] = []) {
  const historico = anteriores
    .slice(-4)
    .map((t, i) => `### Pedido ${i + 1}\n${t.pedido.slice(0, 4000)}\n\n### Sua resposta ${i + 1}\n${t.resposta.slice(0, 8000)}`)
    .join('\n\n')
  return historico ? `## Conversa até aqui\n${historico}\n\n## Novo pedido (ajuste o que for preciso a partir da última resposta)\n${pedido}` : pedido
}

export async function pedidoAvulso(marcaId: string, agente: AgenteAvulso, pedido: string, anteriores: Troca[] = []) {
  const [{ data: marca }, { data: regras }] = await Promise.all([
    db.from('marcas').select('*').eq('id', marcaId).single(),
    db.from('regras').select('agente, regra').eq('marca_id', marcaId).eq('status', 'ativa').order('criado_em'),
  ])
  if (!marca) throw new Error('Marca não encontrada')
  // as instruções do roteiro são para o post; aqui valem o papel avulso, o perfil da marca e as regras aprendidas
  const ctx = { marca: completarMarca(marca as Marca), etapas: [], regras: regras ?? [] }
  const { texto, uso } = await gerarTexto({
    modelo: MODELO_AVULSO[agente],
    // o copywriter avulso segue as mesmas regras de escrita do post (sem endereço de site, sem clichê de IA, gancho curto)
    sistema: `${sistemaDoAgente(ctx, agente, `${PAPEL_AVULSO[agente]}\n${FORA_DO_POST}`)}${agente === 'redator' ? `\n\n${ESCRITA}\n\n${CLICHES}` : ''}`,
    conteudo: conteudoDoPedido(pedido, anteriores),
    buscaWeb: agente === 'pesquisador' ? 3 : undefined,
    effort: agente === 'curador' ? 'low' : 'medium',
  })
  return { resposta: texto.trim(), custo_usd: uso.custo_usd }
}
