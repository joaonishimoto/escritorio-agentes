// Equipe padrão. Cada marca pode ligar/desligar agentes e reescrever as instruções no roteiro;
// aqui fica só a identidade visual de cada um. O lugar das mesas vem da planta do andar (pixel/mapa.ts).

export type AgenteId =
  | 'chefe'
  | 'pesquisador'
  | 'redator'
  | 'designer'
  | 'criativos'
  | 'paginas'
  | 'cinegrafista'
  | 'narrador'
  | 'revisor'
  | 'publicador'
  | 'curador'
  | 'social'

export type Modelo = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5' | null

export interface Agente {
  id: AgenteId
  nome: string
  papel: string
  cor: string
  modelo: Modelo
  /** nome curto, para a etiqueta da mesa em tela estreita */
  curto: string
  /** contratado, mas ainda não trabalha: fica na mesa estudando e não entra em nenhum post */
  emTreinamento?: boolean
}

export const AGENTES: Agente[] = [
  { id: 'chefe', nome: 'Chefe de pauta', papel: 'Lê o pedido e o roteiro da marca e distribui o trabalho.', cor: '#1e3d66', modelo: 'claude-sonnet-5-5', curto: 'Chefe' },
  { id: 'pesquisador', nome: 'Pesquisador', papel: 'Busca fatos com duas fontes e consulta os dados da marca.', cor: '#3f7650', modelo: 'claude-sonnet-5-5', curto: 'Pesquisa' },
  { id: 'redator', nome: 'Copywriter', papel: 'Escreve os slides e a legenda no tom de voz da marca.', cor: '#976822', modelo: 'claude-opus-5-5', curto: 'Copy' },
  { id: 'designer', nome: 'Designer de posts', papel: 'Monta os slides no modelo da marca e renderiza os JPEGs.', cor: '#b74e45', modelo: 'claude-opus-5-5', curto: 'Posts' },
  { id: 'criativos', nome: 'Designer de criativos', papel: 'Só nos anúncios: faz o criativo em 4:5 e 9:16 com o foco do objetivo e longe do texto do anúncio.', cor: '#c46a2b', modelo: 'claude-opus-5-5', curto: 'Criativos' },
  { id: 'paginas', nome: 'Designer de páginas', papel: 'Vai montar landing pages da marca. Está em treinamento: ainda não entra nos pedidos.', cor: '#7a8f2e', modelo: null, curto: 'Páginas', emTreinamento: true },
  { id: 'cinegrafista', nome: 'Cinegrafista', papel: 'Só nos Reels: escreve a cena e gera o vídeo na IA escolhida.', cor: '#6d4f8f', modelo: 'claude-sonnet-5-5', curto: 'Câmera' },
  { id: 'narrador', nome: 'Narrador', papel: 'Só nos Reels: escreve a fala, grava a voz da marca na ElevenLabs e põe no vídeo.', cor: '#2f7d7a', modelo: 'claude-sonnet-5-5', curto: 'Narrador' },
  { id: 'revisor', nome: 'Revisor', papel: 'Confere texto e imagens contra o checklist e as regras aprendidas.', cor: '#52738a', modelo: 'claude-opus-5-5', curto: 'Revisor' },
  { id: 'publicador', nome: 'Publicador', papel: 'Publica ou agenda no Instagram depois do seu ok.', cor: '#4b7ebc', modelo: null, curto: 'Publicador' },
  { id: 'social', nome: 'Social Media', papel: 'Monta o plano editorial sem repetir o que a marca já postou e coordena a equipe post a post.', cor: '#b0447a', modelo: 'claude-sonnet-5-5', curto: 'Social' },
  { id: 'curador', nome: 'Curador', papel: 'Transforma suas correções em regras curtas e verificáveis.', cor: '#74766d', modelo: 'claude-sonnet-5-5', curto: 'Curador' },
]

export const agentePorId = (id: AgenteId) => AGENTES.find((a) => a.id === id)!
