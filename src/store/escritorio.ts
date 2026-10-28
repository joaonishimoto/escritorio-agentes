import { create } from 'zustand'
import type { AgenteId } from '../agents/catalogo'

export type Estado = 'ocioso' | 'na_fila' | 'trabalhando' | 'concluido' | 'esperando_voce' | 'erro'

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

export interface ItemAgenda {
  id: string
  /** dia e hora em ISO */
  data: string
  titulo: string
  status: 'agendado' | 'publicado' | 'falhou'
  /** urls dos slides, na ordem (vazio na demonstração) */
  slides?: string[]
  legenda?: string | null
}

interface EscritorioState {
  estados: Record<AgenteId, Estado>
  acaoAtual: Partial<Record<AgenteId, string>>
  /** texto que o agente está produzindo agora (streaming) */
  rascunho: Partial<Record<AgenteId, string>>
  eventos: Evento[]
  entregas: Entrega[]
  selecionado: AgenteId | null
  /** sua mesa ou o calendário da parede, quando abertos */
  foco: 'voce' | 'calendario' | 'financeiro' | 'cofre' | 'sala' | 'gaveta' | null
  aguardandoVoce: boolean
  /** status real do post aberto (fora da demonstração): manda mais que os eventos, que não sabem se você já aprovou ou publicou */
  postEsperandoVoce: boolean | null
  definirPostEsperandoVoce: (v: boolean | null) => void
  /** posts com data, para o calendário da parede */
  agenda: ItemAgenda[]
  /** onde fica cada mesa da sala que está trabalhando, e a sua, em coordenadas do andar (para as pastas voarem) */
  posicoes: Partial<Record<AgenteId | 'voce', [number, number]>>
  /** `animar: false` ao reconstruir um post antigo, para as pastas não voarem todas de uma vez */
  aplicar: (e: Evento, animar?: boolean) => void
  selecionar: (id: AgenteId | null) => void
  focar: (foco: 'voce' | 'calendario' | 'financeiro' | 'cofre' | 'sala' | 'gaveta' | null) => void
  definirAgenda: (agenda: ItemAgenda[]) => void
  definirPosicoes: (posicoes: Partial<Record<AgenteId | 'voce', [number, number]>>) => void
  reiniciar: () => void
}

const NOMES_CURTOS: Record<AgenteId, string> = {
  chefe: 'Chefe de pauta',
  pesquisador: 'Pesquisador',
  redator: 'Redator',
  designer: 'Designer',
  cinegrafista: 'Cinegrafista',
  revisor: 'Revisor',
  publicador: 'Publicador',
  curador: 'Curador',
}

const estadosIniciais = (): Record<AgenteId, Estado> => ({
  chefe: 'ocioso',
  pesquisador: 'ocioso',
  redator: 'ocioso',
  designer: 'ocioso',
  cinegrafista: 'ocioso',
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
  foco: null,
  aguardandoVoce: false,
  postEsperandoVoce: null,
  definirPostEsperandoVoce: (v) => set({ postEsperandoVoce: v }),
  agenda: [],
  posicoes: {},

  aplicar: (e, animar = true) =>
    set((s) => {
      if (s.eventos.some((x) => x.id === e.id)) return {}
      const eventos = [...s.eventos, e].slice(-300)
      if (e.agente === 'voce') {
        const entregas =
          animar && e.tipo === 'entrega' && e.para && e.para !== 'voce'
            ? [...s.entregas, { id: e.id, de: 'voce' as const, para: e.para, inicio: performance.now() }].slice(-6)
            : s.entregas
        if (e.tipo === 'entrega' && e.para && e.para !== 'voce') {
          return {
            eventos,
            entregas,
            aguardandoVoce: false,
            estados: { ...s.estados, [e.para]: 'na_fila' as Estado },
            acaoAtual: { ...s.acaoAtual, [e.para]: 'Recebeu seu pedido, vai começar' },
          }
        }
        return { eventos, entregas, aguardandoVoce: false }
      }
      const id = e.agente
      const estados = { ...s.estados }
      const acaoAtual = { ...s.acaoAtual }
      const rascunho = { ...s.rascunho }
      let entregas = s.entregas
      let aguardandoVoce = s.aguardandoVoce

      switch (e.tipo) {
        case 'inicio':
          aguardandoVoce = false
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
            // quem recebe a pasta fica "na fila" até começar, para dar para ver em que etapa o post está
            if (e.para !== 'voce') {
              estados[e.para] = 'na_fila'
              acaoAtual[e.para] = `Recebeu de ${NOMES_CURTOS[id]}, vai começar`
            }
            if (animar) entregas = [...entregas, { id: e.id, de: id, para: e.para, inicio: performance.now() }].slice(-6)
            aguardandoVoce = e.para === 'voce'
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

  selecionar: (id) => set({ selecionado: id, foco: null }),
  focar: (foco) => set({ foco, selecionado: null }),
  definirAgenda: (agenda) => set({ agenda }),
  definirPosicoes: (posicoes) => set({ posicoes }),

  reiniciar: () =>
    set({ estados: estadosIniciais(), acaoAtual: {}, rascunho: {}, eventos: [], entregas: [], aguardandoVoce: false }),
}))

/** Você tem post para aprovar? Fora da demonstração vale o status do post; na demonstração, os eventos. */
export const selecionarEsperandoVoce = (s: { aguardandoVoce: boolean; postEsperandoVoce: boolean | null }) => s.postEsperandoVoce ?? s.aguardandoVoce
