import { useState } from 'react'
import { chamarApi } from '../lib/api'
import { useEscritorio, type ItemAgenda } from '../store/escritorio'
import { VerSlides } from './VerSlides'

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

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Calendário grande que abre ao clicar no da parede: o mês com as capas dos posts e, ao lado, o dia escolhido com o preview. */
export function Calendario({ aoAbrirPost, aoMudar }: { aoAbrirPost: (id: string) => void; aoMudar?: () => void }) {
  const agenda = useEscritorio((s) => s.agenda)
  const focar = useEscritorio((s) => s.focar)
  const hoje = new Date()
  const [mes, setMes] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() })
  const [dia, setDia] = useState<string>(chaveDia(hoje))
  const [aberto, setAberto] = useState<string | null>(null)

  const porDia = new Map<string, ItemAgenda[]>()
  for (const item of [...agenda].sort((a, b) => a.data.localeCompare(b.data))) {
    const k = chaveDia(new Date(item.data))
    porDia.set(k, [...(porDia.get(k) ?? []), item])
  }
  const mudarMes = (n: number) => {
    const d = new Date(mes.ano, mes.mes + n, 1)
    setMes({ ano: d.getFullYear(), mes: d.getMonth() })
  }
  const escolher = (k: string) => {
    setDia(k)
    const itens = porDia.get(k) ?? []
    setAberto(itens.length === 1 ? itens[0].id : null)
  }
  const doDia = porDia.get(dia) ?? []
  const [a, m, d] = dia.split('-').map(Number)
  const tituloDia = new Date(a, m, d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const proximos = agenda.filter((i) => i.status === 'agendado' && new Date(i.data) >= hoje).length

  return (
    <div className="modal-fundo" onClick={() => focar(null)}>
      <div className="modal calendario" role="dialog" aria-label="Calendário de posts" onClick={(e) => e.stopPropagation()}>
        <header className="painel-topo">
          <div className="cal-nav">
            <button className="icone" onClick={() => mudarMes(-1)} aria-label="Mês anterior">‹</button>
            <h2>{MESES[mes.mes]} {mes.ano}</h2>
            <button className="icone" onClick={() => mudarMes(1)} aria-label="Próximo mês">›</button>
            <button className="secundario cal-hoje" onClick={() => { setMes({ ano: hoje.getFullYear(), mes: hoje.getMonth() }); escolher(chaveDia(hoje)) }}>Hoje</button>
          </div>
          <div className="cal-topo-dir">
            <span className="muted">{proximos ? `${proximos} agendado${proximos > 1 ? 's' : ''} pela frente` : 'Nada agendado pela frente'}</span>
            <button className="fechar" onClick={() => focar(null)} aria-label="Fechar calendário">×</button>
          </div>
        </header>

        <div className="cal-corpo">
          <div>
            <div className="cal-grade">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((s) => (
                <span key={s} className="cal-sem">{s}</span>
              ))}
              {diasDoMes(mes.ano, mes.mes).map((data, i) => {
                if (!data) return <span key={i} />
                const k = chaveDia(data)
                const itens = porDia.get(k) ?? []
                const passou = data < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
                return (
                  <button
                    key={i}
                    className={`cal-dia${k === chaveDia(hoje) ? ' hoje' : ''}${k === dia ? ' escolhido' : ''}${passou ? ' passou' : ''}`}
                    onClick={() => escolher(k)}
                    aria-label={`${data.getDate()}${itens.length ? `, ${itens.length} post${itens.length > 1 ? 's' : ''}` : ''}`}
                  >
                    <span className="cal-num">{data.getDate()}</span>
                    {itens.length > 0 && (
                      <span className="cal-capas">
                        {itens.slice(0, 2).map((it) =>
                          it.slides?.[0] ? (
                            <img key={it.id} src={it.slides[0]} alt="" className={it.status} loading="lazy" />
                          ) : (
                            <i key={it.id} className={it.status} />
                          ),
                        )}
                        {itens.length > 2 && <small>+{itens.length - 2}</small>}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="cal-legenda muted">
              <span><i className="agendado" /> agendado</span>
              <span><i className="publicado" /> publicado</span>
              <span><i className="falhou" /> não publicou</span>
            </div>
          </div>

          <section className="cal-dia-painel" aria-label={tituloDia}>
            <h3 className="cal-dia-titulo">{tituloDia}</h3>
            {doDia.length === 0 ? (
              <p className="muted">Nada agendado ou publicado neste dia.</p>
            ) : (
              doDia.map((it) => (
                <PostDoDia
                  key={it.id}
                  item={it}
                  aberto={aberto === it.id || doDia.length === 1}
                  aoAlternar={() => setAberto(aberto === it.id ? null : it.id)}
                  aoAbrirPost={() => { focar(null); aoAbrirPost(it.id) }}
                  aoMudar={aoMudar}
                />
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function PostDoDia({ item, aberto, aoAlternar, aoAbrirPost, aoMudar }: { item: ItemAgenda; aberto: boolean; aoAlternar: () => void; aoAbrirPost: () => void; aoMudar?: () => void }) {
  const [vendo, setVendo] = useState<number | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const demo = item.id.startsWith('demo')
  const slides = item.slides ?? []

  const cancelar = async () => {
    setCancelando(true)
    try {
      await chamarApi('aprovar', { post_id: item.id, acao: 'desagendar' })
      aoMudar?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Não deu para cancelar')
    } finally {
      setCancelando(false)
    }
  }

  return (
    <article className={`cal-post${aberto ? ' aberto' : ''}`}>
      <button className="cal-post-linha" onClick={aoAlternar} aria-expanded={aberto}>
        {slides[0] ? <img src={slides[0]} alt="" /> : <span className={`cal-post-sem ${item.status}`} />}
        <span className="cal-post-texto">
          <strong>{item.titulo}</strong>
          <span className="muted mono">{hora(item.data)} · {slides.length ? `${slides.length} slides` : 'sem slides'}</span>
        </span>
        <span className={`chip status-${item.status === 'falhou' ? 'erro' : item.status}`}>{item.status === 'falhou' ? 'não publicou' : item.status}</span>
      </button>
      {aberto && (
        <div className="cal-post-detalhe">
          {slides.length > 0 && (
            <div className="cal-post-slides">
              {slides.map((url, n) => (
                <button key={url} className="slide-mini" onClick={() => setVendo(n)} aria-label={`Ver slide ${n + 1}`}>
                  <img src={url} alt={`Slide ${n + 1}`} loading="lazy" />
                </button>
              ))}
            </div>
          )}
          {item.status === 'falhou' && <p className="aviso">Chegou a hora, mas não deu para publicar. Veja o motivo no histórico do post.</p>}
          {item.legenda && <pre className="rascunho cal-post-legenda">{item.legenda}</pre>}
          <div className="acoes">
            {!demo && <button className="secundario" onClick={aoAbrirPost}>Abrir no escritório</button>}
            {item.status === 'agendado' && !demo && (
              <button className="perigo" disabled={cancelando} onClick={cancelar}>Cancelar agendamento</button>
            )}
            {item.status === 'falhou' && !demo && (
              <button className="primario" disabled={cancelando} onClick={cancelar}>Voltar para aprovação</button>
            )}
          </div>
        </div>
      )}
      {vendo !== null && <VerSlides urls={slides} inicial={vendo} aoFechar={() => setVendo(null)} />}
    </article>
  )
}
