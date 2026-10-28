import { useEffect, useState } from 'react'
import { agentePorId, type AgenteId } from '../agents/catalogo'
import type { Custos } from '../lib/dados'

/** 75 → "1 min 15 s"; 4000 → "1 h 06 min" */
export function duracao(seg: number) {
  const s = Math.round(seg)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min${s % 60 ? ` ${String(s % 60).padStart(2, '0')} s` : ''}`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

const dolar = (v: number) => `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Quanto está custando: o post aberto e o mês. Clicar abre o detalhe por agente. */
export function Gastos({ custos, emProducao = false }: { custos: Custos; emProducao?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const maior = Math.max(...custos.porAgente.map((a) => a.custo), 0.0001)
  // enquanto o post não chega em você, o relógio corre ao vivo
  const [agora, setAgora] = useState(() => Date.now())
  const correndo = custos.ateVoceSeg === null && !!custos.criadoEm && emProducao
  useEffect(() => {
    if (!correndo) return
    const id = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [correndo])
  const tempo = custos.ateVoceSeg ?? (correndo ? (agora - new Date(custos.criadoEm!).getTime()) / 1000 : null)
  return (
    <div className="gastos">
      <button className="gastos-resumo" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        {tempo !== null && (
          <>
            <span title={custos.ateVoceSeg !== null ? 'Da criação até chegar na sua mesa' : 'Tempo desde a criação'}>
              ⏱ {duracao(tempo)} <small>{custos.ateVoceSeg !== null ? 'até você' : 'em produção'}</small>
            </span>
            <span className="gastos-sep" />
          </>
        )}
        <span>💰 {dolar(custos.post)} <small>neste post</small></span>
        <span className="gastos-sep" />
        <span>{dolar(custos.mes)} <small>no mês</small></span>
      </button>
      {aberto && (
        <div className="gastos-detalhe">
          <h3>Neste post, por agente</h3>
          <p className="muted gastos-rodape">
            {custos.ateVoceSeg !== null && <>Chegou na sua mesa em {duracao(custos.ateVoceSeg)}. </>}
            Agentes trabalhando: {duracao(custos.trabalhandoSeg)} no total.
          </p>
          {custos.porAgente.length === 0 ? (
            <p className="muted">Nenhum agente trabalhou ainda.</p>
          ) : (
            <ul>
              {custos.porAgente.map(({ agente, custo, segundos }) => {
                const a = agentePorId(agente as AgenteId)
                return (
                  <li key={agente}>
                    <span className="gastos-nome">{a?.nome ?? agente}</span>
                    <span className="gastos-barra"><i style={{ width: `${(custo / maior) * 100}%`, background: a?.cor }} /></span>
                    <span className="mono">{dolar(custo)}</span>
                    <span className="mono muted gastos-tempo">{duracao(segundos)}</span>
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
