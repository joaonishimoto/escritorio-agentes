import { useEscritorio } from '../store/escritorio'
import type { Post } from '../lib/dados'

/** O que aparece ao clicar na sua mesa quando não há post aberto esperando você. */
export function SuaMesa({ pendentes, emDemo, aoAbrirPost }: { pendentes: Post[]; emDemo: boolean; aoAbrirPost: (id: string) => void }) {
  const focar = useEscritorio((s) => s.focar)
  return (
    <aside className="painel" aria-label="Sua mesa">
      <header className="painel-topo">
        <div>
          <h2>Sua mesa</h2>
          <p className="muted">Os posts chegam aqui quando a equipe termina e o revisor aprova.</p>
        </div>
        <button className="fechar" onClick={() => focar(null)} aria-label="Fechar painel">×</button>
      </header>
      {emDemo ? (
        <p className="muted">Na demonstração nada é publicado de verdade. Crie um post real em "Novo post" para aprovar aqui.</p>
      ) : pendentes.length === 0 ? (
        <p className="muted">Nenhum post esperando você agora.</p>
      ) : (
        <section>
          <h3>Esperando você</h3>
          <ul className="lista-pendentes">
            {pendentes.map((p) => (
              <li key={p.id}>
                <button onClick={() => aoAbrirPost(p.id)}>
                  {p.status === 'erro' && <span className="chip status-erro">com erro</span>} {p.briefing}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}
