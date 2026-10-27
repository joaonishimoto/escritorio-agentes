// Modo demonstração: reproduz um post inteiro com eventos falsos para o escritório
// funcionar antes do Supabase e do executor de agentes estarem ligados.
import type { AgenteId } from '../agents/catalogo'
import type { Evento } from '../store/escritorio'

type Passo = [AgenteId | 'voce', Evento['tipo'], string, (AgenteId | 'voce')?]

const ROTEIRO_DEMO: Passo[] = [
  ['chefe', 'inicio', 'Lendo o pedido: carrossel sobre a história do Negroni'],
  ['chefe', 'acao', 'Carregando roteiro e 5 regras aprendidas da Drinfy'],
  ['chefe', 'texto', 'Formato: carrossel de 6 slides. Fluxo: pesquisa, texto, design, revisão.'],
  ['chefe', 'entrega', 'Pauta pronta', 'pesquisador'],
  ['pesquisador', 'inicio', 'Buscando a origem do Negroni'],
  ['pesquisador', 'acao', 'Conferindo segunda fonte sobre o Conde Negroni (Florença, 1919)'],
  ['pesquisador', 'texto', '• Criado em Florença por volta de 1919.\n• Variação do Americano, trocando a água com gás por gin.\n'],
  ['pesquisador', 'acao', 'Lendo a receita no app: 30 ml gin, 30 ml Campari, 30 ml vermute rosso'],
  ['pesquisador', 'entrega', 'Fatos e receita conferidos', 'redator'],
  ['redator', 'inicio', 'Escrevendo o gancho do slide 1'],
  ['redator', 'texto', 'Slide 1: Um conde pediu pra trocar a água com gás por gin. Deu nisso.\n'],
  ['redator', 'acao', 'Escrevendo slides 2 a 5'],
  ['redator', 'texto', 'Slide 2: Florença, 1919...\n'],
  ['redator', 'acao', 'Escrevendo a legenda e as hashtags'],
  ['redator', 'entrega', 'Texto pronto', 'designer'],
  ['designer', 'inicio', 'Escolhendo foto oficial do Negroni'],
  ['designer', 'acao', 'Montando os 6 slides no modelo da Drinfy'],
  ['designer', 'acao', 'Renderizando JPEG 1080 × 1350'],
  ['designer', 'entrega', '6 slides renderizados', 'revisor'],
  ['revisor', 'inicio', 'Conferindo o checklist (18 itens)'],
  ['revisor', 'acao', 'Regra 2026-10-27: texto não cobre o copo? Slide 3 falhou'],
  ['revisor', 'entrega', 'Devolvido: slide 3 cobre o copo', 'designer'],
  ['designer', 'inicio', 'Ajustando slide 3: descendo a foto'],
  ['designer', 'entrega', 'Slide 3 corrigido', 'revisor'],
  ['revisor', 'inicio', 'Revisando de novo'],
  ['revisor', 'entrega', 'Tudo certo. Enviado para sua aprovação', 'voce'],
]

let timer: number | undefined

export function rodarDemo(aplicar: (e: Evento) => void, intervaloMs = 1800) {
  pararDemo()
  let i = 0
  const postId = 'demo-' + Date.now()
  const proximo = () => {
    if (i >= ROTEIRO_DEMO.length) return
    const [agente, tipo, mensagem, para] = ROTEIRO_DEMO[i++]
    aplicar({ id: `${postId}-${i}`, post_id: postId, agente, tipo, mensagem, para, criado_em: new Date().toISOString() })
    timer = window.setTimeout(proximo, tipo === 'entrega' ? intervaloMs * 1.4 : intervaloMs)
  }
  proximo()
}

export function pararDemo() {
  if (timer) window.clearTimeout(timer)
  timer = undefined
}
