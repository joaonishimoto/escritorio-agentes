// Cabelo, pele e camisa de cada boneco, para dar para reconhecer de longe (no pixel art e na maquete 3D).
import { agentePorId, type AgenteId } from '../agents/catalogo'
import type { Visual } from './sprites'

export const VISUAL_FIN: Visual = { cabelo: '#4a4a4a', pele: '#c98e66', camisa: '#3f7650' }

// cada agente tem um cabelo e um tom de pele, para dar para reconhecer de longe
export const VISUAL: Record<AgenteId | 'voce', Visual> = {
  chefe: { cabelo: '#2b2420', pele: '#e9b98f', camisa: agentePorId('chefe').cor },
  pesquisador: { cabelo: '#7a4a2a', pele: '#f3cfa8', camisa: agentePorId('pesquisador').cor },
  redator: { cabelo: '#e3b85a', pele: '#f3cfa8', camisa: agentePorId('redator').cor },
  designer: { cabelo: '#d9667a', pele: '#c98e66', camisa: agentePorId('designer').cor },
  criativos: { cabelo: '#2a1d16', pele: '#e7b48c', camisa: agentePorId('criativos').cor },
  paginas: { cabelo: '#c98a3a', pele: '#d9a27a', camisa: agentePorId('paginas').cor },
  cinegrafista: { cabelo: '#3b2a4a', pele: '#e0a87c', camisa: agentePorId('cinegrafista').cor },
  narrador: { cabelo: '#5a3a22', pele: '#a86f4c', camisa: agentePorId('narrador').cor },
  revisor: { cabelo: '#9a9a9a', pele: '#f0c7a0', camisa: agentePorId('revisor').cor },
  publicador: { cabelo: '#1c1c1c', pele: '#8d5a3c', camisa: agentePorId('publicador').cor },
  curador: { cabelo: '#b5462f', pele: '#f3cfa8', camisa: agentePorId('curador').cor },
  social: { cabelo: '#3b2a1e', pele: '#c98e62', camisa: agentePorId('social').cor },
  voce: { cabelo: '#1c1c1c', pele: '#e9c39a', camisa: '#1e3d66', calca: '#262820' },
}
