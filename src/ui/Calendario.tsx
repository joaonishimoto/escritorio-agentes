import { useState } from 'react'
import { mudarDia, noMesmoDia, paraCampo } from '../lib/agenda'
import { chamarApi } from '../lib/api'
import type { Ideia } from '../lib/ideias'
import { numero, useMetricas, type Metricas } from '../lib/metricas'
import { usePlanoAtual, vagasPlanejadas, type Vaga } from '../lib/planos'
import { PlanoEditorial } from './PlanoEditorial'
import { useEscritorio, type ItemAgenda } from '../store/escritorio'
import { VerSlides } from './VerSlides'
import { MESES, chaveDia, diasDoMes } from '../lib/datas'

const SEM_ITENS: ItemAgenda[] = []

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Calendário grande que abre ao clicar no da parede: o mês com as capas dos posts e, ao lado, o dia escolhido com o preview. */
export function Calendario({
  aoAbrirPost,
  aoMudar,
  marcaId,
  marcaNome,
  carregando = false,
  aoPlanejar,
}: {
  aoAbrirPost: (id: string) => void
  /** vaga do plano editorial: abre o Novo post com o tema e o horário dela */
  aoPlanejar?: (ideia: Ideia, quando: Date, vagaId?: string) => void
  aoMudar?: () => void
  /** só os posts desta marca (calendário da parede de uma sala); sem ela, o geral */
  marcaId?: string | null
  marcaNome?: string
  carregando?: boolean
}) {
  const agendaGeral = useEscritorio((s) => s.agenda)
  const agenda = carregando ? SEM_ITENS : marcaId ? agendaGeral.filter((i) => !i.marcaId || i.marcaId === marcaId) : agendaGeral
  const geral = !marcaId && agendaGeral.some((i) => i.marca)
  const focar = useEscritorio((s) => s.focar)
  const metricas = useMetricas(agenda.filter((i) => i.status === 'publicado').map((i) => i.id))
  const hoje = new Date()
  const [mes, setMes] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() })
  const [dia, setDia] = useState<string>(chaveDia(hoje))
  const [aberto, setAberto] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<string | null>(null)
  const [planejando, setPlanejando] = useState(false)
  const { plano, recarregar: recarregarPlano } = usePlanoAtual(aoPlanejar ? marcaId : null)
  const planejadas = vagasPlanejadas(plano)
  const usarVaga = (v: Vaga) => {
    focar(null)
    aoPlanejar?.({ titulo: v.titulo, formato: v.formato, gancho: v.gancho, briefing: v.briefing }, new Date(v.quando), v.id)
  }

  /** Arrastar a capa de um agendado para outro dia: mantém a hora. */
  const soltar = async (dia: Date) => {
    const item = agenda.find((i) => i.id === arrastando)
    setArrastando(null)
    setAlvo(null)
    if (!item) return
    const nova = mudarDia(new Date(item.data), dia)
    if (chaveDia(nova) === chaveDia(new Date(item.data))) return
    if (nova.getTime() < Date.now() + 60_000) return alert('Esse horário já passou. Escolha um dia pela frente.')
    try {
      await chamarApi('aprovar', { post_id: item.id, acao: 'reagendar', quando: nova.toISOString() })
      escolher(chaveDia(nova))
      aoMudar?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Não deu para mudar o dia')
    }
  }

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
  const vagasPorDia = new Map<string, Vaga[]>()
  for (const v of planejadas) {
    const k = chaveDia(new Date(v.quando))
    vagasPorDia.set(k, [...(vagasPorDia.get(k) ?? []), v])
  }
  const doDia = porDia.get(dia) ?? []
  const vagasDoDia = vagasPorDia.get(dia) ?? []
  const [a, m, d] = dia.split('-').map(Number)
  const tituloDia = new Date(a, m, d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const proximos = agenda.filter((i) => i.status === 'agendado' && new Date(i.data) >= hoje).length

  return (
    <div className="modal-fundo" onClick={() => focar(null)}>
      <div className="modal calendario" role="dialog" aria-label="Calendário de posts" onClick={(e) => e.stopPropagation()}>
        <header className="painel-topo">
          <div className="cal-nav">
            <button className="icone" onClick={() => mudarMes(-1)} aria-label="Mês anterior">‹</button>
            <h2>{MESES[mes.mes]} {mes.ano}{marcaNome ? <small className="cal-marca"> · {marcaNome}</small> : geral ? <small className="cal-marca"> · Todas as marcas</small> : null}</h2>
            <button className="icone" onClick={() => mudarMes(1)} aria-label="Próximo mês">›</button>
            <button className="secundario cal-hoje" onClick={() => { setMes({ ano: hoje.getFullYear(), mes: hoje.getMonth() }); escolher(chaveDia(hoje)) }}>Hoje</button>
          </div>
          <div className="cal-topo-dir">
            <span className="muted">{carregando ? 'Carregando os posts…' : proximos ? `${proximos} agendado${proximos > 1 ? 's' : ''} pela frente` : 'Nada agendado pela frente'}</span>
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
                const vagas = vagasPorDia.get(k) ?? []
                const passou = data < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
                // dois posts da mesma marca no mesmo dia disputam o mesmo público
                const choque = itens.some((it) => it.status !== 'falhou' && itens.some((o) => o !== it && o.status !== 'falhou' && o.marcaId === it.marcaId))
                return (
                  <button
                    key={i}
                    className={`cal-dia${k === chaveDia(hoje) ? ' hoje' : ''}${k === dia ? ' escolhido' : ''}${passou ? ' passou' : ''}${choque ? ' choque' : ''}${alvo === k ? ' alvo' : ''}`}
                    onClick={() => escolher(k)}
                    onDragOver={(e) => {
                      if (!arrastando || passou) return
                      e.preventDefault()
                      setAlvo(k)
                    }}
                    onDragLeave={() => setAlvo((a) => (a === k ? null : a))}
                    onDrop={(e) => {
                      e.preventDefault()
                      soltar(data)
                    }}
                    aria-label={`${data.getDate()}${itens.length ? `, ${itens.length} post${itens.length > 1 ? 's' : ''}` : ''}${vagas.length ? `, ${vagas.length} planejado${vagas.length > 1 ? 's' : ''}` : ''}`}
                  >
                    <span className="cal-num">{data.getDate()}</span>
                    {itens.length > 0 && (
                      <span className="cal-capas">
                        {itens.slice(0, 2).map((it) => {
                          const arrastavel = it.status === 'agendado' && !it.id.startsWith('demo')
                          const props = {
                            draggable: arrastavel,
                            onDragStart: arrastavel
                              ? (e: React.DragEvent) => {
                                  e.dataTransfer.effectAllowed = 'move'
                                  setArrastando(it.id)
                                }
                              : undefined,
                            onDragEnd: () => {
                              setArrastando(null)
                              setAlvo(null)
                            },
                            title: arrastavel ? 'Arraste para outro dia' : undefined,
                          }
                          return it.slides?.[0] ? (
                            <img key={it.id} src={it.slides[0]} alt="" className={it.status} loading="lazy" {...props} />
                          ) : (
                            <i key={it.id} className={it.status} {...props} />
                          )
                        })}
                        {itens.length > 2 && <small>+{itens.length - 2}</small>}
                      </span>
                    )}
                    {vagas.length > 0 && itens.length === 0 && (
                      <span className="cal-capas">
                        {vagas.slice(0, 2).map((v) => <i key={v.id} className="planejado" title={v.titulo} />)}
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
              {planejadas.length > 0 && <span><i className="planejado" /> planejado</span>}
              <span className="cal-dica">Arraste a capa de um agendado para mudar o dia</span>
            </div>
          </div>

          <section className="cal-dia-painel" aria-label={tituloDia}>
            {aoPlanejar && marcaId && (
              <button className="secundario cal-planejar" onClick={() => setPlanejando(true)}>
                {plano?.status === 'aprovado' ? `Plano editorial (${planejadas.length} a criar)` : plano?.status === 'rascunho' ? 'Plano editorial (rascunho)' : 'Plano editorial'}
              </button>
            )}
            <h3 className="cal-dia-titulo">{tituloDia}</h3>
            {vagasDoDia.map((v) => (
              <div key={v.id} className="cal-vaga">
                <span className="chip">planejado · {new Date(v.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {v.formato}</span>
                <strong>{v.titulo}</strong>
                {v.gancho && <span className="muted">“{v.gancho}”</span>}
                <button className="primario" onClick={() => usarVaga(v)}>Criar este post</button>
              </div>
            ))}
            {doDia.length === 0 ? (
              vagasDoDia.length ? null : <p className="muted">Nada agendado ou publicado neste dia.</p>
            ) : (
              doDia.map((it) => (
                <PostDoDia
                  key={it.id}
                  item={it}
                  aberto={aberto === it.id || doDia.length === 1}
                  aoAlternar={() => setAberto(aberto === it.id ? null : it.id)}
                  aoAbrirPost={() => { focar(null); aoAbrirPost(it.id) }}
                  aoMudar={aoMudar}
                  mesmoDia={noMesmoDia(agenda, it.marcaId, new Date(it.data), it.id).length}
                  metricas={metricas[it.id]}
                />
              ))
            )}
          </section>
        </div>
      </div>
      {planejando && marcaId && (
        <PlanoEditorial
          marcaId={marcaId}
          marcaNome={marcaNome}
          agenda={agenda}
          plano={plano}
          aoMudar={recarregarPlano}
          aoCriarPost={usarVaga}
          aoFechar={() => setPlanejando(false)}
        />
      )}
    </div>
  )
}

function PostDoDia({
  item,
  aberto,
  aoAlternar,
  aoAbrirPost,
  aoMudar,
  mesmoDia = 0,
  metricas,
}: {
  item: ItemAgenda
  aberto: boolean
  aoAlternar: () => void
  aoAbrirPost: () => void
  aoMudar?: () => void
  /** quantos outros posts da mesma marca saem no mesmo dia */
  mesmoDia?: number
  metricas?: Metricas
}) {
  const [vendo, setVendo] = useState<number | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const [novaHora, setNovaHora] = useState(() => paraCampo(new Date(item.data)))
  const mudouHora = novaHora !== paraCampo(new Date(item.data))
  const reagendar = async () => {
    setCancelando(true)
    try {
      await chamarApi('aprovar', { post_id: item.id, acao: 'reagendar', quando: new Date(novaHora).toISOString() })
      aoMudar?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Não deu para mudar o horário')
    } finally {
      setCancelando(false)
    }
  }
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
          <span className="muted mono">
            {item.marca && <i className="cal-post-marca" style={{ background: item.cor }} />}
            {item.marca ? `${item.marca} · ` : ''}{hora(item.data)} · {slides.length ? `${slides.length} slides` : 'sem slides'}
          </span>
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
          {mesmoDia > 0 && item.status !== 'falhou' && (
            <p className="cal-choque">
              {mesmoDia === 1 ? 'Outro post' : `Mais ${mesmoDia} posts`}{item.marca ? ` da ${item.marca}` : ' desta marca'} sai{mesmoDia === 1 ? '' : 'em'} no mesmo dia. Posts no mesmo dia dividem o alcance; vale passar um para outro dia.
            </p>
          )}
          {item.status === 'agendado' && !demo && (
            <div className="cal-reagendar">
              <label htmlFor={`hora-${item.id}`}>Publicar em</label>
              <input id={`hora-${item.id}`} type="datetime-local" value={novaHora} min={paraCampo(new Date(Date.now() + 5 * 60_000))} onChange={(e) => setNovaHora(e.target.value)} />
              {mudouHora && (
                <button className="primario" disabled={cancelando || !novaHora} onClick={reagendar}>
                  Salvar horário
                </button>
              )}
            </div>
          )}
          {metricas && (
            <dl className="cal-metricas">
              {(
                [
                  ['Alcance', metricas.alcance],
                  ['Salvos', metricas.salvos],
                  ['Compart.', metricas.compartilhamentos],
                  ['Coment.', metricas.comentarios],
                  ['Curtidas', metricas.curtidas],
                ] as const
              ).map(([nome, v]) => (
                <div key={nome}>
                  <dt>{nome}</dt>
                  <dd>{numero(v)}</dd>
                </div>
              ))}
            </dl>
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
