import { useState } from 'react'
import { agentePorId } from '../agents/catalogo'
import { useEscritorio, type Evento } from '../store/escritorio'

const quem = (e: Evento) =>
  e.agente === 'voce' ? { nome: 'Você', cor: '#976822' } : { nome: agentePorId(e.agente).nome, cor: agentePorId(e.agente).cor }

/** Rodapé de uma linha: só o último acontecimento. O histórico completo abre por cima quando você pede. */
export function LinhaDoTempo({ extra }: { extra?: React.ReactNode }) {
  const eventos = useEscritorio((s) => s.eventos)
  const selecionar = useEscritorio((s) => s.selecionar)
  const [aberto, setAberto] = useState(false)
  const visiveis = eventos.filter((e) => e.tipo !== 'texto')
  const ultimo = visiveis.at(-1)

  return (
    <div className="linha">
      {aberto && visiveis.length > 0 && (
        <ol className="linha-historico" aria-label="Histórico do post">
          {visiveis.slice(-60).reverse().map((e) => {
            const q = quem(e)
            return (
              <li key={e.id}>
                <button onClick={() => e.agente !== 'voce' && selecionar(e.agente)}>
                  <time className="mono muted">{new Date(e.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
                  <span className="quem" style={{ color: q.cor }}>{q.nome}</span>
                  <span>{e.mensagem}</span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
      <div className="linha-atual">
        {ultimo ? (
          <p>
            <span className="ponto" style={{ background: quem(ultimo).cor }} />
            <strong>{quem(ultimo).nome}</strong>
            <span className="muted">{ultimo.mensagem}</span>
          </p>
        ) : (
          <p className="muted">Nenhum post em andamento.</p>
        )}
        {extra}
        {visiveis.length > 1 && (
          <button className="link" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
            {aberto ? 'Fechar histórico' : `Histórico (${visiveis.length})`}
          </button>
        )}
      </div>
    </div>
  )
}
