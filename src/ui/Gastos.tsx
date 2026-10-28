import { useEffect, useState } from 'react'
import { agentePorId, type AgenteId } from '../agents/catalogo'
import type { Custos } from '../lib/dados'
import { dolar, duracao } from '../lib/formato'

function IconeCofre() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 10.5c0-3.6-3.6-6-8-6s-8 2.4-8 6c0 2 1 3.6 2.6 4.6V19h3v-2.2c.8.2 1.6.2 2.4.2s1.7 0 2.4-.2V19h3v-3.9c.8-.5 1.4-1.1 1.8-1.8H21v-3h-2.1" />
      <path d="M9 7.5h4M15.5 9.5h.01" />
    </svg>
  )
}

/** O cofrinho da sala: quanto o post aberto e o mês custaram, e por agente. */
export function PainelGastos({
  custos,
  marcaNome,
  emProducao = false,
  aoFechar,
  aoAbrirFinanceiro,
}: {
  custos: Custos | null
  marcaNome?: string
  emProducao?: boolean
  aoFechar: () => void
  aoAbrirFinanceiro?: () => void
}) {
  // enquanto o post não chega em você, o relógio corre ao vivo
  const [agora, setAgora] = useState(() => Date.now())
  const correndo = !!custos && custos.ateVoceSeg === null && !!custos.criadoEm && emProducao
  useEffect(() => {
    if (!correndo) return
    const id = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [correndo])
  const tempo = custos ? custos.ateVoceSeg ?? (correndo ? (agora - new Date(custos.criadoEm!).getTime()) / 1000 : null) : null
  const maior = Math.max(...(custos?.porAgente.map((a) => a.custo) ?? []), 0.0001)

  return (
    <aside className="painel ag gst" aria-label="Cofrinho da sala" style={{ ['--cor-agente' as string]: '#c76b86', ['--cor-estado' as string]: '#c76b86' }}>
      <header className="ag-capa">
        <button className="ag-fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
        <span className="ag-icone">
          <IconeCofre />
        </span>
        <div className="ag-nome">
          <h2>Cofrinho{marcaNome ? ` da ${marcaNome}` : ''}</h2>
          <p>Quanto esta sala gastou com os agentes: no post aberto e no mês.</p>
        </div>
      </header>

      {!custos ? (
        <div className="ag-corpo">
          <div className="ag-vazio">
            <span className="ag-vazio-icone"><IconeCofre /></span>
            <strong>Sem gastos para mostrar</strong>
            <p>Entre na sua conta e abra um post para ver quanto ele custou.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="ag-fatos">
            <div>
              <span>Neste post</span>
              <strong>{dolar(custos.post)}</strong>
            </div>
            <div>
              <span>No mês</span>
              <strong>{dolar(custos.mes)}</strong>
            </div>
            <div>
              <span>Média por post</span>
              <strong>{dolar(custos.postsNoMes ? custos.mes / custos.postsNoMes : 0)}</strong>
            </div>
            <div>
              <span>{custos.ateVoceSeg !== null ? 'Até você' : 'Em produção'}</span>
              <strong>{tempo !== null ? duracao(tempo) : '—'}</strong>
            </div>
          </div>

          <div className="ag-corpo">
            <section className="fin-bloco">
              <header>
                <h3>Neste post, por agente</h3>
                {custos.trabalhandoSeg > 0 && <span className="muted">{duracao(custos.trabalhandoSeg)} trabalhando</span>}
              </header>
              {custos.porAgente.length === 0 ? (
                <p className="muted">Nenhum agente trabalhou neste post ainda.</p>
              ) : (
                <ul className="fin-lista">
                  {custos.porAgente.map(({ agente, custo, segundos }) => {
                    const a = agentePorId(agente as AgenteId)
                    return (
                      <li key={agente}>
                        <span className="fin-rotulo"><i style={{ background: a?.cor }} />{a?.nome ?? agente}</span>
                        <span className="fin-trilho"><b style={{ width: `${(custo / maior) * 100}%`, background: a?.cor }} /></span>
                        <span className="fin-valor">{dolar(custo)}</span>
                        <small>{duracao(segundos)}</small>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <p className="fin-nota">
              {custos.postsNoMes} {custos.postsNoMes === 1 ? 'post' : 'posts'} nesta sala este mês. Valores da API da Anthropic (modelos e buscas na web).
            </p>
            {aoAbrirFinanceiro && (
              <button className="secundario gst-fin" onClick={aoAbrirFinanceiro}>
                Ver a análise do Financeiro
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  )
}
