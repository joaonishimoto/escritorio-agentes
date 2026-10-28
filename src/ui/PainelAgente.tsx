import { agentePorId } from '../agents/catalogo'
import { useEscritorio } from '../store/escritorio'
import { COR_ESTADO } from '../office/EstacaoAgente'
import { AcoesDeErro } from './PostComErro'
import type { Post } from '../lib/dados'

const ROTULO_ESTADO = {
  ocioso: 'Ocioso',
  na_fila: 'Na fila',
  trabalhando: 'Trabalhando',
  concluido: 'Concluído',
  esperando_voce: 'Esperando você',
  erro: 'Erro',
} as const

export function PainelAgente({ post, aoMudar }: { post?: Post | null; aoMudar?: () => void }) {
  const id = useEscritorio((s) => s.selecionado)
  const estado = useEscritorio((s) => (id ? s.estados[id] : 'ocioso'))
  const acao = useEscritorio((s) => (id ? s.acaoAtual[id] : undefined))
  const rascunho = useEscritorio((s) => (id ? s.rascunho[id] : undefined))
  const eventos = useEscritorio((s) => s.eventos)
  const selecionar = useEscritorio((s) => s.selecionar)

  if (!id) return null
  const a = agentePorId(id)
  const historico = eventos.filter((e) => e.agente === id && e.tipo !== 'texto').slice().reverse()

  return (
    <aside className="painel" aria-label={`Detalhes do ${a.nome}`}>
      <header className="painel-topo">
        <div>
          <h2>{a.nome}</h2>
          <p className="muted">{a.papel}</p>
        </div>
        <button className="fechar" onClick={() => selecionar(null)} aria-label="Fechar painel">×</button>
      </header>

      <div className="painel-meta">
        <span className="estado" style={{ color: COR_ESTADO[estado], borderColor: COR_ESTADO[estado] }}>
          {ROTULO_ESTADO[estado]}
        </span>
        <span className="mono muted">{a.modelo ?? 'sem IA'}</span>
      </div>

      {acao && (
        <section>
          <h3>Agora</h3>
          <p>{acao}</p>
        </section>
      )}
      {estado === 'erro' && post?.status === 'erro' && aoMudar && <AcoesDeErro post={post} agente={id} aoMudar={aoMudar} />}

      <section>
        <h3>O que está produzindo</h3>
        <pre className="rascunho">{rascunho || 'Nada ainda neste post.'}</pre>
      </section>

      <section>
        <h3>Histórico neste post</h3>
        {historico.length === 0 ? (
          <p className="muted">Sem atividade.</p>
        ) : (
          <ol className="historico">
            {historico.map((e) => (
              <li key={e.id}>
                <time className="mono muted">{new Date(e.criado_em).toLocaleTimeString('pt-BR')}</time>
                <span>{e.mensagem}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </aside>
  )
}
