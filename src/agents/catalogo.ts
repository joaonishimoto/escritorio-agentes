// Equipe padrão. Cada marca pode ligar/desligar agentes e reescrever as instruções no roteiro;
// aqui fica só a identidade visual de cada um. O lugar das mesas vem da planta do andar (pixel/mapa.ts).

export type AgenteId =
  | 'chefe'
  | 'pesquisador'
  | 'redator'
  | 'designer'
  | 'cinegrafista'
  | 'revisor'
  | 'publicador'
  | 'curador'

export type Modelo = 'claude-opus-5-5' | 'claude-sonnet-5-5' | 'claude-haiku-5-5' | null

export interface Agente {
  id: AgenteId
  nome: string
  papel: string
  cor: string
  modelo: Modelo
}

export const AGENTES: Agente[] = [
  { id: 'chefe', nome: 'Chefe de pauta', papel: 'Lê o pedido e o roteiro da marca e distribui o trabalho.', cor: '#1e3d66', modelo: 'claude-sonnet-5-5' },
  { id: 'pesquisador', nome: 'Pesquisador', papel: 'Busca fatos com duas fontes e consulta os dados da marca.', cor: '#3f7650', modelo: 'claude-sonnet-5-5' },
  { id: 'redator', nome: 'Redator', papel: 'Escreve os slides e a legenda no tom de voz da marca.', cor: '#976822', modelo: 'claude-opus-5-5' },
  { id: 'designer', nome: 'Designer', papel: 'Monta os slides no modelo da marca e renderiza os JPEGs.', cor: '#b74e45', modelo: 'claude-sonnet-5-5' },
  { id: 'cinegrafista', nome: 'Cinegrafista', papel: 'Só nos Reels: escreve a cena e gera o vídeo na Kling AI.', cor: '#6d4f8f', modelo: 'claude-sonnet-5-5' },
  { id: 'revisor', nome: 'Revisor', papel: 'Confere texto e imagens contra o checklist e as regras aprendidas.', cor: '#52738a', modelo: 'claude-sonnet-5-5' },
  { id: 'publicador', nome: 'Publicador', papel: 'Publica ou agenda no Instagram depois do seu ok.', cor: '#4b7ebc', modelo: null },
  { id: 'curador', nome: 'Curador', papel: 'Transforma suas correções em regras curtas e verificáveis.', cor: '#74766d', modelo: 'claude-haiku-5-5' },
]

export const agentePorId = (id: AgenteId) => AGENTES.find((a) => a.id === id)!
