import { z } from 'zod'
import { gerarJson } from '../claude.js'
import { quemDesenha, sistemaDoAgente } from '../contexto.js'
import { db } from '../db.js'
import { publicarCarrossel, publicarReel } from '../instagram.js'
import { USO_ZERO, type Agente } from './tipos.js'

// ───────── Publicador (sem IA) ─────────
export const publicador: Agente = async (ctx, _passo, em) => {
  await em.inicio('Preparando a publicação')
  const { marca, post } = ctx
  if (post.anuncio) throw new Error('Anúncio não é publicado pelo app: ele fica na gaveta para subir no Gerenciador de Anúncios.')
  if (!marca.instagram_conta_id || !marca.meta_token_secret_id) {
    throw new Error(`A marca ${marca.nome} ainda não tem conta do Instagram conectada (id da conta e token).`)
  }
  const { data: token, error } = await db.rpc('ler_token_meta', { p_marca: marca.id })
  if (error || !token) throw new Error('Não consegui ler o token da Meta no Vault')

  const slides = post.slides.sort((a, b) => a.ordem - b.ordem).map((s) => s.url)
  const comum = { contaId: marca.instagram_conta_id, token: token as string, legenda: post.legenda ?? '', aoProgredir: (m: string) => em.acao(m) }
  const { mediaId, permalink } = post.video?.url
    ? await publicarReel({ ...comum, video: post.video.url, capa: slides[0] })
    : await publicarCarrossel({ ...comum, imagens: slides })
  await db
    .from('posts')
    .update({ status: 'publicado', instagram_media_id: mediaId, publicado_em: new Date().toISOString() })
    .eq('id', post.id)
  await em.texto(permalink)
  return { saida: { mediaId, permalink }, uso: USO_ZERO, entrega: 'Publicado no Instagram', proximos: null, para: 'voce' }
}

// ───────── Curador ─────────
const Curadoria = z.object({
  regras: z.array(
    z.object({
      agente: z.enum(['chefe', 'pesquisador', 'redator', 'designer', 'criativos', 'cinegrafista', 'narrador', 'revisor', 'publicador', 'todos']),
      regra: z.string().describe('curta e verificável, no imperativo'),
      motivo: z.string(),
    }),
  ),
  pontual: z
    .boolean()
    .describe('true se a correção é um ajuste pequeno no que já existe (trocar/remover palavra ou letra, mudar uma cor, um tamanho, uma frase da legenda) e não pede novo conteúdo nem nova pesquisa'),
  refazer_a_partir_de: z
    .enum(['chefe', 'pesquisador', 'redator', 'designer', 'criativos', 'cinegrafista', 'narrador', 'nenhum'])
    .describe('primeiro agente que precisa refazer para atender a correção. Formato ou quantidade errada (pediu um post e veio carrossel, slides a mais ou a menos, era vídeo) ou objetivo errado (post de marca virou venda) é do chefe. Prefira o mais adiante possível: só volte ao pesquisador se a correção pedir fatos novos ou corrigir um fato errado; cinegrafista é só para mudar o vídeo de um Reel; narrador é só para mudar a fala da narração de um Reel; criativos é o designer dos anúncios (num anúncio, mudança na arte é do criativos)'),
  instrucao: z.string().describe('o que esse agente deve mudar, em uma ou duas frases'),
})

export const curador: Agente = async (ctx, passo, em) => {
  const comentario = String(passo.entrada.comentario ?? '')
  const reprovado = passo.entrada.acao === 'reprovar'
  await em.inicio('Transformando sua correção em regra')
  const { dados, uso } = await gerarJson({
    modelo: 'claude-haiku-5-5',
    sistema: sistemaDoAgente(
      ctx,
      'curador',
      'Você transforma a correção do dono da marca em regras curtas e verificáveis para a equipe não repetir o erro. Não duplique regras que já existem; se uma regra parecida existe, não crie outra. Regra é geral: vale para os próximos posts, sem citar o drink, o produto ou o slide deste post. Só crie regra se a correção mostra um gosto ou um limite da marca; um ajuste que só vale para este post (trocar uma palavra, mover um elemento) não vira regra. Regra sobre o visual de anúncio é do criativos; sobre o visual de post, do designer; sobre o pacote de textos do anúncio, do redator. Toda a equipe já segue, sem precisar de regra: nada de endereço de site no post, @ em minúsculas, fecho de acordo com o objetivo (post de marca sem venda), quantidade exata de posts e slides pedida, nada de faixa grande vazia, margens e espaçamentos iguais, título dentro da área 1:1, áreas seguras do anúncio, número decorativo gigante só quando é o layout, logo de verdade em vez de letra.',
    ),
    conteudo: `${ctx.post.anuncio ? 'Isto é um anúncio no Meta (artes do designer de criativos e pacote de textos do redator).\n\n' : ''}Pedido original: ${ctx.post.briefing}\n\n${ctx.post.anuncio?.pacote ? `Pacote atual do anúncio:\n${JSON.stringify(ctx.post.anuncio.pacote)}` : `Legenda atual:\n${ctx.post.legenda ?? ''}`}\n\nCorreção do dono da marca:\n${comentario}`,
    schema: Curadoria,
  })

  if (dados.regras.length) {
    await db.from('regras').insert(
      dados.regras.map((r) => ({
        marca_id: ctx.marca.id,
        agente: r.agente,
        regra: r.regra,
        motivo: r.motivo,
        origem_correcao: comentario,
        status: 'proposta',
        post_id: ctx.post.id,
      })),
    )
  }
  await em.texto(dados.regras.map((r) => `[${r.agente}] ${r.regra}`).join('\n') || 'Nenhuma regra nova.')

  if (reprovado || dados.refazer_a_partir_de === 'nenhum') {
    if (!reprovado) await db.from('posts').update({ status: 'aguardando_aprovacao' }).eq('id', ctx.post.id)
    return { saida: dados, uso, entrega: `${dados.regras.length} regra(s) proposta(s) para você aceitar`, proximos: null, para: 'voce' }
  }
  await db.from('posts').update({ status: 'em_producao', voltas_revisao: 0 }).eq('id', ctx.post.id)
  // ajuste pequeno: quem desenha edita os slides prontos, sem refazer pesquisa nem texto
  const desenha = quemDesenha(ctx.post)
  const pontual = dados.pontual && !!(ctx.saidas[desenha] as { html?: string } | undefined)?.html
  // num anúncio quem refaz a arte é o designer de criativos, e num post é o designer, seja qual for o nome que o curador deu
  const refazer = dados.refazer_a_partir_de === 'designer' || dados.refazer_a_partir_de === 'criativos' ? desenha : dados.refazer_a_partir_de
  const agente = pontual ? desenha : refazer
  const correcao = { comentario, instrucao: dados.instrucao, pontual }
  return {
    saida: dados,
    uso,
    entrega: pontual ? `Ajuste pequeno: direto pro ${desenha === 'criativos' ? 'designer de criativos' : 'designer'}` : `Correção repassada ao ${agente}`,
    proximos: [{ agente, entrada: { feedback: `Correção do dono da marca: ${comentario}\n${dados.instrucao}`, correcao } }],
  }
}
