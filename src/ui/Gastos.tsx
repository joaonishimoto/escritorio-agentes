import { useState } from 'react'
import { agentePorId, type AgenteId } from '../agents/catalogo'
import type { Custos } from '../lib/dados'

const dolar = (v: number) => `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Quanto está custando: o post aberto e o mês. Clicar abre o detalhe por agente. */
export function Gastos({ custos }: { custos: Custos }) {
  const [aberto, setAberto] = useState(false)
  const maior = Math.max(...custos.porAgente.map((a) => a.custo), 0.0001)
  return (
    <div className="gastos">
      <button className="gastos-resumo" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        <span>💰 {dolar(custos.post)} <small>neste post</small></span>
        <span className="gastos-sep" />
        <span>{dolar(custos.mes)} <small>no mês</small></span>
      </button>
      {aberto && (
        <div className="gastos-detalhe">
          <h3>Neste post, por agente</h3>
          {custos.porAgente.length === 0 ? (
            <p className="muted">Nenhum agente trabalhou ainda.</p>
          ) : (
            <ul>
              {custos.porAgente.map(({ agente, custo }) => {
                const a = agentePorId(agente as AgenteId)
                return (
                  <li key={agente}>
                    <span className="gastos-nome">{a?.nome ?? agente}</span>
                    <span className="gastos-barra"><i style={{ width: `${(custo / maior) * 100}%`, background: a?.cor }} /></span>
                    <span className="mono">{dolar(custo)}</span>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="muted gastos-rodape">
            {custos.postsNoMes} {custos.postsNoMes === 1 ? 'post' : 'posts'} este mês, média de {dolar(custos.postsNoMes ? custos.mes / custos.postsNoMes : 0)} por post.
            Valores da API da Anthropic (modelos e buscas na web).
          </p>
        </div>
      )}
    </div>
  )
}
