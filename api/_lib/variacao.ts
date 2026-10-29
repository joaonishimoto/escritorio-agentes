import type { Contexto } from './contexto.js'
import { db } from './db.js'

// Variação entre posts: o código sorteia caminhos pouco usados (sem gastar token) e a equipe recebe um
// resumo curto dos últimos posts para não repetir gancho, estrutura, layout nem fecho.

export const ESTRUTURAS = {
  'receita-direta': 'uma receita só, com ingredientes e preparo, sem enrolação',
  'um-ingrediente': 'parte de um ingrediente que a pessoa já tem e mostra o que dá pra fazer com ele',
  'mito-verdade': 'mitos e verdades, ou o erro que quase todo mundo comete e como acertar',
  historia: 'história ou curiosidade de origem, contada como um causo, com começo, virada e fim',
  comparacao: 'isto ou aquilo: duas versões lado a lado e a diferença entre elas',
  'passo-a-passo': 'uma técnica em passos numerados, um passo por slide',
  quiz: 'uma pergunta ou desafio na capa e a resposta revelada só no fim',
  lista: 'lista curta com um critério claro (ex.: 3 opções para uma situação)',
  situacao: 'uma cena real do dia a dia (visita chegando, sexta à noite, geladeira quase vazia) e a saída para ela',
  manifesto: 'uma ideia forte da marca em pouquíssimas palavras; bom para foto única',
} as const

export const LAYOUTS = {
  'foto-cheia': 'foto ocupando o slide inteiro e texto curto sobre um degradê, na área livre da foto',
  'tipografico-cor': 'fundo sólido na cor de destaque da marca, título enorme em contraste, sem foto na capa',
  'editorial-claro': 'fundo claro (off-white), texto escuro, a cor de destaque só em um detalhe, foto em moldura com margem',
  dividido: 'slide dividido ao meio: foto de um lado, texto do outro, alternando o lado a cada slide',
  'numero-gigante': 'um número ou palavra enorme como elemento principal de cada slide (dose, passo, ano, ranking)',
  'ficha-tecnica': 'cara de ficha de bar ou cartão de receita: linhas finas, colunas, rótulos pequenos em caixa alta',
  'minimalista-escuro': 'fundo escuro, muito espaço vazio, uma frase centralizada e um único detalhe na cor de destaque',
  colagem: 'cartões ou recortes sobrepostos, levemente girados, como um mural de ingredientes e anotações',
} as const

export const VOZES = {
  direta: 'frases secas e curtas, afirmativas, sem pergunta nenhuma',
  conversa: 'amigo contando no bar, primeira pessoa do plural, com um detalhe pessoal',
  curiosa: 'jornalista curioso: abre com um fato concreto e específico, sem exclamação',
  humor: 'humor leve e autoironia, a partir de uma situação engraçada e reconhecível',
  didatica: 'quem ensina com paciência: explica o porquê de cada passo, sem jargão',
} as const

/** Para que o post existe: decide o fecho do texto e o que o revisor cobra no fim. */
export const OBJETIVOS = {
  vender: 'levar a pessoa a baixar, assinar ou comprar; termina com chamada de ação clara',
  engajar: 'fazer salvar, comentar ou mandar pra alguém; termina com um convite leve, sem venda',
  educar: 'ensinar algo útil; termina fechando a ideia ou com um convite leve, sem venda',
  marca: 'mostrar a marca e o jeito dela (branding, posicionamento); pouco texto, sem chamada de venda nem pedido de contato',
} as const

export type Estrutura = keyof typeof ESTRUTURAS
export type Layout = keyof typeof LAYOUTS
export type Voz = keyof typeof VOZES
export type Objetivo = keyof typeof OBJETIVOS

/** Vícios de texto que denunciam IA. Vale para todas as marcas, mesmo com o tom editado pelo app. */
export const CLICHES = `## Evite (soa como texto de IA)
- "Não é só X, é Y", "Mais do que X, Y", "E o melhor:", "O segredo é", "Descubra", "Você sabia que".
- Trio de palavras ou frases em sequência ("Simples. Rápido. Gostoso.").
- Travessão para pausa dramática; reticências de suspense.
- Pergunta na abertura e outra pergunta no fechamento do mesmo texto.
- Palavras vazias: "de verdade", "sem complicação", "experiência", "elevar", "perfeito para", "incrível", "irresistível".
- Emoji no fim de todo parágrafo; no máximo dois na legenda inteira.
- Frases todas do mesmo tamanho. Misture curtas com uma mais longa.
- Adjetivo no lugar de detalhe: prefira o concreto (o barulho do gelo, o limão espremido na mão, a garrafa esquecida no armário).`

interface Anterior {
  estrutura?: string
  layout?: string
  voz?: string
  angulo?: string
  capa?: string
  abertura?: string
  fecho?: string
}

/** Resumo dos últimos posts da marca (fora o atual): só o que serve para não repetir. */
export async function postsRecentes(ctx: Contexto, limite = 8): Promise<Anterior[]> {
  const { data: posts } = await db
    .from('posts')
    .select('id')
    .eq('marca_id', ctx.marca.id)
    .neq('id', ctx.post.id)
    .order('criado_em', { ascending: false })
    .limit(limite)
  const ids = (posts ?? []).map((p) => p.id as string)
  if (!ids.length) return []
  const { data: passos } = await db
    .from('passos')
    .select('post_id, agente, saida')
    .in('post_id', ids)
    .in('agente', ['chefe', 'redator'])
    .eq('status', 'feito')
    .order('terminado_em')
  const porPost = new Map<string, Anterior>()
  for (const p of passos ?? []) {
    const a = porPost.get(p.post_id) ?? {}
    const s = (p.saida ?? {}) as Record<string, unknown>
    if (p.agente === 'chefe') Object.assign(a, { estrutura: s.estrutura, layout: s.layout, voz: s.voz, angulo: s.angulo })
    else {
      const slides = (s.slides ?? []) as { titulo?: string }[]
      const linhas = String(s.legenda ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && !/moderação|menores de 18/i.test(l))
      Object.assign(a, { capa: slides[0]?.titulo, abertura: linhas[0], fecho: linhas.length > 1 ? linhas[linhas.length - 1] : undefined })
    }
    porPost.set(p.post_id, a)
  }
  return ids.map((id) => porPost.get(id)).filter((a): a is Anterior => !!a)
}

/** Sorteia `n` opções, priorizando as menos usadas nos posts recentes (as mais recentes pesam mais). */
function sortear<K extends string>(opcoes: readonly K[], usados: (string | undefined)[], n: number): K[] {
  const peso = new Map<string, number>()
  usados.forEach((u, i) => u && peso.set(u, (peso.get(u) ?? 0) + (usados.length - i)))
  return [...opcoes]
    .map((o) => ({ o, p: (peso.get(o) ?? 0) + Math.random() }))
    .sort((a, b) => a.p - b.p)
    .slice(0, n)
    .map((x) => x.o)
}

/** Caminhos sugeridos ao chefe de pauta: ele escolhe um de cada, o que combinar com o pedido. */
export function sugerirCaminhos(recentes: Anterior[]) {
  return {
    estruturas: sortear(Object.keys(ESTRUTURAS) as Estrutura[], recentes.map((r) => r.estrutura), 3),
    layouts: sortear(Object.keys(LAYOUTS) as Layout[], recentes.map((r) => r.layout), 3),
    vozes: sortear(Object.keys(VOZES) as Voz[], recentes.map((r) => r.voz), 2),
  }
}

const lista = <T extends Record<string, string>>(cat: T, ids: (keyof T)[]) => ids.map((id) => `- ${String(id)}: ${cat[id]}`).join('\n')

export function textoCaminhos(c: ReturnType<typeof sugerirCaminhos>) {
  return [
    '## Caminhos para este post (escolha um de cada, o que servir melhor ao pedido)',
    `Estrutura:\n${lista(ESTRUTURAS, c.estruturas)}`,
    `Layout:\n${lista(LAYOUTS, c.layouts)}`,
    `Voz do texto:\n${lista(VOZES, c.vozes)}`,
    'Estas foram sorteadas entre as menos usadas nos últimos posts. Só fuja delas se o pedido exigir outra coisa (ex.: pediu receita, pediu história); nesse caso escolha outra do catálogo que não tenha sido usada recentemente.',
  ].join('\n\n')
}

/** O que já saiu nos últimos posts, para o redator não repetir. */
export function textoJaUsado(recentes: Anterior[]) {
  const capas = recentes.map((r) => r.capa).filter(Boolean)
  const aberturas = recentes.map((r) => r.abertura).filter(Boolean)
  const fechos = recentes.map((r) => r.fecho).filter(Boolean)
  if (!capas.length && !aberturas.length) return ''
  return [
    '## Já usado nos últimos posts (não repita nem parafraseie: frase, estrutura de frase ou fecho)',
    capas.length ? `Capas:\n${capas.map((c) => `- ${c}`).join('\n')}` : '',
    aberturas.length ? `Primeira linha da legenda:\n${aberturas.map((c) => `- ${c}`).join('\n')}` : '',
    fechos.length ? `Fecho da legenda:\n${fechos.map((c) => `- ${c}`).join('\n')}` : '',
    'As frases de exemplo do tom de voz mostram o jeito de falar; não são para copiar. A frase-base da marca não vai na capa.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Direção visual da pauta para o designer, com os layouts recentes para fugir deles. */
export function textoLayout(layout: string | undefined, recentes: Anterior[]) {
  const desc = layout && layout in LAYOUTS ? LAYOUTS[layout as Layout] : ''
  const usados = [...new Set(recentes.slice(0, 4).map((r) => r.layout).filter(Boolean))]
  return [
    desc ? `## Direção de layout deste post: ${layout}\n${desc}` : '',
    usados.length ? `Layouts dos últimos posts (este precisa parecer diferente deles): ${usados.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Fecha a pauta com o que não fica a critério do modelo: o formato manda na quantidade de slides
 * (foto e Reel têm uma imagem só), a quantidade escolhida pelo dono vale, e o plano acompanha a quantidade.
 */
export function fecharPauta<T extends { formato: string; quantidade_slides: number; plano_slides: string[] }>(pauta: T, slides?: number): T {
  const p = { ...pauta, plano_slides: [...pauta.plano_slides] }
  if (p.formato !== 'carrossel') p.quantidade_slides = 1
  else if (slides && slides >= 2) p.quantidade_slides = Math.min(10, slides)
  else p.quantidade_slides = Math.min(10, Math.max(2, p.plano_slides.length || p.quantidade_slides))
  if (p.plano_slides.length > p.quantidade_slides) {
    // o que sobrar do plano vira parte do último slide, em vez de virar um slide a mais
    const resto = p.plano_slides.splice(p.quantidade_slides - 1)
    p.plano_slides.push(resto.join(' / '))
  }
  return p
}
