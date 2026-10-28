import { z } from 'zod'
import { gerarJson, gerarTexto } from '../claude.js'
import { sistemaDoAgente } from '../contexto.js'
import { BUCKET_POSTS, db, urlPublica } from '../db.js'
import { renderizarSlides } from '../render.js'
import { feedback, type Agente, type Resultado } from './tipos.js'

// ───────── Chefe de pauta ─────────
const Pauta = z.object({
  formato: z.enum(['carrossel', 'foto', 'reel']),
  angulo: z.string(),
  publico: z.string(),
  promessa: z.string().describe('a promessa do post em uma frase'),
  quantidade_slides: z.number().int(),
  plano_slides: z.array(z.string()).describe('o que vai em cada slide, na ordem'),
  precisa_pesquisa: z.array(z.string()).describe('fatos ou dados que o pesquisador precisa confirmar'),
})

export const chefe: Agente = async (ctx, _passo, em) => {
  await em.inicio(`Lendo o pedido: ${ctx.post.briefing.slice(0, 90)}`)
  await em.acao(`Carregando o roteiro e ${ctx.regras.length} regras aprendidas de ${ctx.marca.nome}`)
  const { dados, uso } = await gerarJson({
    modelo: 'claude-sonnet-5-5',
    sistema: sistemaDoAgente(ctx, 'chefe', 'Você transforma o pedido em uma pauta clara para a equipe.'),
    conteudo: `Pedido do dono da marca:\n${ctx.post.briefing}\n\nMonte a pauta. Carrossel tem de 2 a 10 slides, incluindo capa e chamada final.`,
    schema: Pauta,
  })
  await em.texto(`Formato: ${dados.formato}, ${dados.quantidade_slides} slides.\nÂngulo: ${dados.angulo}\nPromessa: ${dados.promessa}\n`)
  await db.from('posts').update({ formato: dados.formato }).eq('id', ctx.post.id)
  return { saida: dados, uso, entrega: 'Pauta pronta' }
}

// ───────── Pesquisador ─────────
export const pesquisador: Agente = async (ctx, passo, em) => {
  const pauta = ctx.saidas.chefe as z.infer<typeof Pauta> | undefined
  await em.inicio('Começando a pesquisa')
  const { texto, uso } = await gerarTexto({
    modelo: 'claude-sonnet-5-5',
    sistema: sistemaDoAgente(
      ctx,
      'pesquisador',
      'Você levanta fatos confiáveis para o post. Fato histórico precisa de duas fontes; o que divergir, marque como "dizem" ou deixe de fora. Cite as fontes.',
    ),
    conteudo: `Pedido: ${ctx.post.briefing}\n\nPauta:\n${JSON.stringify(pauta, null, 2)}\n\nPesquise e entregue notas curtas e verificadas, em tópicos, com as fontes no fim.${feedback(passo)}`,
    buscaWeb: 5,
    aoEscrever: (t) => em.texto(t),
    aoBuscar: (q) => em.acao(`Buscando: ${q}`),
  })
  return { saida: { notas: texto }, uso, entrega: 'Pesquisa conferida' }
}

// ───────── Redator ─────────
const Texto = z.object({
  slides: z.array(
    z.object({
      tipo: z.enum(['capa', 'conteudo', 'cta']),
      etiqueta: z.string().describe('texto curto da pílula no topo, pode ser vazio'),
      titulo: z.string(),
      destaque: z.string().describe('parte do título que vai na cor de destaque, pode ser vazio'),
      corpo: z.string().describe('texto de apoio, pode ser vazio'),
      itens: z.array(z.object({ quantidade: z.string(), item: z.string() })).describe('lista (ex.: ingredientes), pode ser vazia'),
      foto: z.string().describe('descrição da foto ideal, ou vazio se não usa foto'),
    }),
  ),
  legenda: z.string(),
})

export const redator: Agente = async (ctx, passo, em) => {
  await em.inicio('Escrevendo o gancho da capa')
  const { dados, uso } = await gerarJson({
    modelo: 'claude-opus-5-5',
    effort: 'high',
    sistema: sistemaDoAgente(ctx, 'redator', 'Você escreve o texto dos slides e a legenda.'),
    conteudo: `Pedido: ${ctx.post.briefing}\n\nPauta:\n${JSON.stringify(ctx.saidas.chefe, null, 2)}\n\nPesquisa:\n${(ctx.saidas.pesquisador as { notas?: string })?.notas ?? '(sem pesquisa)'}\n\nUse só fatos da pesquisa.${feedback(passo)}`,
    schema: Texto,
  })
  for (const [i, s] of dados.slides.entries()) await em.texto(`Slide ${i + 1}: ${s.titulo}\n`)
  await em.texto(`\nLegenda:\n${dados.legenda}\n`)
  await db.from('posts').update({ legenda: dados.legenda }).eq('id', ctx.post.id)
  return { saida: dados, uso, entrega: 'Texto pronto' }
}

// ───────── Designer ─────────
interface Correcao {
  comentario: string
  instrucao: string
  pontual: boolean
}

const Trocas = z.object({
  trocas: z
    .array(z.object({ de: z.string().describe('trecho exato que existe hoje no HTML'), para: z.string() }))
    .describe('substituições mínimas no HTML dos slides; vazio se só a legenda muda'),
  legenda: z.string().describe('a legenda completa já ajustada, ou vazio se a legenda não muda'),
})

async function salvarSlides(ctx: Parameters<Agente>[0], passo: Parameters<Agente>[1], html: string) {
  const imagens = await renderizarSlides(html)
  const pasta = `${ctx.post.id}/v${passo.tentativas}-${Date.now()}`
  const slides = []
  for (const [i, img] of imagens.entries()) {
    const caminho = `${pasta}/slide-${i + 1}.jpg`
    const { error } = await db.storage.from(BUCKET_POSTS).upload(caminho, img, { contentType: 'image/jpeg', upsert: true })
    if (error) throw new Error(`Falha ao subir slide ${i + 1}: ${error.message}`)
    slides.push({ ordem: i + 1, caminho, url: urlPublica(caminho) })
  }
  await db.from('posts').update({ slides }).eq('id', ctx.post.id)
  return slides
}

/** Ajuste pequeno pedido por você: edita o HTML pronto em vez de refazer tudo. Devolve null se não deu para editar. */
async function ajustePontual(ctx: Parameters<Agente>[0], passo: Parameters<Agente>[1], em: Parameters<Agente>[2], correcao: Correcao) {
  const anterior = (ctx.saidas.designer as { html?: string } | undefined)?.html
  if (!anterior) return null
  await em.inicio('Ajuste pequeno: editando os slides prontos')
  const { dados, uso } = await gerarJson({
    modelo: 'claude-sonnet-5-5',
    effort: 'low',
    sistema: sistemaDoAgente(
      ctx,
      'designer',
      'Você aplica um ajuste pequeno em slides prontos. Mude só o que foi pedido, com substituições exatas e mínimas. Não reescreva nada além disso.',
    ),
    conteudo: `## Pedido do dono da marca\n${correcao.comentario}\n${correcao.instrucao}\n\n## Legenda atual\n${ctx.post.legenda ?? ''}\n\n## HTML atual dos slides\n${anterior}${feedback(passo)}`,
    schema: Trocas,
  })
  let html = anterior
  for (const t of dados.trocas) {
    if (!t.de || !html.includes(t.de)) return null
    html = html.split(t.de).join(t.para)
  }
  if (dados.legenda.trim()) {
    await db.from('posts').update({ legenda: dados.legenda }).eq('id', ctx.post.id)
    ctx.post.legenda = dados.legenda
  }
  let slides = ctx.post.slides
  if (html !== anterior) {
    await em.acao('Renderizando de novo')
    slides = await salvarSlides(ctx, passo, html)
  }
  return { saida: { html, slides }, uso, entrega: 'Ajuste aplicado' }
}

export const designer: Agente = async (ctx, passo, em) => {
  const correcao = passo.entrada.correcao as Correcao | undefined
  if (correcao?.pontual) {
    const r = await ajustePontual(ctx, passo, em, correcao)
    if (r) return r
    await em.acao('Não deu para editar direto, refazendo os slides')
  }
  await em.inicio('Escolhendo as fotos aprovadas')
  const { data: midias } = await db.from('midias').select('caminho, descricao, tags').eq('marca_id', ctx.marca.id).eq('aprovada', true)
  const fotos = (midias ?? []).map((m) => ({ url: db.storage.from('marcas').getPublicUrl(m.caminho).data.publicUrl, descricao: m.descricao, tags: m.tags }))

  await em.acao(`Montando os slides no modelo de ${ctx.marca.nome}`)
  const gerado = await gerarTexto({
    modelo: 'claude-sonnet-5-5',
    sistema: sistemaDoAgente(
      ctx,
      'designer',
      'Você monta os slides em HTML. Responda SOMENTE com um documento HTML completo, sem comentários antes ou depois. Cada slide é um <section class="slide"> de exatamente 1080x1350 px, com overflow hidden. Use apenas as fotos da lista (URLs absolutas). Fontes só do Google Fonts. Texto do corpo com no mínimo 28 px. Não use emojis dentro dos slides (eles não renderizam); para setas use o caractere → ou desenhe com CSS.',
    ),
    conteudo: [
      ctx.marca.modelo_slides_html ? `## Modelo da marca (siga o visual e as classes)\n${ctx.marca.modelo_slides_html}` : '## Sem modelo da marca: crie um visual limpo com as cores da identidade.',
      `## Fotos aprovadas disponíveis\n${fotos.length ? JSON.stringify(fotos, null, 2) : '(nenhuma: faça slides só com tipografia e cor)'}`,
      `## Texto dos slides (não mude o texto)\n${JSON.stringify((ctx.saidas.redator as z.infer<typeof Texto>)?.slides, null, 2)}`,
      feedback(passo),
    ].join('\n\n'),
  })
  const html = gerado.texto.replace(/^[\s\S]*?(<!doctype|<html)/i, '$1').replace(/```\s*$/, '').trim()

  await em.acao('Renderizando JPEG 1080 × 1350')
  const slides = await salvarSlides(ctx, passo, html)
  return { saida: { html, slides }, uso: gerado.uso, entrega: `${slides.length} slides renderizados` }
}

// ───────── Revisor ─────────
const Revisao = z.object({
  aprovado: z.boolean(),
  problemas: z.array(
    z.object({
      agente: z.enum(['pesquisador', 'redator', 'designer']),
      problema: z.string().describe('o que falhou e como corrigir, citando o item do checklist ou a regra'),
    }),
  ),
  resumo: z.string(),
})

const MAX_VOLTAS = 2

export const revisor: Agente = async (ctx, passo, em) => {
  const correcao = passo.entrada.correcao as Correcao | undefined
  if (correcao) return revisarCorrecao(ctx, passo, em, correcao)
  await em.inicio(`Conferindo o checklist e ${ctx.regras.length} regras aprendidas`)
  const slides = ctx.post.slides ?? []
  const { dados, uso } = await gerarJson({
    modelo: 'claude-opus-5-5',
    effort: 'high',
    sistema: sistemaDoAgente(
      ctx,
      'revisor',
      'Você confere o post antes de ir para o dono da marca. Olhe as imagens de verdade. Só aprove se todos os itens passarem.',
    ),
    conteudo: [
      ...slides.map((s) => ({ type: 'image' as const, source: { type: 'url' as const, url: s.url } })),
      {
        type: 'text' as const,
        text: `Acima estão os ${slides.length} slides, na ordem.\n\n## Legenda\n${ctx.post.legenda ?? '(sem legenda)'}\n\n## Pesquisa usada\n${(ctx.saidas.pesquisador as { notas?: string })?.notas ?? ''}\n\n## Checklist do revisor\n${ctx.marca.checklist_revisor}\n\nConfira item por item.`,
      },
    ],
    schema: Revisao,
  })

  if (dados.aprovado || ctx.post.voltas_revisao >= MAX_VOLTAS) {
    const pendencias = dados.aprovado ? '' : `\n\nPendências após ${MAX_VOLTAS} voltas:\n${dados.problemas.map((p) => `- [${p.agente}] ${p.problema}`).join('\n')}`
    await db.from('posts').update({ status: 'aguardando_aprovacao' }).eq('id', ctx.post.id)
    await em.texto(dados.resumo + pendencias)
    return {
      saida: dados,
      uso,
      entrega: dados.aprovado ? 'Tudo certo. Enviado para sua aprovação' : 'Enviado com pendências para você decidir',
      proximos: null,
      para: 'voce',
    }
  }

  // devolve para o primeiro agente com problema; os seguintes refazem na sequência
  const ordem = ['pesquisador', 'redator', 'designer']
  const primeiro = ordem.find((a) => dados.problemas.some((p) => p.agente === a)) ?? 'designer'
  const texto = dados.problemas.map((p) => `- [${p.agente}] ${p.problema}`).join('\n')
  await db.from('posts').update({ voltas_revisao: ctx.post.voltas_revisao + 1 }).eq('id', ctx.post.id)
  await em.texto(texto)
  return {
    saida: dados,
    uso,
    entrega: `Devolvido: ${dados.problemas[0]?.problema.slice(0, 80) ?? 'ajustes'}`,
    proximos: [{ agente: primeiro, entrada: { feedback: texto } }],
  }
}

const ConferenciaDeAjuste = z.object({
  aplicado: z.boolean().describe('o pedido foi atendido e nada que estava certo quebrou'),
  problema: z.string().describe('o que falta ou quebrou, vazio se está tudo certo'),
})

/** Depois de uma correção sua, o revisor só confere se o pedido foi atendido; não reabre o post inteiro. */
async function revisarCorrecao(ctx: Parameters<Agente>[0], passo: Parameters<Agente>[1], em: Parameters<Agente>[2], correcao: Correcao): Promise<Resultado> {
  await em.inicio('Conferindo se o seu ajuste foi aplicado')
  const slides = ctx.post.slides ?? []
  const { dados, uso } = await gerarJson({
    modelo: 'claude-sonnet-5-5',
    effort: 'low',
    sistema: sistemaDoAgente(ctx, 'revisor', 'Você confere se um ajuste pedido pelo dono da marca foi aplicado. Olhe só o pedido e se algo visivelmente quebrou (texto cortado, sobreposto, caractere estranho). Não reavalie o resto do post.'),
    conteudo: [
      ...slides.map((s) => ({ type: 'image' as const, source: { type: 'url' as const, url: s.url } })),
      { type: 'text' as const, text: `## Ajuste pedido\n${correcao.comentario}\n\n## Legenda\n${ctx.post.legenda ?? ''}` },
    ],
    schema: ConferenciaDeAjuste,
  })
  if (dados.aplicado || ctx.post.voltas_revisao >= 1) {
    await db.from('posts').update({ status: 'aguardando_aprovacao' }).eq('id', ctx.post.id)
    await em.texto(dados.aplicado ? 'Ajuste aplicado.' : `Pendência: ${dados.problema}`)
    return { saida: dados, uso, entrega: dados.aplicado ? 'Ajuste conferido. De volta pra você' : 'Enviado com pendência para você decidir', proximos: null, para: 'voce' }
  }
  await db.from('posts').update({ voltas_revisao: ctx.post.voltas_revisao + 1 }).eq('id', ctx.post.id)
  await em.texto(dados.problema)
  return {
    saida: dados,
    uso,
    entrega: `Devolvido: ${dados.problema.slice(0, 80)}`,
    proximos: [{ agente: 'designer', entrada: { feedback: dados.problema, correcao } }],
  }
}
