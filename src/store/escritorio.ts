import { create } from 'zustand'
import type { AgenteId } from '../agents/catalogo'

export type Estado = 'ocioso' | 'trabalhando' | 'concluido' | 'esperando_voce' | 'erro'

/** Espelha uma linha da tabela `eventos` do Supabase. */
export interface Evento {
  id: string
  post_id: string
  agente: AgenteId | 'voce'
  tipo: 'inicio' | 'acao' | 'texto' | 'fim' | 'entrega' | 'espera' | 'erro'
  mensagem: string
  /** para `entrega`: quem recebe a pasta */
  para?: AgenteId | 'voce'
  custo_usd?: number
  criado_em: string
}

export interface Entrega {
  id: string
  de: AgenteId | 'voce'
  para: AgenteId | 'voce'
  inicio: number
}

interface EscritorioState {
  estados: Record<AgenteId, Estado>
  acaoAtual: Partial<Record<AgenteId, string>>
  /** texto que o agente está produzindo agora (streaming) */
  rascunho: Partial<Record<AgenteId, string>>
  eventos: Evento[]
  entregas: Entrega[]
  selecionado: AgenteId | null
  aguardandoVoce: boolean
  aplicar: (e: Evento) => void
  selecionar: (id: AgenteId | null) => void
  reiniciar: () => void
}

const estadosIniciais = (): Record<AgenteId, Estado> => ({
  chefe: 'ocioso',
  pesquisador: 'ocioso',
  redator: 'ocioso',
  designer: 'ocioso',
  revisor: 'ocioso',
  publicador: 'ocioso',
  curador: 'ocioso',
})

export const useEscritorio = create<EscritorioState>((set) => ({
  estados: estadosIniciais(),
  acaoAtual: {},
  rascunho: {},
  eventos: [],
  entregas: [],
  selecionado: null,
  aguardandoVoce: false,

  aplicar: (e) =>
    set((s) => {
      const eventos = [...s.eventos, e].slice(-200)
      if (e.agente === 'voce') {
        return { eventos, aguardandoVoce: false }
      }
      const id = e.agente
      const estados = { ...s.estados }
      const acaoAtual = { ...s.acaoAtual }
      const rascunho = { ...s.rascunho }
      let entregas = s.entregas
      let aguardandoVoce = s.aguardandoVoce

      switch (e.tipo) {
        case 'inicio':
          estados[id] = 'trabalhando'
          acaoAtual[id] = e.mensagem
          rascunho[id] = ''
          break
        case 'acao':
          estados[id] = 'trabalhando'
          acaoAtual[id] = e.mensagem
          break
        case 'texto':
          rascunho[id] = (rascunho[id] ?? '') + e.mensagem
          break
        case 'fim':
          estados[id] = 'concluido'
          acaoAtual[id] = e.mensagem
          break
        case 'entrega':
          estados[id] = 'concluido'
          if (e.para) {
            entregas = [...entregas, { id: e.id, de: id, para: e.para, inicio: performance.now() }].slice(-6)
            if (e.para === 'voce') aguardandoVoce = true
          }
          break
        case 'espera':
          estados[id] = 'esperando_voce'
          acaoAtual[id] = e.mensagem
          aguardandoVoce = true
          break
        case 'erro':
          estados[id] = 'erro'
          acaoAtual[id] = e.mensagem
          break
      }
      return { eventos, estados, acaoAtual, rascunho, entregas, aguardandoVoce }
    }),

  selecionar: (id) => set({ selecionado: id }),

  reiniciar: () =>
    set({ estados: estadosIniciais(), acaoAtual: {}, rascunho: {}, eventos: [], entregas: [], aguardandoVoce: false }),
}))
