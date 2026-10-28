import { agentePorId } from '../agents/catalogo'
import { useEscritorio } from '../store/escritorio'

export function LinhaDoTempo() {
  const eventos = useEscritorio((s) => s.eventos)
  const selecionar = useEscritorio((s) => s.selecionar)
  const visiveis = eventos.filter((e) => e.tipo !== 'texto').slice(-30).reverse()

  return (
    <div className="linha" aria-label="Linha do tempo do post">
      {visiveis.length === 0 ? (
        <p className="muted">Nenhum post em andamento. Rode a demonstração para ver a equipe trabalhando.</p>
      ) : (
        <ol>
          {visiveis.map((e) => {
            const nome = e.agente === 'voce' ? 'Você' : agentePorId(e.agente).nome
            const cor = e.agente === 'voce' ? '#976822' : agentePorId(e.agente).cor
            return (
              <li key={e.id}>
                <button onClick={() => e.agente !== 'voce' && selecionar(e.agente)}>
                  <span className="quem" style={{ color: cor }}>{nome}</span>
                  <span>{e.mensagem}</span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
