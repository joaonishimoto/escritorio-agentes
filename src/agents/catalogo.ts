import { SALA } from '../office/salas'

// Equipe padrão. Cada marca pode ligar/desligar agentes e reescrever as instruções no roteiro;
// aqui ficam só a identidade visual e o lugar de cada um no escritório.

export type AgenteId =
  | 'chefe'
  | 'pesquisador'
  | 'redator'
  | 'designer'
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
  /** posição da mesa no chão do escritório (x, z) */
  mesa: [number, number]
  /** para onde o boneco olha, em radianos */
  rotacao: number
}

export const AGENTES: Agente[] = [
  { id: 'chefe', nome: 'Chefe de pauta', papel: 'Lê o pedido e o roteiro da marca e distribui o trabalho.', cor: '#1e3d66', modelo: 'claude-sonnet-5-5', mesa: [-4.5, -2.6], rotacao: 0 },
  { id: 'pesquisador', nome: 'Pesquisador', papel: 'Busca fatos com duas fontes e consulta os dados da marca.', cor: '#3f7650', modelo: 'claude-sonnet-5-5', mesa: [0, -2.6], rotacao: 0 },
  { id: 'redator', nome: 'Redator', papel: 'Escreve os slides e a legenda no tom de voz da marca.', cor: '#976822', modelo: 'claude-opus-5-5', mesa: [4.5, -2.6], rotacao: 0 },
  { id: 'designer', nome: 'Designer', papel: 'Monta os slides no modelo da marca e renderiza os JPEGs.', cor: '#b74e45', modelo: 'claude-sonnet-5-5', mesa: [4.5, 2.6], rotacao: Math.PI },
  { id: 'revisor', nome: 'Revisor', papel: 'Confere texto e imagens contra o checklist e as regras aprendidas.', cor: '#52738a', modelo: 'claude-opus-5-5', mesa: [0, 2.6], rotacao: Math.PI },
  { id: 'publicador', nome: 'Publicador', papel: 'Publica ou agenda no Instagram depois do seu ok.', cor: '#4b7ebc', modelo: null, mesa: [-4.5, 2.6], rotacao: Math.PI },
  { id: 'curador', nome: 'Curador', papel: 'Transforma suas correções em regras curtas e verificáveis.', cor: '#74766d', modelo: 'claude-haiku-5-5', mesa: [-1.6, 0], rotacao: Math.PI / 2 },
]

// a posição das mesas vem da sala escolhida
for (const a of AGENTES) {
  const [x, z, r] = SALA.mesas[a.id]
  a.mesa = [x, z]
  a.rotacao = r
}

export const MESA_VOCE: [number, number] = SALA.voce

export const agentePorId = (id: AgenteId) => AGENTES.find((a) => a.id === id)!
