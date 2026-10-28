import { z } from 'zod'
import { gerarJson, gerarTexto } from '../claude.js'
import { referenciasDoPost, sistemaDoAgente } from '../contexto.js'
import { BUCKET_POSTS, db, urlPublica } from '../db.js'
import { renderizarSlides } from '../render.js'
import { feedback, USO_ZERO, type Agente, type Resultado } from './tipos.js'

// ───────── Chefe de pauta ─────────
const Pauta = z.object({
  formato: z.enum(['carrossel', 'foto', 'reel']),
  angulo: z.string(),
  publico: z.string(),
  promessa: z.string().describe('a promessa do post em uma frase'),
  quantidade_slides: z.number().int(),
  plano_slides: z.array(z.string()).describe('o que vai em cada slide, na ordem'),
  precisa_pesquisa: z
    .array(z.string())
    .describe('fatos externos que o pesquisador precisa confirmar na web; vazio se o post não cita fato externo (ex.: só o app, uma oferta, uma receita da marca)'),
  referencias: z
    .string()
    .describe('se o dono mandou referências: o que cada uma mostra (estilo, cores, tipografia, composição, assunto) e como a equipe deve usar; vazio se não mandou'),
})

export const chefe: Agente = async (ctx, _passo, em) => {
  const refs = referenciasDoPost(ctx)
  await em.inicio(`Lendo o pedido: ${ctx.post.briefing.slice(0, 90)}`)
  if (refs.tem) await em.acao(`Olhando as ${ctx.post.referencias!.length} referências que você mandou`)
  await em.acao(`Carregando o roteiro e ${ctx.regras.length} regras aprendidas de ${ctx.marca.nome}`)
  const { dados, uso } = await gerarJson({
    modelo: 'claude-sonnet-5-5',
    effort: 'low',
    sistema: sistemaDoAgente(ctx, 'chefe', 'Você transforma o pedido em uma pauta clara para a equipe.'),
    conteudo: [
      ...refs.blocos,
      {
        type: 'text' as const,
        text: `Pedido do dono da marca:\n${ctx.post.briefing}\n\n${refs.texto}\n\nMonte a pauta. Carrossel tem de 2 a 10 slides, incluindo capa e chamada final.`,
      },
    ],
    schema: Pauta,
  })
  await em.texto(`Formato: ${dados.formato}, ${dados.quantidade_slides} slides.\nÂngulo: ${dados.angulo}\nPromessa: ${dados.promessa}\n`)
  await db.from('posts').update({ formato: dados.formato }).eq('id', ctx.post.id)
  return { saida: dados, uso, entrega: 'Pauta pronta' }
}

// ───────── Pesquisador ─────────
export const pesquisador: Agente = async (ctx, passo, em) => {
  const pauta = ctx.saidas.chefe as z.infer<typeof Pauta> | undefined
  // devolvido pelo revisor: parte das notas que já existem e só corrige os pontos apontados
  const anteriores = (ctx.saidas.pesquisador as { notas?: string } | undefined)?.notas
  const devolvido = !!passo.entrada.feedback && !!anteriores
  // pauta sem fato externo para conferir: não gasta busca nem modelo
  if (!passo.entrada.feedback && pauta && !pauta.precisa_pesquisa?.length) {
    await em.inicio('Nada para pesquisar nesta pauta')
    return { saida: { notas: 'Sem pesquisa: a pauta não cita fatos externos. Não invente dados históricos ou números.' }, uso: USO_ZERO, entrega: 'Sem fatos para conferir' }
  }
  await em.inicio(devolvido ? 'Corrigindo só os pontos que o revisor apontou' : 'Começando a pesquisa')
  const { texto, uso } = await gerarTexto({
    modelo: 'claude-sonnet-5-5',
    sistema: sistemaDoAgente(
      ctx,
      'pesquisador',
      'Você levanta fatos confiáveis para o post. Fato histórico precisa de duas fontes; o que divergir, marque como "dizem" ou deixe de fora. Cite as fontes.',
    ),
    conteudo: devolvido
      ? `Pedido: ${ctx.post.briefing}\n\n## Suas notas anteriores\n${anteriores}\n\nRefaça as notas mantendo tudo o que está certo e corrigindo só o que foi apontado para o pesquisador abaixo. Ignore os pontos de outros agentes. Busque na web só o necessário.${feedback(passo)}`
      : `Pedido: ${ctx.post.briefing}\n\nPromessa do post: ${pauta?.promessa ?? ''}\nPlano dos slides: ${JSON.stringify(pauta?.plano_slides ?? [])}\n\n## Fatos a confirmar\n${(pauta?.precisa_pesquisa ?? []).map((f) => `- ${f}`).join('\n')}\n\n${referenciasDoPost(ctx).texto}\n\nConfirme só esses fatos, agrupando buscas quando der. Entregue notas curtas e verificadas, em tópicos, com as fontes no fim. Nada de introdução nem resumo.${feedback(passo)}`,
    buscaWeb: devolvido ? 2 : 3,
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
  // numa volta (revisor ou correção sua) parte do texto que já existe e mexe só no que foi pedido
  const anterior = ctx.saidas.redator as z.infer<typeof Texto> | undefined
  const ajuste = !!passo.entrada.feedback && !!anterior?.slides?.length
  await em.inicio(ajuste ? 'Ajustando só o que foi apontado no texto' : 'Escrevendo o gancho da capa')
  const { dados, uso } = await gerarJson({
    modelo: 'claude-opus-5-5',
    effort: 'medium',
    sistema: sistemaDoAgente(ctx, 'redator', 'Você escreve o texto dos slides e a legenda.'),
    conteudo: [
      `Pedido: ${ctx.post.briefing}`,
      `Pauta:\n${JSON.stringify(ctx.saidas.chefe)}`,
      `Pesquisa:\n${(ctx.saidas.pesquisador as { notas?: string })?.notas ?? '(sem pesquisa)'}`,
      ajuste
        ? `## Seu texto anterior\n${JSON.stringify(anterior)}\n\nDevolva o texto completo, igual ao anterior em tudo o que está certo, mudando só o que os ajustes abaixo pedem (e o que depender de uma pesquisa corrigida).`
        : '',
      `Use só fatos da pesquisa.${feedback(passo)}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
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
  refazer: z.boolean().describe('true se não dá para atender com trocas pequenas (muda a quantidade de slides, o layout inteiro ou quase todo o texto)'),
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

/**
 * Volta para o designer (ajuste seu, devolução do revisor ou texto novo do redator): edita o HTML pronto
 * com trocas pequenas em vez de montar tudo de novo. Devolve null se não deu para editar.
 */
async function editarSlides(ctx: Parameters<Agente>[0], passo: Parameters<Agente>[1], em: Parameters<Agente>[2], pedido: string) {
  const anterior = (ctx.saidas.designer as { html?: string } | undefined)?.html
  if (!anterior) return null
  await em.inicio('Editando os slides prontos')
  const { dados, uso } = await gerarJson({
    modelo: 'claude-sonnet-5-5',
    effort: 'low',
    sistema: sistemaDoAgente(
      ctx,
      'designer',
      'Você aplica ajustes em slides prontos. Mude só o que foi pedido, com substituições exatas e mínimas. Não reescreva nada além disso. Nunca apague texto que o dono não pediu para tirar. Se o problema é um caractere que saiu como quadradinho (seta, símbolo), mantenha o texto e o caractere: o renderizador já desenha setas →; troque só símbolos que não sejam setas.',
    ),
    conteudo: [
      `## O que mudar\n${pedido}`,
      `## Texto dos slides (versão atual do redator; se diferir do HTML, o HTML deve passar a seguir este texto)\n${JSON.stringify((ctx.saidas.redator as z.infer<typeof Texto> | undefined)?.slides ?? [])}`,
      `## Legenda atual\n${ctx.post.legenda ?? ''}`,
      `## HTML atual dos slides\n${anterior}`,
    ].join('\n\n'),
    schema: Trocas,
  })
  if (dados.refazer) return null
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
  const apontado = passo.entrada.feedback as string | undefined
  const pedido = [correcao ? `Pedido do dono da marca: ${correcao.comentario}\n${correcao.instrucao}` : '', apontado ? `Apontado nesta rodada:\n${apontado}` : '']
    .filter(Boolean)
    .join('\n\n')
  // numa volta, quem chega aqui tenta primeiro editar o que já existe (bem mais barato que refazer)
  if (pedido) {
    const r = await editarSlides(ctx, passo, em, pedido)
    if (r) return r
    await em.acao('Não deu para editar direto, refazendo os slides')
  }
  await em.inicio('Escolhendo as fotos aprovadas')
  const { data: midias } = await db.from('midias').select('caminho, descricao, tags').eq('marca_id', ctx.marca.id).eq('aprovada', true)
  const fotos = (midias ?? []).map((m) => ({ url: db.storage.from('marcas').getPublicUrl(m.caminho).data.publicUrl, descricao: m.descricao, tags: m.tags }))

  const refsDesign = referenciasDoPost(ctx)
  await em.acao(ctx.marca.identidade?.neutra ? 'Montando os slides no estilo das referências' : `Montando os slides no modelo de ${ctx.marca.nome}`)
  const gerado = await gerarTexto({
    modelo: 'claude-sonnet-5-5',
    sistema: sistemaDoAgente(
      ctx,
      'designer',
      'Você monta os slides em HTML. Responda SOMENTE com um documento HTML completo, sem comentários antes ou depois. Cada slide é um <section class="slide"> de exatamente 1080x1350 px, com overflow hidden. Use apenas as fotos da lista ou as imagens de referência (URLs absolutas). Fontes só do Google Fonts. Texto do corpo com no mínimo 28 px. Não use emojis dentro dos slides (eles não renderizam); para setas use o caractere →, que o renderizador desenha.',
    ),
    conteudo: [
      ...refsDesign.blocos,
      {
        type: 'text' as const,
        text: [
          ctx.marca.modelo_slides_html ? `## Modelo da marca (siga o visual e as classes)\n${ctx.marca.modelo_slides_html}` : (refsDesign.tem ? '## Sem modelo fixo: o visual vem das referências.' : '## Sem modelo da marca: crie um visual limpo com as cores da identidade.'),
          `## Fotos aprovadas disponíveis\n${fotos.length ? JSON.stringify(fotos) : '(nenhuma: faça slides só com tipografia e cor)'}`,
          refsDesign.tem
            ? `${refsDesign.texto}\n\nO que o chefe de pauta viu nelas: ${(ctx.saidas.chefe as { referencias?: string } | undefined)?.referencias ?? ''}\nSiga o estilo visual das referências. As imagens de referência também podem entrar nos slides (URLs acima) se combinarem com o pedido.`
            : '',
          `## Texto dos slides (não mude o texto)\n${JSON.stringify((ctx.saidas.redator as z.infer<typeof Texto>)?.slides)}`,
          feedback(passo),
        ].join('\n\n'),
      },
    ],
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
  // depois de uma devolução, confere se o que ele mesmo apontou foi resolvido, em vez de reabrir o post inteiro
  const anterior = ctx.post.voltas_revisao > 0 ? (ctx.saidas.revisor as z.infer<typeof Revisao> | undefined) : undefined
  const reconferindo = !!anterior?.problemas?.length
  await em.inicio(reconferindo ? 'Conferindo se o que apontei foi resolvido' : `Conferindo o checklist e ${ctx.regras.length} regras aprendidas`)
  const slides = ctx.post.slides ?? []
  const precisaPesquisa = !reconferindo || anterior!.problemas.some((p) => p.agente === 'pesquisador' || p.agente === 'redator')
  const { dados, uso } = await gerarJson({
    modelo: 'claude-sonnet-5-5',
    effort: reconferindo ? 'low' : 'medium',
    sistema: sistemaDoAgente(
      ctx,
      'revisor',
      'Você confere o post antes de ir para o dono da marca. Olhe as imagens de verdade. Só aprove se todos os itens passarem. Atribua cada problema ao agente que consegue resolver: visual, layout, texto cortado ou sobreposto é do designer; erro de texto ou legenda é do redator. Só aponte o pesquisador se um fato estiver errado ou sem fonte e der para corrigir com busca na web. Itens que a equipe não tem como conferir (dados internos, como as receitas do app) não são problema: cite no resumo para o dono conferir. Seja direto: cada problema em uma frase, resumo em até três frases.',
    ),
    conteudo: [
      ...slides.map((s) => ({ type: 'image' as const, source: { type: 'url' as const, url: s.url } })),
      {
        type: 'text' as const,
        text: [
          `Acima estão os ${slides.length} slides, na ordem.`,
          `## Legenda\n${ctx.post.legenda ?? '(sem legenda)'}`,
          precisaPesquisa ? `## Pesquisa usada\n${(ctx.saidas.pesquisador as { notas?: string })?.notas ?? ''}` : '',
          reconferindo
            ? `## O que você apontou na rodada anterior\n${anterior!.problemas.map((p) => `- [${p.agente}] ${p.problema}`).join('\n')}\n\nConfira se cada ponto foi resolvido. Não reabra o que já tinha passado: só aponte problema novo se for grave (fato errado, texto cortado ou sobreposto, regra quebrada).`
            : `## Checklist do revisor\n${ctx.marca.checklist_revisor}\n\nConfira item por item.`,
        ]
          .filter(Boolean)
          .join('\n\n'),
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
