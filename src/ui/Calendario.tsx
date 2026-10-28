import { useState } from 'react'
import { useEscritorio } from '../store/escritorio'

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** Dias do mês em semanas de domingo a sábado; `null` preenche o começo e o fim. */
export function diasDoMes(ano: number, mes: number): (Date | null)[] {
  const primeiro = new Date(ano, mes, 1).getDay()
  const total = new Date(ano, mes + 1, 0).getDate()
  const dias: (Date | null)[] = Array(primeiro).fill(null)
  for (let d = 1; d <= total; d++) dias.push(new Date(ano, mes, d))
  while (dias.length % 7) dias.push(null)
  return dias
}

/** Calendário grande que abre ao clicar no da parede. */
export function Calendario({ aoAbrirPost }: { aoAbrirPost: (id: string) => void }) {
  const agenda = useEscritorio((s) => s.agenda)
  const focar = useEscritorio((s) => s.focar)
  const hoje = new Date()
  const [mes, setMes] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() })
  const [dia, setDia] = useState<string | null>(chaveDia(hoje))

  const porDia = new Map<string, typeof agenda>()
  for (const item of agenda) {
    const k = chaveDia(new Date(item.data))
    porDia.set(k, [...(porDia.get(k) ?? []), item])
  }
  const mudarMes = (n: number) => {
    const d = new Date(mes.ano, mes.mes + n, 1)
    setMes({ ano: d.getFullYear(), mes: d.getMonth() })
  }
  const doDia = dia ? porDia.get(dia) ?? [] : []

  return (
    <div className="modal-fundo" onClick={() => focar(null)}>
      <div className="modal calendario" role="dialog" aria-label="Calendário de posts" onClick={(e) => e.stopPropagation()}>
        <header className="painel-topo">
          <div className="cal-nav">
            <button className="icone" onClick={() => mudarMes(-1)} aria-label="Mês anterior">‹</button>
            <h2>{MESES[mes.mes]} {mes.ano}</h2>
            <button className="icone" onClick={() => mudarMes(1)} aria-label="Próximo mês">›</button>
          </div>
          <button className="fechar" onClick={() => focar(null)} aria-label="Fechar calendário">×</button>
        </header>

        <div className="cal-grade">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
            <span key={d} className="cal-sem">{d}</span>
          ))}
          {diasDoMes(mes.ano, mes.mes).map((d, i) => {
            if (!d) return <span key={i} />
            const k = chaveDia(d)
            const itens = porDia.get(k) ?? []
            return (
              <button
                key={i}
                className={`cal-dia${k === chaveDia(hoje) ? ' hoje' : ''}${k === dia ? ' escolhido' : ''}`}
                onClick={() => setDia(k)}
              >
                <span>{d.getDate()}</span>
                <span className="cal-pontos">
                  {itens.slice(0, 3).map((it) => <i key={it.id} className={it.status} />)}
                </span>
              </button>
            )
          })}
        </div>

        <div className="cal-legenda muted">
          <span><i className="agendado" /> agendado</span>
          <span><i className="publicado" /> publicado</span>
        </div>

        <section className="cal-lista">
          {doDia.length === 0 ? (
            <p className="muted">Nada agendado ou publicado neste dia.</p>
          ) : (
            doDia.map((it) => (
              <button key={it.id} onClick={() => { focar(null); aoAbrirPost(it.id) }}>
                <time className="mono">{new Date(it.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
                <span>{it.titulo}</span>
                <span className={`chip status-${it.status}`}>{it.status}</span>
              </button>
            ))
          )}
        </section>
      </div>
    </div>
  )
}
