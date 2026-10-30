import { z } from 'zod'
import type { Objetivo } from './variacao.js'

// Anúncio no Meta: o mesmo pedido de um post, mas com um objetivo de campanha, duas artes (4:5 do feed e 9:16 de
// Stories e Reels) e um pacote de textos para colar no Gerenciador de Anúncios. O Designer de criativos faz as artes;
// o Copywriter escreve o pacote. Nada vai para o Instagram pelo app: o anúncio fica na gaveta.

/** Objetivos de campanha do Gerenciador de Anúncios, com o que cada um muda no criativo e no texto. */
export const OBJETIVOS_ANUNCIO = {
  vendas: {
    nome: 'Vendas',
    guia: 'quem vê já pode comprar: a arte mostra o produto e a oferta (preço, desconto, prazo ou garantia) em destaque, com uma prova concreta; o texto tira o risco e diz o que fazer',
    objetivo: 'vender',
  },
  trafego: {
    nome: 'Tráfego',
    guia: 'levar o clique para o site: a arte promete um benefício ou desperta curiosidade que só se resolve do outro lado; o texto e o título dizem o que a pessoa encontra ao tocar',
    objetivo: 'vender',
  },
  cadastros: {
    nome: 'Cadastros',
    guia: 'fazer a pessoa deixar o contato: a arte mostra a isca (material grátis, aula, orçamento, teste) e o que ela ganha; o texto diz que é rápido e o que acontece depois',
    objetivo: 'vender',
  },
  app: {
    nome: 'Promoção do app',
    guia: 'fazer instalar o app: a arte mostra a tela do app resolvendo algo em uso (mockup ou print grande e legível) e o principal benefício; o texto fecha com instalar',
    objetivo: 'vender',
  },
  engajamento: {
    nome: 'Engajamento',
    guia: 'fazer comentar, mandar mensagem ou seguir: a arte puxa uma opinião ou uma identificação forte; o texto termina num convite claro para responder',
    objetivo: 'engajar',
  },
  reconhecimento: {
    nome: 'Reconhecimento',
    guia: 'ser lembrado: a marca e o produto aparecem grandes e cedo, pouco texto na arte e uma ideia só; sem oferta nem pressão de compra',
    objetivo: 'marca',
  },
} as const satisfies Record<string, { nome: string; guia: string; objetivo: Objetivo }>
export type ObjetivoAnuncio = keyof typeof OBJETIVOS_ANUNCIO

/** Temperatura do público, que muda o que o texto precisa responder (da skill de copy de anúncios). */
export const ETAPAS_FUNIL = {
  frio: { nome: 'Público frio', guia: 'nunca ouviu falar da marca e pergunta "isso é pra mim?": abra com uma situação que a pessoa reconhece e mostre o produto resolvendo; preço só no fim; título com o resultado' },
  morno: { nome: 'Público morno', guia: 'já conhece ou tem uma ocasião e pergunta "isso me ajuda agora?": a ocasião com data e a função concreta que resolve; título com a função' },
  quente: { nome: 'Remarketing', guia: 'já visitou e pergunta "vale pagar? por que hoje?": pule a explicação, tire o risco, reenquadre o preço e dê um prazo real, em até 4 linhas; título com a oferta' },
} as const
export type EtapaFunil = keyof typeof ETAPAS_FUNIL

/** Botões de chamada que o Gerenciador de Anúncios oferece (os mais usados). */
export const BOTOES_META = [
  'Saiba mais',
  'Comprar agora',
  'Ver mais',
  'Cadastre-se',
  'Inscreva-se',
  'Assinar',
  'Baixar',
  'Instalar agora',
  'Pedir agora',
  'Reservar',
  'Obter oferta',
  'Solicitar orçamento',
  'Enviar mensagem',
  'Enviar mensagem pelo WhatsApp',
  'Fale conosco',
  'Ligar agora',
] as const

/** Limites que o Meta mostra sem cortar: passou, o texto some atrás do "ver mais" ou é cortado com reticências. */
export const LIMITES = { texto_principal: 125, titulo: 40, descricao: 30 } as const

/** O que vem do Novo anúncio: só valores conhecidos; o link de destino só http(s). */
export interface PedidoAnuncio {
  objetivo: ObjetivoAnuncio
  etapa: EtapaFunil
  destino?: string
}

export function limparPedidoAnuncio(bruto: unknown): PedidoAnuncio | null {
  if (!bruto || typeof bruto !== 'object') return null
  const b = bruto as Record<string, unknown>
  if (typeof b.objetivo !== 'string' || !(b.objetivo in OBJETIVOS_ANUNCIO)) return null
  const etapa = typeof b.etapa === 'string' && b.etapa in ETAPAS_FUNIL ? (b.etapa as EtapaFunil) : 'frio'
  const destino = typeof b.destino === 'string' && /^https?:\/\/\S+$/.test(b.destino.trim()) ? b.destino.trim().slice(0, 500) : undefined
  return { objetivo: b.objetivo as ObjetivoAnuncio, etapa, ...(destino ? { destino } : {}) }
}

/** Pacote que o Copywriter entrega junto do texto da arte. */
export const PacoteAnuncio = z.object({
  nome: z.string().describe('nome curto para achar o anúncio nos relatórios, em minúsculas, ex.: "vendas-frio-receitas em 1 minuto"'),
  texto_principal: z
    .array(z.string())
    .describe(`2 versões do texto principal, com ângulos diferentes; a primeira linha de cada uma cabe em ${LIMITES.texto_principal} caracteres e é o gancho; mantenha as quebras de linha`),
  titulo: z.array(z.string()).describe(`3 títulos de até ${LIMITES.titulo} caracteres, sem repetir a primeira linha do texto principal`),
  descricao: z.string().describe(`até ${LIMITES.descricao} caracteres, tirando uma objeção (ex.: "7 dias grátis · Cancele quando quiser")`),
  botao: z.enum(BOTOES_META).describe('o botão de chamada do Gerenciador de Anúncios que combina com o objetivo'),
})
export type Pacote = z.infer<typeof PacoteAnuncio>

/** O que fica guardado no post: o pedido e, depois do Copywriter, o pacote. */
export type Anuncio = PedidoAnuncio & { pacote?: Pacote }

export const eAnuncio = (post: { anuncio?: unknown }): boolean => !!post.anuncio && typeof post.anuncio === 'object'

/** Pacote que segue os limites: texto, título e descrição sem espaços sobrando, sem versões vazias nem repetidas. */
export function arrumarPacote(p: Pacote): Pacote {
  const unicos = (xs: string[]) => Array.from(new Set(xs.map((x) => x.trim()).filter(Boolean)))
  return {
    nome: p.nome.trim().toLowerCase(),
    texto_principal: unicos(p.texto_principal).slice(0, 3),
    titulo: unicos(p.titulo).slice(0, 5),
    descricao: p.descricao.trim(),
    botao: p.botao,
  }
}

/** Avisos do pacote (passou do limite que o Meta mostra), para o revisor e para você. */
export function avisosDoPacote(p: Pacote): string[] {
  const avisos: string[] = []
  for (const [i, t] of p.texto_principal.entries()) {
    const primeira = t.split('\n')[0] ?? ''
    if (primeira.length > LIMITES.texto_principal) avisos.push(`a primeira linha do texto principal ${i + 1} tem ${primeira.length} caracteres (o Meta mostra ${LIMITES.texto_principal} antes do "ver mais")`)
  }
  for (const t of p.titulo) if (t.length > LIMITES.titulo) avisos.push(`o título "${t}" tem ${t.length} caracteres (máximo ${LIMITES.titulo})`)
  if (p.descricao.length > LIMITES.descricao) avisos.push(`a descrição tem ${p.descricao.length} caracteres (máximo ${LIMITES.descricao})`)
  return avisos
}

/** Texto do pedido do anúncio para os prompts do chefe, do copywriter, do designer de criativos e do revisor. */
export function textoDoAnuncio(a: PedidoAnuncio) {
  const o = OBJETIVOS_ANUNCIO[a.objetivo]
  const e = ETAPAS_FUNIL[a.etapa]
  return [
    `## Isto é um anúncio pago no Meta, não um post`,
    `Objetivo da campanha: ${o.nome}. ${o.guia}.`,
    `Público: ${e.nome}. ${e.guia}.`,
    a.destino ? `Para onde o anúncio leva: ${a.destino}` : '',
    'Um anúncio tem um foco só, o do objetivo: nada de conteúdo educativo solto, lista de dicas ou "salve para depois". Quem vê está rolando o feed e não segue a marca: a arte precisa parar o dedo e dizer em 1 segundo o que é e por que importa.',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Regras de escrita do pacote, da skill de copy de anúncios no Meta. */
export const ESCRITA_ANUNCIO = `## Regras do pacote do anúncio
- A arte e o pacote contam a mesma história: a primeira linha do texto principal continua o título da arte, com as mesmas palavras ou quase.
- Texto principal: primeira linha é o gancho e cabe em ${LIMITES.texto_principal} caracteres; depois duas ou três frases do que o produto faz naquela situação, com um detalhe concreto e conferível; se ajudar, uma lista curta com ✅ (até 3 itens); e uma chamada final que diz o que fazer ("Toque em Saiba mais e…"). Nunca "link na bio" nem endereço de site em anúncio pago.
- Título com até ${LIMITES.titulo} caracteres: o resultado ou a oferta. Descrição com até ${LIMITES.descricao}: tira uma objeção.
- Mesma oferta em tudo: preço, prazo e dias de teste só se estiverem no pedido ou na pesquisa; nunca invente número, desconto ou prazo.
- Nada que a pessoa não consiga conferir ("o melhor", números inventados). Emojis com moderação: um no gancho, se ajudar, e os ✅ da lista.
- Bebida alcoólica: só receita, medida, preparo e ocasião; nunca beber mais, embriaguez, direção, sexo ou sucesso.
- O botão combina com o objetivo: vendas pede "Comprar agora", "Obter oferta" ou "Assinar"; tráfego "Saiba mais" ou "Ver mais"; cadastros "Cadastre-se" ou "Solicitar orçamento"; app "Instalar agora"; engajamento "Enviar mensagem"; reconhecimento "Saiba mais".
- O texto da arte é curto: título de até 6 palavras e, no máximo, uma linha de apoio (a oferta ou a prova). O resto vai no texto principal.`

/** Medidas e áreas seguras das duas artes do anúncio. */
export const COMPOSICAO_ANUNCIO = `## As duas artes do anúncio
O documento tem exatamente duas seções, nesta ordem:
1. <section class="slide feed">: 1080x1350 (4:5), para o feed do Instagram e do Facebook.
2. <section class="slide story">: 1080x1920 (9:16), para Stories e Reels. Não é a arte do feed esticada: recomponha para a tela vertical, com a mesma foto, título e marca.

## Área segura do feed (4:5)
- O Meta corta o 4:5 em 1:1 em alguns lugares (coluna da direita, Explorar, prévias): título, oferta, produto e logo ficam dentro de x 80 a 1000 e y 135 a 1215.
- O texto principal aparece em cima da arte e o título e o botão do anúncio aparecem logo embaixo: não desenhe um botão falso nem repita a chamada como se fosse clicável; se a arte tiver chamada, é uma frase curta, não um botão.

## Área segura do Stories e Reels (9:16)
- Os 14% de cima (y 0 a 270) ficam cobertos pela foto do perfil, o nome da marca e o "Patrocinado".
- Os 35% de baixo (y 1250 a 1920) ficam cobertos pelo texto do anúncio, o botão de chamada e os ícones de curtir e comentar.
- Título, oferta, produto e logo ficam entre y 270 e y 1250 e entre x 80 e 1000. Embaixo, só fundo ou foto sangrando; nada que precise ser lido.

## O que faz um criativo funcionar
- Uma ideia só por arte, a do objetivo, legível em 1 segundo no celular: título com 80 px ou mais no feed e 96 px ou mais no story.
- Pouco texto na arte (o Meta entrega menos quando a imagem é quase só texto): o título, no máximo uma linha de apoio e a marca.
- O produto ou a pessoa usando é o maior elemento, de preferência a foto real da lista. A marca aparece com o logo de verdade, visível sem precisar procurar.
- Contraste forte entre texto e fundo; em cima de foto, use um degradê ou uma área limpa.`
