import type { AgenteId } from '../agents/catalogo'

/** Funcionários que recebem pedidos avulsos, e um exemplo do que pedir a cada um. O publicador só publica posts. */
export const EXEMPLO_DE_PEDIDO: Partial<Record<AgenteId, string>> = {
  chefe: 'Ex.: monte a pauta das próximas duas semanas para o lançamento do mês',
  pesquisador: 'Ex.: o que está em alta no meu nicho agora, com fontes',
  redator: 'Ex.: uma copy de anúncio para o Meta divulgando meu produto, com 2 variações',
  designer: 'Ex.: como deve ser o visual de um anúncio em vídeo vertical',
  criativos: 'Ex.: três ideias de criativo para um anúncio de vendas do meu produto',
  cinegrafista: 'Ex.: roteiro de um Reel de 15 s mostrando o produto em uso',
  narrador: 'Ex.: a locução de 20 s de um anúncio, para gravar',
  revisor: 'Ex.: revise este texto antes de eu publicar: …',
  curador: 'Ex.: não quero mais emoji nas legendas e sempre citar o preço',
}
export const recebePedido = (id: AgenteId) => Object.prototype.hasOwnProperty.call(EXEMPLO_DE_PEDIDO, id)
