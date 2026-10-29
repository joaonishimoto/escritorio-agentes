import { z } from 'zod'
import { layoutAprovado } from '../aprovados.js'
import { oQueFuncionou } from '../atualizar-metricas.js'
import { gerarJson, gerarTexto, type Uso } from '../claude.js'
import { fluxoDeProducao, referenciasDoPost, rotaDaDevolucao, sistemaDoAgente } from '../contexto.js'
import { BUCKET_POSTS, db, urlPublica } from '../db.js'
import { gravarAnimacao } from '../animacao.js'
import { configDaMarca, gerarVoz, MODELO_VOZ } from '../elevenlabs.js'
import { juntarNarracao } from '../ffmpeg.js'
import { consultarVideoFal, custoFal, duracaoFal, MODELOS_FAL, pedirVideoFal } from '../fal.js'
import { modeloDe, modeloNaVolta, motorDeImagem, motorDeVideo, type MotorVideo } from '../ias.js'
import { gerarImagem, MAX_IMAGENS_POR_POST, MODELOS_IMAGEM, type MotorImagem } from '../imagens.js'
import { consultarVideo, custoDoVideo, MODELO_KLING, pedirVideo } from '../kling.js'
import { renderizarESalvar } from '../render-remoto.js'
import { separarSlides, type ProblemaDoSlide } from '../render.js'
import { CLICHES, ESTRUTURAS, fecharPauta, LAYOUTS, OBJETIVOS, postsRecentes, sugerirCaminhos, textoCaminhos, textoJaUsado, textoLayout, VOZES } from '../variacao.js'
import { ErroRetomavel, feedback, USO_ZERO, type Agente, type Resultado } from './tipos.js'

// ───────── Chefe de pauta ─────────
const Pauta = z.object({
  formato: z.enum(['carrossel', 'foto', 'reel']),
  objetivo: z.enum(Object.keys(OBJETIVOS) as [keyof typeof OBJETIVOS]).describe('para que o post existe; "marca" quando o pedido fala em branding, posicionamento ou só mostrar a marca'),
  fecho: z
    .string()
    .describe('como o post termina, no último slide e no fim da legenda, coerente com o objetivo (ex.: "Link na bio para baixar"; "convite para salvar a receita"; "frase de posicionamento, sem convite"); nunca um endereço de site'),
  angulo: z.string(),
  publico: z.string(),
  promessa: z.string().describe('a promessa do post em uma frase'),
  estrutura: z.enum(Object.keys(ESTRUTURAS) as [keyof typeof ESTRUTURAS]),
  layout: z.enum(Object.keys(LAYOUTS) as [keyof typeof LAYOUTS]),
  voz: z.enum(Object.keys(VOZES) as [keyof typeof VOZES]),
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
  const [recentes, funcionou] = await Promise.all([postsRecentes(ctx), oQueFuncionou(ctx)])
  if (funcionou) await em.acao('Olhando o que mais funcionou no Instagram da marca')
  const caminhos = sugerirCaminhos(recentes)
  const angulos = recentes.map((r) => r.angulo).filter(Boolean)
  const pref = ctx.post.preferencias ?? {}
  const escolhas = [
    pref.formato && `Formato: ${pref.formato}`,
    pref.estrutura && `Estrutura: ${pref.estrutura} (${ESTRUTURAS[pref.estrutura as keyof typeof ESTRUTURAS]})`,
    pref.layout && `Layout: ${pref.layout} (${LAYOUTS[pref.layout as keyof typeof LAYOUTS]})`,
    pref.voz && `Voz: ${pref.voz} (${VOZES[pref.voz as keyof typeof VOZES]})`,
    pref.slides && pref.formato !== 'reel' && `Quantidade de slides: ${pref.slides}`,
  ].filter(Boolean)
  const textoEscolhas = escolhas.length ? `\n\n## Escolhas do dono para este post (obrigatórias, valem mais que os caminhos sorteados)\n${escolhas.map((e) => `- ${e}`).join('\n')}` : ''
  const { dados, uso } = await gerarJson({
    modelo: modeloDe(ctx, 'chefe'),
    effort: 'low',
    sistema: sistemaDoAgente(ctx, 'chefe', 'Você transforma o pedido em uma pauta clara para a equipe.'),
    conteudo: [
      ...refs.blocos,
      {
        type: 'text' as const,
        text: `Pedido do dono da marca:\n${ctx.post.briefing}\n\n${refs.texto}\n\nMonte a pauta.\n\n## Formato e quantidade\n- Faça exatamente o que o pedido pede. "Um post", "uma imagem", "post único" ou "post simples" é foto: 1 imagem só, nunca carrossel. Carrossel só quando o pedido pede carrossel ou slides, ou quando a estrutura precisa de vários (receita com preparo, passo a passo, lista, mitos).\n- Carrossel tem de 2 a 10 slides, incluindo capa e o slide final. O plano tem um item por slide, nem mais nem menos que a quantidade.\n- Só escolha reel se o pedido falar em vídeo ou Reel: o vídeo é gerado por IA (cenas, sem texto na tela) e o reel tem 1 slide só, que é a capa. A quantidade de slides sai da estrutura escolhida, não de um padrão fixo.\n\n## Objetivo e fecho\n${Object.entries(OBJETIVOS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\nNem todo post é de venda. Se o pedido não fala em vender, baixar ou assinar, o objetivo não é vender.\n\n${textoCaminhos(caminhos)}${angulos.length ? `\n\n## Ângulos dos últimos posts (não repita)\n${angulos.map((a) => `- ${a}`).join('\n')}` : ''}${funcionou ? `\n\n${funcionou}` : ''}${textoEscolhas}`,
      },
    ],
    schema: Pauta,
  })
  // o que o dono escolheu não fica a critério do modelo
  if (pref.formato) dados.formato = pref.formato as typeof dados.formato
  if (pref.estrutura && pref.estrutura in ESTRUTURAS) dados.estrutura = pref.estrutura as typeof dados.estrutura
  if (pref.layout && pref.layout in LAYOUTS) dados.layout = pref.layout as typeof dados.layout
  if (pref.voz && pref.voz in VOZES) dados.voz = pref.voz as typeof dados.voz
  const pauta = fecharPauta(dados, pref.slides)
  await em.texto(`Formato: ${pauta.formato}, ${pauta.quantidade_slides} ${pauta.quantidade_slides === 1 ? 'imagem' : 'slides'}.\nObjetivo: ${pauta.objetivo} · Fecho: ${pauta.fecho}\nEstrutura: ${pauta.estrutura} · Layout: ${pauta.layout} · Voz: ${pauta.voz}\nÂngulo: ${pauta.angulo}\nPromessa: ${pauta.promessa}\n`)
  await db.from('posts').update({ formato: pauta.formato }).eq('id', ctx.post.id)
  return { saida: pauta, uso, entrega: 'Pauta pronta' }
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
  const { texto, uso, buscas } = await gerarTexto({
    modelo: modeloDe(ctx, 'pesquisador'),
    sistema: sistemaDoAgente(
      ctx,
      'pesquisador',
      'Você levanta fatos confiáveis para o post. Fato histórico precisa de duas fontes; o que divergir, marque como "dizem" ou deixe de fora. Cite as fontes.',
    ),
    conteudo: devolvido
      ? `Pedido: ${ctx.post.briefing}\n\n## Suas notas anteriores\n${anteriores}\n\nRefaça as notas mantendo tudo o que está certo e corrigindo só o que foi apontado para o pesquisador abaixo. Ignore os pontos de outros agentes. Busque na web só o necessário.${feedback(passo)}`
      : `Pedido: ${ctx.post.briefing}\n\nPromessa do post: ${pauta?.promessa ?? ''}\nPlano dos slides: ${JSON.stringify(pauta?.plano_slides ?? [])}\n\n## Fatos a confirmar\n${(pauta?.precisa_pesquisa ?? []).map((f) => `- ${f}`).join('\n')}\n\n${referenciasDoPost(ctx).texto}\n\nConfirme só esses fatos, agrupando buscas quando der. Entregue notas curtas e verificadas, em tópicos, com as fontes no fim. Nada de introdução nem resumo.${feedback(passo)}`,
    // a busca com filtro roda várias consultas de uma vez: com 3 usos, um lote só já estourava o limite e nada voltava
    buscaWeb: devolvido ? 4 : 6,
    aoEscrever: (t) => em.texto(t),
    aoBuscar: (q) => em.acao(`Buscando: ${q}`),
  })
  // nenhuma busca deu certo: o revisor não manda refazer a pesquisa (falharia de novo), pede para suavizar o texto
  const buscaFalhou = !!buscas && buscas.erros.length > 0 && buscas.feitas === 0
  if (buscaFalhou) console.warn(`pesquisador: busca na web falhou (${buscas!.erros.join(', ')})`)
  return { saida: { notas: texto, ...(buscaFalhou ? { busca_falhou: buscas!.erros } : {}) }, uso, entrega: buscaFalhou ? 'Pesquisa sem fontes: a busca falhou' : 'Pesquisa conferida' }
}

// ───────── Redator ─────────
const Texto = z.object({
  slides: z.array(
    z.object({
      tipo: z.enum(['capa', 'conteudo', 'cta']),
      etiqueta: z.string().describe('selo curto de apoio (ex.: categoria, número do passo); deixe vazio na maioria dos slides, não é obrigatório'),
      titulo: z.string().describe('curto: até 8 palavras na capa, até 10 nos outros slides'),
      destaque: z.string().describe('parte do título que vai na cor de destaque, pode ser vazio'),
      corpo: z.string().describe('texto de apoio, até 30 palavras, pode ser vazio'),
      itens: z.array(z.object({ quantidade: z.string(), item: z.string() })).describe('lista (ex.: ingredientes), pode ser vazia'),
      foto: z.string().describe('descrição da foto ideal, ou vazio se não usa foto'),
    }),
  ),
  legenda: z.string(),
})

/** O que vale para o texto de toda marca: vem das correções do dono que se repetiam de marca em marca. */
const ESCRITA = `## Regras de escrita (todas as marcas)
- Nunca escreva endereço de site (www, .com, lp., use.) nos slides nem na legenda. Botão e chamada usam palavras comuns de ação ("Link na bio", "Começar grátis", "Baixe o app").
- @ de perfil do Instagram sempre em minúsculas, como está no perfil.
- O fecho segue o objetivo da pauta. Só "vender" pede chamada de venda (baixar, assinar, link na bio). "engajar" e "educar" fecham com um convite leve (salvar, mandar pra alguém, comentar) ou fechando a ideia. "marca" não tem chamada de venda nem pedido de contato, e quase não tem texto na arte: a mensagem vai na legenda.
- Entregue exatamente a quantidade de slides da pauta, um por item do plano. Foto e Reel têm um slide só.
- Texto que cabe no slide: título curto, corpo curto, uma ideia por slide. O que não couber vai para a legenda.
- Palavra comum, sem duplo sentido nem termo estranho; se a palavra soa esquisita em voz alta, troque.`

export const redator: Agente = async (ctx, passo, em) => {
  // numa volta (revisor ou correção sua) parte do texto que já existe e mexe só no que foi pedido
  const anterior = ctx.saidas.redator as z.infer<typeof Texto> | undefined
  const ajuste = !!passo.entrada.feedback && !!anterior?.slides?.length
  await em.inicio(ajuste ? 'Ajustando só o que foi apontado no texto' : 'Escrevendo o gancho da capa')
  const pauta = ctx.saidas.chefe as z.infer<typeof Pauta> | undefined
  const jaUsado = ajuste ? '' : textoJaUsado(await postsRecentes(ctx))
  const { dados, uso } = await gerarJson({
    // a volta só troca o que foi apontado: Sonnet dá conta e custa metade do Opus
    modelo: ajuste ? modeloNaVolta(ctx, 'redator', 'claude-sonnet-5-5') : modeloDe(ctx, 'redator'),
    effort: 'medium',
    sistema: `${sistemaDoAgente(ctx, 'redator', 'Você escreve o texto dos slides e a legenda como um redator humano que conhece a marca, não como um modelo de linguagem.')}\n\n${ESCRITA}\n\n${CLICHES}`,
    conteudo: [
      `Pedido: ${ctx.post.briefing}`,
      `Pauta:\n${JSON.stringify(ctx.saidas.chefe)}`,
      pauta?.voz && pauta.voz in VOZES ? `## Voz deste post: ${pauta.voz}\n${VOZES[pauta.voz]}` : '',
      pauta?.estrutura && pauta.estrutura in ESTRUTURAS ? `## Estrutura deste post: ${pauta.estrutura}\n${ESTRUTURAS[pauta.estrutura]}` : '',
      pauta?.objetivo && pauta.objetivo in OBJETIVOS ? `## Objetivo deste post: ${pauta.objetivo}\n${OBJETIVOS[pauta.objetivo]}\nFecho combinado: ${pauta.fecho}` : '',
      pauta ? `## Quantidade: ${pauta.quantidade_slides} ${pauta.quantidade_slides === 1 ? 'slide' : 'slides'}` : '',
      jaUsado,
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
  // foto e Reel têm uma imagem só: um slide a mais do modelo não vira um post a mais
  if (pauta && pauta.formato !== 'carrossel' && dados.slides.length > 1) dados.slides = dados.slides.slice(0, 1)
  for (const [i, s] of dados.slides.entries()) await em.texto(`Slide ${i + 1}: ${s.titulo}\n`)
  await em.texto(`\nLegenda:\n${dados.legenda}\n`)
  await db.from('posts').update({ legenda: dados.legenda }).eq('id', ctx.post.id)
  // com a aprovação do texto ligada, o texto novo (ou ajustado a seu pedido) para na sua mesa antes do designer;
  // devolução do revisor e correção do post pronto seguem direto
  if (ctx.post.preferencias?.aprovar_texto && (!passo.entrada.feedback || passo.entrada.ajuste_texto)) {
    await db.from('posts').update({ status: 'aguardando_texto' }).eq('id', ctx.post.id)
    return { saida: dados, uso, entrega: 'Texto pronto para você aprovar', proximos: null, para: 'voce' }
  }
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
  // se o render cair, o HTML fica guardado: a próxima tentativa só desenha de novo, sem chamar a IA
  const pasta = `${ctx.post.id}/v${passo.tentativas}-${Date.now()}`
  const r = await renderizarESalvar(html, pasta).catch((e) => {
    throw new ErroRetomavel(e, { html }, { html_pronto: html })
  })
  await db.from('posts').update({ slides: r.slides }).eq('id', ctx.post.id)
  return r
}

const textoDaChecagem = (problemas: ProblemaDoSlide[]) => problemas.map((p) => `- Slide ${p.slide}: ${p.problema}`).join('\n')

/**
 * Renderiza e passa a checagem automática (texto cortado, sobreposto ou pequeno). Se achar algo, o designer
 * corrige uma vez com trocas pequenas e renderiza de novo, sem gastar uma rodada do revisor nisso.
 * O que sobrar vai na saída, para o revisor e para você verem.
 */
async function renderizarEConferir(ctx: Parameters<Agente>[0], passo: Parameters<Agente>[1], em: Parameters<Agente>[2], html: string, uso: Uso) {
  let r = await salvarSlides(ctx, passo, html)
  let usoTotal = uso
  if (r.problemas.length) {
    await em.acao(`A checagem automática achou ${r.problemas.length} ${r.problemas.length === 1 ? 'problema' : 'problemas'}; corrigindo`)
    await em.texto(`${textoDaChecagem(r.problemas)}\n`)
    const ajuste = await editarSlides(ctx, passo, em, `Checagem automática dos slides renderizados (medida no navegador, é fato, não opinião):\n${textoDaChecagem(r.problemas)}\n\nCorrija só isso, sem mudar o texto. Texto cortado ou sobreposto: diminua um pouco a fonte, quebre a linha, ajuste margem ou posição. Faixa vazia: aproxime os blocos, centralize o grupo na altura ou aumente o elemento principal (título, foto, ícone). Título fora da área 1:1: traga para dentro de y 135 a 1215. Número ou palavra decorativa cortada na borda: tire o elemento decorativo.`, html, { renderizar: false })
    if (ajuste && ajuste.html !== html) {
      html = ajuste.html
      usoTotal = { tokens_entrada: usoTotal.tokens_entrada + ajuste.uso.tokens_entrada, tokens_saida: usoTotal.tokens_saida + ajuste.uso.tokens_saida, custo_usd: usoTotal.custo_usd + ajuste.uso.custo_usd }
      await em.acao('Renderizando de novo')
      r = await salvarSlides(ctx, passo, html)
    }
  }
  const checagem = r.problemas.length ? textoDaChecagem(r.problemas) : undefined
  if (checagem) await em.texto(`Ainda ficou:\n${checagem}\n`)
  return { html, slides: r.slides, uso: usoTotal, checagem }
}

/**
 * Volta para o designer (ajuste seu, devolução do revisor ou texto novo do redator): edita o HTML pronto
 * com trocas pequenas em vez de montar tudo de novo. Devolve null se não deu para editar.
 */
async function editarSlides(
  ctx: Parameters<Agente>[0],
  passo: Parameters<Agente>[1],
  em: Parameters<Agente>[2],
  pedido: string,
  base?: string,
  opts: { renderizar: boolean } = { renderizar: true },
) {
  const anterior = base ?? (ctx.saidas.designer as { html?: string } | undefined)?.html
  if (!anterior) return null
  // as imagens geradas seguem na saída, para uma refação não pagar por elas de novo
  const imagens = (ctx.saidas.designer as { imagens?: unknown[] } | undefined)?.imagens
  if (!base) await em.inicio('Editando os slides prontos')
  const { dados, uso } = await gerarJson({
    modelo: modeloDe(ctx, 'designer'),
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
  if (!opts.renderizar) return { html, uso, saida: { html, slides: ctx.post.slides, imagens }, entrega: 'Ajuste aplicado' }
  let slides = ctx.post.slides
  let checagem: string | undefined
  if (html !== anterior) {
    await em.acao('Renderizando de novo')
    const r = await renderizarEConferir(ctx, passo, em, html, uso)
    html = r.html
    slides = r.slides
    checagem = r.checagem
    return { html, uso: r.uso, saida: { html, slides, checagem, imagens }, entrega: checagem ? 'Ajuste aplicado; a checagem automática ainda aponta algo' : 'Ajuste aplicado' }
  }
  return { html, uso, saida: { html, slides, imagens }, entrega: 'Ajuste aplicado' }
}

/** Composição que vale para toda marca: vem das correções do dono que se repetiam (vazio, desalinhado, número gigante, site no botão). */
const COMPOSICAO = `## Composição (todas as marcas)
- Monte cada slide com uma grade: margem lateral igual em todos os slides (cerca de 80 px) e o mesmo espaço entre selo, título, corpo e rodapé de um slide para o outro. Prefira flexbox em coluna para os blocos de texto em vez de position absolute solto: evita sobreposição e vazios.
- Nada de faixa grande vazia sem função. O conteúdo ocupa a altura do slide: se o texto é curto, aumente o título, a foto ou o ícone, ou centralize o grupo; espaço livre fica entre blocos, não sobrando num canto.
- Título, logo e o que importa ficam dentro da área central 1:1 (de y 135 a y 1215): a grade do perfil corta o 4:5 em cima e embaixo.
- Selo ou pílula é opcional; quando entrar, alinhe na mesma margem do título e varie a posição entre posts. Rodapé numa linha só, itens alinhados pela mesma base.
- Número ou palavra gigante decorativa no fundo só no layout numero-gigante, e nunca cortado na borda.
- Botão e chamada com palavras comuns ("Link na bio", "Começar grátis"), nunca endereço de site.
- A marca aparece com o arquivo de imagem do logo ou ícone (na identidade ou no modelo), nunca com uma letra ou inicial no lugar.
- Mockup de celular na proporção real (cerca de 9:19,5); print de tela recortado no trecho que importa, grande e legível, nunca cortado pela borda do slide.
- Post com objetivo "marca": pouco texto na arte, a marca em destaque.`

const PlanoDeImagens = z.object({
  imagens: z
    .array(
      z.object({
        slide: z.number().int().describe('número do slide onde a imagem entra, começando em 1'),
        prompt: z
          .string()
          .describe('descrição detalhada da imagem em inglês: cena, assunto, luz, enquadramento e estilo fotográfico; sem texto, letras, logos ou marca d\'água na imagem'),
        referencias: z.array(z.string()).describe('URLs exatas da lista de fotos que servem de base (produto, pessoa, ambiente da marca); vazio para gerar só pelo texto'),
      }),
    )
    .describe(`imagens novas para o post, no máximo ${MAX_IMAGENS_POR_POST}; vazio se as fotos aprovadas já bastam ou o slide funciona só com tipografia`),
})
type ImagemGerada = { slide: number; url: string; prompt: string; modelo: string }

/**
 * Antes de montar os slides, o designer decide se o post precisa de imagens novas e gera pelo fal.ai,
 * usando as fotos da marca como referência. Uma imagem que falha não para o post: o slide fica sem ela.
 */
async function gerarImagensDoPost(
  ctx: Parameters<Agente>[0],
  em: Parameters<Agente>[2],
  motor: MotorImagem,
  fotos: { url: string; descricao: string | null; tags: string[] }[],
  refsDoPedido: string[],
): Promise<{ imagens: ImagemGerada[]; uso: Uso }> {
  await em.acao('Vendo se o post precisa de imagens novas')
  const candidatas = [...refsDoPedido.map((url) => ({ url, descricao: 'referência enviada neste pedido', tags: [] as string[] })), ...fotos]
  const { dados, uso } = await gerarJson({
    modelo: modeloDe(ctx, 'designer'),
    effort: 'low',
    sistema: sistemaDoAgente(
      ctx,
      'designer',
      `Você decide quais imagens novas o post precisa antes de montar os slides. Cada imagem custa dinheiro: peça só quando a imagem faz o slide melhor (capa, produto em uso, cena que ilustra o ponto), no máximo ${MAX_IMAGENS_POR_POST}. Se há foto aprovada que já serve, não gere. Use as fotos da marca como referência sempre que o produto, a pessoa ou o ambiente precisam ser os da marca. A imagem não pode ter texto: o texto entra depois no HTML. Pense no espaço livre para o texto do slide (ex.: céu limpo em cima, fundo desfocado).`,
    ),
    conteudo: [
      `## Plano dos slides\n${JSON.stringify((ctx.saidas.chefe as { plano_slides?: string[] } | undefined)?.plano_slides ?? [])}`,
      `## Texto dos slides\n${JSON.stringify((ctx.saidas.redator as z.infer<typeof Texto> | undefined)?.slides ?? [])}`,
      `## Fotos da marca e referências que podem servir de base\n${candidatas.length ? JSON.stringify(candidatas) : '(nenhuma: gere só pelo texto)'}`,
    ].join('\n\n'),
    schema: PlanoDeImagens,
  })
  const validas = new Set(candidatas.map((c) => c.url))
  const pedidos = dados.imagens.slice(0, MAX_IMAGENS_POR_POST)
  if (!pedidos.length) return { imagens: [], uso }
  const m = MODELOS_IMAGEM[motor]
  await em.acao(`Gerando ${pedidos.length} ${pedidos.length === 1 ? 'imagem' : 'imagens'} no ${m.nome} (até US$ ${(pedidos.length * m.preco).toFixed(2)})`)
  const feitas = await Promise.allSettled(
    pedidos.map((p, i) => gerarImagem(motor, { prompt: p.prompt, referencias: p.referencias.filter((u) => validas.has(u)), postId: ctx.post.id, nome: `slide${p.slide}-${i}` })),
  )
  const imagens: ImagemGerada[] = []
  let custo = 0
  feitas.forEach((f, i) => {
    if (f.status === 'fulfilled') {
      imagens.push({ slide: pedidos[i].slide, url: f.value.url, prompt: pedidos[i].prompt, modelo: f.value.modelo })
      custo += f.value.custo
    }
  })
  const falhas = feitas.filter((f): f is PromiseRejectedResult => f.status === 'rejected')
  if (falhas.length) await em.texto(`${falhas.length} ${falhas.length === 1 ? 'imagem não saiu' : 'imagens não saíram'}: ${String(falhas[0].reason?.message ?? falhas[0].reason).slice(0, 200)}\n`)
  return { imagens, uso: { ...uso, custo_usd: uso.custo_usd + custo } }
}

export const designer: Agente = async (ctx, passo, em) => {
  // tentativa depois de o render cair: o HTML já estava escrito, só falta desenhar
  const pronto = passo.entrada.html_pronto as string | undefined
  if (pronto) {
    await em.inicio('Desenhando de novo os slides que já estavam prontos')
    const r = await renderizarEConferir(ctx, passo, em, pronto, USO_ZERO)
    return { saida: { html: r.html, slides: r.slides, checagem: r.checagem }, uso: r.uso, entrega: `${r.slides.length} slides renderizados` }
  }
  const correcao = passo.entrada.correcao as Correcao | undefined
  const apontado = passo.entrada.feedback as string | undefined
  const pedido = [correcao ? `Pedido do dono da marca: ${correcao.comentario}\n${correcao.instrucao}` : '', apontado ? `Apontado nesta rodada:\n${apontado}` : '']
    .filter(Boolean)
    .join('\n\n')
  // numa volta, quem chega aqui tenta primeiro editar o que já existe (bem mais barato que refazer)
  if (pedido) {
    const r = await editarSlides(ctx, passo, em, pedido)
    if (r) return { saida: r.saida, uso: r.uso, entrega: r.entrega }
    await em.acao('Não deu para editar direto, refazendo os slides')
  }
  await em.inicio('Escolhendo as fotos aprovadas')
  const { data: midias } = await db.from('midias').select('caminho, descricao, tags').eq('marca_id', ctx.marca.id).eq('aprovada', true)
  const todas = (midias ?? []).map((m) => ({ url: db.storage.from('marcas').getPublicUrl(m.caminho).data.publicUrl, descricao: m.descricao, tags: m.tags as string[] }))
  // "inspiração" é só estilo: o designer vê as imagens, mas elas não entram nos slides
  const fotos = todas.filter((m) => !m.tags.includes('inspiracao'))
  const inspiracoes = todas.filter((m) => m.tags.includes('inspiracao')).slice(-3)

  const refsDesign = referenciasDoPost(ctx)
  // com referências no pedido, o visual vem delas; sem, o último post publicado é o exemplo da marca
  const aprovado = refsDesign.tem || ctx.marca.identidade?.neutra ? '' : await layoutAprovado(ctx).catch(() => '')
  if (aprovado) await em.acao('Olhando o último post aprovado da marca')

  // imagens novas para o post: numa refação, reaproveita as que já foram geradas em vez de pagar de novo
  let geradas = (ctx.saidas.designer as { imagens?: ImagemGerada[] } | undefined)?.imagens ?? []
  let usoImagens = USO_ZERO
  const motorImagem = motorDeImagem(ctx)
  if (!geradas.length && motorImagem) {
    const refsDoPedido = (ctx.post.referencias ?? []).filter((r) => r.tipo === 'imagem').map((r) => r.url)
    const r = await gerarImagensDoPost(ctx, em, motorImagem, fotos, refsDoPedido).catch(async (e) => {
      await em.texto(`Não deu para gerar imagens agora (${e instanceof Error ? e.message : String(e)}); sigo com as fotos da marca.\n`)
      return { imagens: [], uso: USO_ZERO }
    })
    geradas = r.imagens
    usoImagens = r.uso
  }
  await em.acao(ctx.marca.identidade?.neutra ? 'Montando os slides no estilo das referências' : `Montando os slides no modelo de ${ctx.marca.nome}`)
  const gerado = await gerarTexto({
    modelo: modeloDe(ctx, 'designer'),
    sistema: `${sistemaDoAgente(
      ctx,
      'designer',
      'Você monta os slides em HTML. Responda SOMENTE com um documento HTML completo, sem comentários antes ou depois. Cada slide é um <section class="slide"> de exatamente 1080x1350 px, com overflow hidden. Use apenas as fotos da lista ou as imagens de referência (URLs absolutas). Fontes só do Google Fonts. Texto do corpo com no mínimo 28 px. Não use emojis dentro dos slides (eles não renderizam); para setas use o caractere →, que o renderizador desenha. Depois de renderizar, uma checagem automática mede texto cortado, sobreposto, faixas vazias e título fora da área 1:1.',
    )}\n\n${COMPOSICAO}`,
    conteudo: [
      ...refsDesign.blocos,
      ...inspiracoes.map((m) => ({ type: 'image' as const, source: { type: 'url' as const, url: m.url } })),
      {
        type: 'text' as const,
        text: [
          ctx.marca.modelo_slides_html
            ? `## Modelo da marca\nO modelo define a identidade: cores, fonte, ícone, assinatura e aviso legal. Não copie a composição dele (posições, tamanhos, pílula no topo, cartão de receita): a composição segue a direção de layout abaixo, e você cria as classes que precisar. A direção de layout tem prioridade sobre qualquer instrução de usar as classes do modelo.\n${ctx.marca.modelo_slides_html}`
            : (refsDesign.tem ? '## Sem modelo fixo: o visual vem das referências.' : '## Sem modelo da marca: crie um visual limpo com as cores da identidade.'),
          // com referências, o visual vem delas; sem, segue o layout sorteado na pauta
          refsDesign.tem ? '' : textoLayout((ctx.saidas.chefe as { layout?: string } | undefined)?.layout, await postsRecentes(ctx)),
          aprovado,
          inspiracoes.length ? `## Inspirações da marca (as últimas imagens acima)\nPeças que o dono gosta. Use como referência de estilo; não coloque essas imagens nos slides.\n${inspiracoes.map((m) => `- ${m.descricao ?? 'inspiração'}`).join('\n')}` : '',
          geradas.length
            ? `## Imagens geradas para este post\nFeitas sob medida para estes slides: use cada uma no slide indicado, grande (fundo inteiro ou metade do slide), com o texto em cima de uma área limpa ou de um degradê para ler bem.\n${JSON.stringify(geradas.map((g) => ({ slide: g.slide, url: g.url, o_que_mostra: g.prompt })))}`
            : '',
          `## Fotos aprovadas disponíveis\n${fotos.length ? JSON.stringify(fotos) : geradas.length ? '(nenhuma além das geradas)' : '(nenhuma: faça slides só com tipografia e cor)'}`,
          refsDesign.tem
            ? `${refsDesign.texto}\n\nO que o chefe de pauta viu nelas: ${(ctx.saidas.chefe as { referencias?: string } | undefined)?.referencias ?? ''}\nSiga o estilo visual das referências. As imagens de referência também podem entrar nos slides (URLs acima) se combinarem com o pedido.`
            : '',
          (() => {
            const p = ctx.saidas.chefe as { objetivo?: string; formato?: string; quantidade_slides?: number } | undefined
            return p?.objetivo ? `## Objetivo deste post: ${p.objetivo}\nFormato: ${p.formato}, ${p.quantidade_slides} ${p.quantidade_slides === 1 ? 'imagem' : 'slides'} (nem mais nem menos).` : ''
          })(),
          `## Texto dos slides (não mude o texto)\n${JSON.stringify((ctx.saidas.redator as z.infer<typeof Texto>)?.slides)}`,
          feedback(passo),
        ].join('\n\n'),
      },
    ],
  })
  const html = gerado.texto.replace(/^[\s\S]*?(<!doctype|<html)/i, '$1').replace(/```\s*$/, '').trim()

  await em.acao('Renderizando JPEG 1080 × 1350')
  const usoAntes = { ...gerado.uso, tokens_entrada: gerado.uso.tokens_entrada + usoImagens.tokens_entrada, tokens_saida: gerado.uso.tokens_saida + usoImagens.tokens_saida, custo_usd: gerado.uso.custo_usd + usoImagens.custo_usd }
  const r = await renderizarEConferir(ctx, passo, em, html, usoAntes)
  const comImagens = geradas.length ? `, com ${geradas.length} ${geradas.length === 1 ? 'imagem gerada' : 'imagens geradas'}` : ''
  return { saida: { html: r.html, slides: r.slides, checagem: r.checagem, imagens: geradas }, uso: r.uso, entrega: `${r.slides.length} slides renderizados${comImagens}${r.checagem ? ', com pontos da checagem automática' : ''}` }
}

// ───────── Cinegrafista (só em Reels) ─────────
// Gera o vídeo com a IA escolhida no post: Kling direto, um modelo do fal.ai, ou uma animação escrita pelo Claude
// e gravada pelo próprio app. Nos serviços de fora, pede o vídeo e se re-enfileira enquanto ele não fica pronto
// (cada passo cabe no tempo da função); na animação, escreve num passo e grava no seguinte.
const PromptVideo = z.object({
  refazer: z.boolean().describe('false só se já existe vídeo e os ajustes pedidos não mudam nada no vídeo (ex.: só capa ou legenda)'),
  prompt: z.string().describe('prompt em inglês para o gerador de vídeo: cena, sujeito, ação, câmera, luz e estilo, em até 600 caracteres; sem texto, letreiro ou logo na tela'),
  segundos: z.union([z.literal(5), z.literal(10)]).describe('5, ou 10 só se a cena precisar de mais tempo'),
})

const Animacao = z.object({
  refazer: z.boolean().describe('false só se já existe vídeo e os ajustes pedidos não mudam nada no vídeo (ex.: só capa ou legenda)'),
  descricao: z.string().describe('o que a animação mostra, em uma ou duas frases'),
  segundos: z.number().int().describe('duração total, de 5 a 8 segundos'),
  html: z.string().describe('documento HTML completo da animação'),
})

const REGRAS_ANIMACAO = `## Como escrever a animação
- Um documento HTML completo, com <body> de exatamente 1080x1920 px (vertical), margin 0 e overflow hidden.
- Anime só com CSS: @keyframes e animation. Nada de JavaScript, <video>, GIF ou transição disparada por hover/clique: o app grava quadro a quadro controlando o tempo das animações CSS.
- Use animation-fill-mode: both e tempos (delay + duração) que caibam na duração total. O último quadro precisa ficar bonito parado.
- Pode ter texto na tela: frases curtas, grandes e legíveis no celular (título com 90 px ou mais), longe das bordas (120 px de margem embaixo e 200 px em cima, por causa dos botões do Instagram).
- Fontes do Google Fonts via <link> e imagens só por URL https das referências; nada de outro recurso externo.
- Movimento com intenção: entradas em sequência, um elemento principal por vez, ritmo de Reel. Use as cores e a fonte da identidade visual.`

const ESPERA_POR_PASSO_MS = 100_000
const MAX_ESPERAS = 6
const RESOLUCAO = '1080p'

interface PedidoVideo {
  motor: MotorVideo
  id: string
  status_url?: string
  response_url?: string
}
interface EntradaCinegrafista {
  pedido?: PedidoVideo
  /** pedido feito antes da escolha de IA por post, sempre na Kling */
  kling_id?: string
  animacao?: string
  esperas?: number
  prompt?: string
  segundos?: number
  feedback?: string
  correcao?: Correcao
}

const NOME_DO_MOTOR = (m: MotorVideo) => (m === 'kling' ? 'Kling' : m === 'claude' ? 'Claude' : `${MODELOS_FAL[m].nome} (fal.ai)`)

async function guardarVideo(ctx: Parameters<Agente>[0], mp4: Buffer, dados: { prompt: string; segundos: number; motor: MotorVideo; pedido_id?: string }) {
  const caminho = `${ctx.post.id}/video-${Date.now()}.mp4`
  const { error } = await db.storage.from(BUCKET_POSTS).upload(caminho, mp4, { contentType: 'video/mp4', upsert: true })
  if (error) throw new Error(`Falha ao subir o vídeo: ${error.message}`)
  const modelo = dados.motor === 'kling' ? MODELO_KLING : dados.motor === 'claude' ? 'animação do Claude' : MODELOS_FAL[dados.motor].nome
  const video = { url: urlPublica(caminho), caminho, prompt: dados.prompt, segundos: dados.segundos, modelo, motor: dados.motor, pedido_id: dados.pedido_id }
  await db.from('posts').update({ video }).eq('id', ctx.post.id)
  return video
}

export const cinegrafista: Agente = async (ctx, passo, em) => {
  const entrada = passo.entrada as EntradaCinegrafista
  const pedido: PedidoVideo | undefined = entrada.pedido ?? (entrada.kling_id ? { motor: 'kling', id: entrada.kling_id } : undefined)
  if (entrada.animacao) return gravarAnimacaoDoPost(ctx, entrada, em)
  if (pedido) return esperarVideo(ctx, entrada, pedido, em)

  const motor = motorDeVideo(ctx)
  const atual = ctx.post.video
  const ajustes = [entrada.correcao ? `Pedido do dono da marca: ${entrada.correcao.comentario}\n${entrada.correcao.instrucao}` : '', entrada.feedback ?? ''].filter(Boolean).join('\n\n')
  await em.inicio(atual ? 'Vendo se o vídeo precisa mudar' : motor === 'claude' ? 'Escrevendo a animação do Reel' : 'Escrevendo a cena do vídeo')
  const refs = referenciasDoPost(ctx)
  const contexto = [
    `Pedido: ${ctx.post.briefing}`,
    `Pauta:\n${JSON.stringify(ctx.saidas.chefe)}`,
    `Texto dos slides:\n${JSON.stringify((ctx.saidas.redator as z.infer<typeof Texto> | undefined)?.slides ?? [])}`,
    atual ? `## Vídeo atual\n${atual.prompt}` : '',
    ajustes ? `## Ajustes pedidos nesta rodada\n${ajustes}` : '',
  ]

  if (motor === 'claude') {
    const r = await gerarJson({
      modelo: 'claude-opus-5-5',
      effort: 'medium',
      sistema: sistemaDoAgente(ctx, 'cinegrafista', 'Você faz o vídeo do Reel como motion designer: escreve uma animação em HTML e CSS que o app grava em vídeo.'),
      conteudo: [
        ...refs.blocos,
        { type: 'text' as const, text: [...contexto, refs.tem ? refs.texto : '', REGRAS_ANIMACAO].filter(Boolean).join('\n\n') },
      ],
      schema: Animacao,
    })
    if (atual && !r.dados.refazer) {
      await em.texto('O ajuste não mexe no vídeo: mantive o que já estava pronto.')
      return { saida: { video: atual }, uso: r.uso, entrega: 'Vídeo mantido' }
    }
    const segundos = Math.min(8, Math.max(5, r.dados.segundos))
    await em.texto(`${r.dados.descricao}\n`)
    return {
      saida: { descricao: r.dados.descricao, segundos },
      uso: r.uso,
      entrega: 'Animação escrita, agora gravando',
      proximos: [{ agente: 'cinegrafista', entrada: { ...entrada, animacao: r.dados.html, prompt: r.dados.descricao, segundos } }],
      para: 'cinegrafista',
    }
  }

  const r = await gerarJson({
    modelo: 'claude-sonnet-5-5',
    effort: 'low',
    sistema: sistemaDoAgente(ctx, 'cinegrafista', `Você dirige o vídeo do Reel: descreve a cena para um gerador de vídeo por IA (${NOME_DO_MOTOR(motor)}). O texto do post vai na capa e na legenda, não no vídeo.`),
    conteudo: [
      ...refs.blocos,
      {
        type: 'text' as const,
        text: [...contexto, refs.tem ? `${refs.texto}\n\nSe houver imagem de referência, a primeira vira o primeiro quadro do vídeo: descreva o movimento a partir dela.` : '']
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
    schema: PromptVideo,
  })
  let uso = r.uso
  if (atual && !r.dados.refazer) {
    await em.texto('O ajuste não mexe no vídeo: mantive o que já estava pronto.')
    return { saida: { video: atual }, uso, entrega: 'Vídeo mantido' }
  }
  const prompt = r.dados.prompt
  await em.texto(`${prompt}\n`)
  const primeiroQuadro = ctx.post.referencias?.find((x) => x.tipo === 'imagem')?.url
  let novo: PedidoVideo
  let segundos: number = r.dados.segundos
  let custo: number
  try {
    if (motor === 'kling') {
      await em.acao(`Pedindo ${segundos}s de vídeo na Kling${primeiroQuadro ? ' a partir da sua imagem' : ''}`)
      novo = { motor, id: await pedirVideo({ prompt, segundos: r.dados.segundos, resolucao: RESOLUCAO, primeiroQuadro, idExterno: `${passo.id}` }) }
      custo = custoDoVideo(segundos, RESOLUCAO)
    } else {
      segundos = duracaoFal(motor, segundos)
      await em.acao(`Pedindo ${segundos}s de vídeo no ${NOME_DO_MOTOR(motor)}${primeiroQuadro ? ' a partir da sua imagem' : ''}`)
      novo = { motor, ...(await pedirVideoFal(motor, { prompt, segundos, primeiroQuadro })) }
      custo = custoFal(motor, segundos)
    }
  } catch (e) {
    // sem créditos no serviço de vídeo: em vez de parar o post, o Claude anima o Reel (não depende de saldo de terceiros)
    const msg = e instanceof Error ? e.message : String(e)
    if (!/sem créditos|sem saldo|saldo insuficiente/i.test(msg)) throw e
    await em.texto(`${NOME_DO_MOTOR(motor)} está sem créditos. Vou fazer o vídeo como animação do Claude.\n`)
    const preferencias = { ...(ctx.post.preferencias ?? {}), ias: { ...(ctx.post.preferencias?.ias ?? {}), cinegrafista: 'claude' } }
    await db.from('posts').update({ preferencias }).eq('id', ctx.post.id)
    return {
      saida: { troca: `${NOME_DO_MOTOR(motor)} sem créditos, seguindo com animação do Claude` },
      uso,
      entrega: `${NOME_DO_MOTOR(motor)} sem créditos: trocando para animação do Claude`,
      proximos: [{ agente: 'cinegrafista', entrada: { ...entrada } }],
      para: 'cinegrafista',
    }
  }
  uso = { ...uso, custo_usd: uso.custo_usd + custo }
  await em.acao(custo ? `Vídeo na fila (US$ ${custo.toFixed(2)})` : 'Vídeo na fila (o custo aparece no painel do fal.ai)')
  return esperarVideo(ctx, { ...entrada, prompt, segundos }, novo, em, uso)
}

/** Acompanha o pedido no serviço de vídeo; se não ficar pronto neste passo, volta para a fila. */
async function esperarVideo(ctx: Parameters<Agente>[0], entrada: EntradaCinegrafista, pedido: PedidoVideo, em: Parameters<Agente>[2], uso = USO_ZERO): Promise<Resultado> {
  const nome = NOME_DO_MOTOR(pedido.motor)
  if (uso === USO_ZERO) await em.inicio(`Esperando o vídeo do ${nome}`)
  const consultar = () =>
    pedido.motor === 'kling' ? consultarVideo(pedido.id) : consultarVideoFal({ status_url: pedido.status_url ?? '', response_url: pedido.response_url ?? '' })
  const inicio = Date.now()
  let url: string | null = null
  while (Date.now() - inicio < ESPERA_POR_PASSO_MS) {
    const r = await consultar()
    if (r.pronto) {
      url = r.url
      break
    }
    await new Promise((ok) => setTimeout(ok, 10_000))
  }

  if (!url) {
    const esperas = (entrada.esperas ?? 0) + 1
    if (esperas > MAX_ESPERAS) throw new Error(`${nome} não entregou o vídeo depois de ${Math.round((MAX_ESPERAS * ESPERA_POR_PASSO_MS) / 60_000)} minutos (pedido ${pedido.id})`)
    await em.acao('Ainda gerando, volto a olhar já já')
    const resto = { ...entrada }
    delete resto.kling_id
    return {
      saida: { pedido, esperas },
      uso,
      entrega: `Vídeo ainda no ${nome}`,
      proximos: [{ agente: 'cinegrafista', entrada: { ...resto, pedido, esperas } }],
      para: 'cinegrafista',
    }
  }

  await em.acao('Baixando o vídeo e guardando no app')
  const baixado = await fetch(url)
  if (!baixado.ok) throw new Error(`Não consegui baixar o vídeo do ${nome} (HTTP ${baixado.status})`)
  const video = await guardarVideo(ctx, Buffer.from(await baixado.arrayBuffer()), { prompt: entrada.prompt ?? '', segundos: entrada.segundos ?? 5, motor: pedido.motor, pedido_id: pedido.id })
  return { saida: { video }, uso, entrega: `Vídeo de ${video.segundos}s pronto` }
}

/** Grava a animação que o Claude escreveu no passo anterior. */
async function gravarAnimacaoDoPost(ctx: Parameters<Agente>[0], entrada: EntradaCinegrafista, em: Parameters<Agente>[2]): Promise<Resultado> {
  const segundos = entrada.segundos ?? 6
  await em.inicio(`Gravando ${segundos}s da animação`)
  const mp4 = await gravarAnimacao(entrada.animacao!, segundos)
  await em.acao('Guardando o vídeo no app')
  const video = await guardarVideo(ctx, mp4, { prompt: entrada.prompt ?? '', segundos, motor: 'claude' })
  return { saida: { video }, uso: USO_ZERO, entrega: `Vídeo de ${segundos}s pronto` }
}

// ───────── Narrador (só em Reels) ─────────
// Escreve a narração no tempo do vídeo, gera a voz da marca na ElevenLabs e junta o áudio ao vídeo.
const Narracao = z.object({
  refazer: z.boolean().describe('false só se já existe narração e os ajustes pedidos não mudam nada nela'),
  texto: z.string().describe('o que o narrador fala, em português do Brasil, para ser ouvido (sem hashtag, emoji, link ou sigla difícil de ler)'),
})

/** Palavras que cabem na fala, contando uma pausa curta no começo e no fim. */
const palavrasPara = (segundos: number, velocidade: number) => Math.max(6, Math.floor((segundos - 0.8) * 2.4 * velocidade))

export const narrador: Agente = async (ctx, passo, em) => {
  const video = ctx.post.video
  if (!video?.url) throw new Error('O Reel ainda não tem vídeo para narrar')
  const cfg = configDaMarca(ctx.marca.identidade)
  if (ctx.post.preferencias?.ias?.narrador === 'nenhum' || !cfg.ativa) {
    await em.inicio('Este Reel vai sem narração')
    return { saida: { pulou: true }, uso: USO_ZERO, entrega: 'Sem narração neste Reel' }
  }
  const entrada = passo.entrada as { feedback?: string; correcao?: Correcao }
  const ajustes = [entrada.correcao ? `Pedido do dono da marca: ${entrada.correcao.comentario}\n${entrada.correcao.instrucao}` : '', entrada.feedback ?? ''].filter(Boolean).join('\n\n')
  const base = video.original ?? { url: video.url, caminho: video.caminho, segundos: video.segundos }
  const limite = palavrasPara(base.segundos, cfg.velocidade)
  await em.inicio(video.narracao ? 'Vendo se a narração precisa mudar' : 'Escrevendo a narração')
  const { dados, uso } = await gerarJson({
    modelo: modeloDe(ctx, 'narrador'),
    effort: 'low',
    sistema: sistemaDoAgente(ctx, 'narrador', 'Você é o locutor dos Reels: escreve a fala que vai por cima do vídeo, no tom de voz da marca. Fala natural, de quem conversa, que completa o vídeo em vez de descrever o que aparece.'),
    conteudo: [
      `Pedido: ${ctx.post.briefing}`,
      `Pauta:\n${JSON.stringify(ctx.saidas.chefe)}`,
      `Texto da capa e legenda:\n${JSON.stringify((ctx.saidas.redator as z.infer<typeof Texto> | undefined) ?? {})}`,
      `## O vídeo (${base.segundos}s)\n${video.prompt}`,
      `A fala tem no máximo ${limite} palavras, para caber em ${base.segundos}s. Comece pelo gancho, termine com uma frase que fecha a ideia.`,
      video.narracao ? `## Narração atual\n${video.narracao.texto}` : '',
      ajustes ? `## Ajustes pedidos nesta rodada\n${ajustes}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    schema: Narracao,
  })
  if (video.narracao && !dados.refazer) {
    await em.texto('O ajuste não mexe na narração: mantive a que já estava pronta.')
    return { saida: { narracao: video.narracao }, uso, entrega: 'Narração mantida' }
  }
  await em.texto(`${dados.texto}\n`)
  await em.acao('Gravando a voz na ElevenLabs')
  const voz = await gerarVoz(dados.texto, cfg)
  await em.acao('Juntando a voz ao vídeo')
  const original = await fetch(base.url)
  if (!original.ok) throw new Error(`Não consegui baixar o vídeo para narrar (HTTP ${original.status})`)
  const { mp4, segundos } = await juntarNarracao(Buffer.from(await original.arrayBuffer()), voz)
  const caminho = `${ctx.post.id}/video-narrado-${Date.now()}.mp4`
  const { error } = await db.storage.from(BUCKET_POSTS).upload(caminho, mp4, { contentType: 'video/mp4', upsert: true })
  if (error) throw new Error(`Falha ao subir o vídeo narrado: ${error.message}`)
  const narracao = { texto: dados.texto, voz: cfg.voz, modelo: MODELO_VOZ }
  const novo = { ...video, url: urlPublica(caminho), caminho, segundos, original: base, narracao }
  await db.from('posts').update({ video: novo }).eq('id', ctx.post.id)
  return { saida: { narracao }, uso, entrega: `Narração de ${dados.texto.split(/\s+/).length} palavras no vídeo` }
}

// ───────── Revisor ─────────
const Revisao = z.object({
  aprovado: z.boolean(),
  problemas: z.array(
    z.object({
      agente: z.enum(['pesquisador', 'redator', 'designer', 'narrador']),
      problema: z.string().describe('o que falhou e como corrigir, citando o item do checklist ou a regra'),
    }),
  ),
  resumo: z.string(),
})

const MAX_VOLTAS = 2

/** Uma marca curta por slide, tirada do HTML dele: muda quando o designer mexe naquele slide. */
export function marcasDosSlides(html: string | undefined) {
  if (!html) return []
  return separarSlides(html).map((parte) => {
    let h = 0
    for (let i = 0; i < parte.length; i++) h = (Math.imul(h, 31) + parte.charCodeAt(i)) | 0
    return (h >>> 0).toString(36)
  })
}

export const revisor: Agente = async (ctx, passo, em) => {
  const correcao = passo.entrada.correcao as Correcao | undefined
  if (correcao) return revisarCorrecao(ctx, passo, em, correcao)
  // depois de uma devolução, confere se o que ele mesmo apontou foi resolvido, em vez de reabrir o post inteiro
  const anterior = ctx.post.voltas_revisao > 0 ? (ctx.saidas.revisor as z.infer<typeof Revisao> | undefined) : undefined
  const reconferindo = !!anterior?.problemas?.length
  await em.inicio(reconferindo ? 'Conferindo se o que apontei foi resolvido' : `Conferindo o checklist e ${ctx.regras.length} regras aprendidas`)
  const todos = [...(ctx.post.slides ?? [])].sort((a, b) => a.ordem - b.ordem)
  // cada slide tem uma marca do HTML que o gerou: na reconferência, só vão as imagens que mudaram desde a última vez
  const marcas = marcasDosSlides((ctx.saidas.designer as { html?: string } | undefined)?.html)
  const vistas = (anterior as { marcas_vistas?: string[] } | undefined)?.marcas_vistas
  const mudou = (i: number) => !vistas || !marcas[i] || vistas[i] !== marcas[i]
  const mudaram = reconferindo && marcas.length === todos.length ? todos.filter((_, i) => mudou(i)) : todos
  // se o designer tinha algo a corrigir e nenhum slide mudou, o revisor precisa ver todos de novo
  const slides = mudaram.length === 0 && anterior?.problemas.some((p) => p.agente === 'designer') ? todos : mudaram
  const iguais = todos.length - slides.length
  const precisaPesquisa = !reconferindo || anterior!.problemas.some((p) => p.agente === 'pesquisador' || p.agente === 'redator')
  const pesquisa = ctx.saidas.pesquisador as { notas?: string; busca_falhou?: string[] } | undefined
  // sem busca funcionando, devolver ao pesquisador só repete a falha: o redator suaviza o que não tem fonte
  const semBusca = !!pesquisa?.busca_falhou?.length || /busca (na web )?falhou|não consegui verificar nada|nenhuma (fonte )?consultada/i.test(pesquisa?.notas ?? '')
  const { data: midias } = await db.from('midias').select('descricao, tags').eq('marca_id', ctx.marca.id).eq('aprovada', true)
  const fotosDaMarca = (midias ?? []).filter((m) => !(m.tags as string[]).includes('inspiracao')).map((m) => m.descricao ?? (m.tags as string[]).join(', '))
  const { dados, uso } = await gerarJson({
    modelo: modeloDe(ctx, 'revisor'),
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
          iguais
            ? `Acima estão só os slides que mudaram desde a sua última conferência (${slides.map((x) => x.ordem).join(', ') || 'nenhum'}). Os outros ${iguais} não mudaram e já tinham passado.`
            : `Acima estão os ${slides.length} slides, na ordem.`,
          ctx.post.video ? `Este post é um Reel: a imagem acima é só a capa. O vídeo foi gerado por IA a partir deste prompt, e você não consegue vê-lo; não aponte problemas do vídeo.\nPrompt: ${ctx.post.video.prompt}` : '',
          ctx.post.video?.narracao ? `## Narração do Reel (narrador)\n${ctx.post.video.narracao.texto}\n\nConfira a fala como texto: fato, tom e português. Problema nela é do narrador.` : '',
          `## Legenda\n${ctx.post.legenda ?? '(sem legenda)'}`,
          (ctx.saidas.designer as { checagem?: string } | undefined)?.checagem
            ? `## Checagem automática dos slides (medida no navegador)\n${(ctx.saidas.designer as { checagem: string }).checagem}\n\nO designer já tentou corrigir uma vez. Confira nas imagens se isso aparece de verdade; se aparecer, é problema do designer.`
            : '',
          precisaPesquisa ? `## Pesquisa usada\n${pesquisa?.notas ?? ''}` : '',
          semBusca
            ? '## A busca na web não funcionou neste post\nNão aponte o pesquisador por falta de fonte: refazer não adianta. Se o texto, a legenda ou a narração afirmam algo específico sem fonte (número, tempo, causa), aponte para o redator (ou o narrador) suavizar para algo geral e seguro. Diga no resumo que os fatos não foram conferidos na web.'
            : '',
          `## Fotos aprovadas da marca\n${fotosDaMarca.length ? fotosDaMarca.map((f) => `- ${f}`).join('\n') : '(nenhuma)'}\nSó cobre do designer uma foto que esteja nesta lista; não peça foto que a marca não tem.`,
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
      saida: { ...dados, marcas_vistas: marcas },
      uso,
      entrega: dados.aprovado ? 'Tudo certo. Enviado para sua aprovação' : 'Enviado com pendências para você decidir',
      proximos: null,
      para: 'voce',
    }
  }

  // devolve só para quem tem o que corrigir (e quem depende dele); vídeo e narração ficam como estão se não foram apontados
  const problemas = semBusca ? dados.problemas.map((p) => (p.agente === 'pesquisador' ? { agente: 'redator' as const, problema: `Sem fonte (a busca falhou): suavize no texto. ${p.problema}` } : p)) : dados.problemas
  const rota = rotaDaDevolucao(problemas.map((p) => p.agente), fluxoDeProducao(ctx.etapas, ctx.post.formato))
  const texto = problemas.map((p) => `- [${p.agente}] ${p.problema}`).join('\n')
  await db.from('posts').update({ voltas_revisao: ctx.post.voltas_revisao + 1 }).eq('id', ctx.post.id)
  await em.texto(texto)
  return {
    saida: { ...dados, marcas_vistas: marcas },
    uso,
    entrega: `Devolvido: ${dados.problemas[0]?.problema.slice(0, 80) ?? 'ajustes'}`,
    proximos: [{ agente: rota[0], entrada: { feedback: texto, rota: rota.slice(1) } }],
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
    modelo: modeloDe(ctx, 'revisor'),
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
