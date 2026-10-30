import { useEffect, useRef, useState } from 'react'
import { AGENTES, agentePorId, type AgenteId } from '../agents/catalogo'
import { useEscritorio } from '../store/escritorio'
import { useAndamento, type Post, type SlideDeTexto } from '../lib/dados'
import { VerSlides } from './VerSlides'

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const SITUACAO: Record<string, string> = {
  aguardando_texto: 'O texto está na sua mesa para aprovar',
  aguardando_aprovacao: 'Pronto, esperando você na sua mesa',
  agendado: 'Aprovado e agendado',
  publicado: 'Publicado',
  guardado: 'Guardado na gaveta',
  reprovado: 'Reprovado',
  erro: 'Parou com erro',
}

/**
 * Prévia do post enquanto a equipe trabalha: os slides renderizados mais novos, a legenda atual e o que o
 * revisor apontou. Atualiza sozinha a cada entrega, sem esperar o post chegar na sua mesa.
 */
export function PreviaAoVivo({ post, aoFechar, aoAbrirMesa }: { post: Post; aoFechar: () => void; aoAbrirMesa: () => void }) {
  const estados = useEscritorio((s) => s.estados)
  const acaoAtual = useEscritorio((s) => s.acaoAtual)
  // cada entrega ou fim de agente pode ter mudado texto, slides ou revisão: busca as entregas de novo
  const gatilho = useEscritorio((s) => s.eventos.filter((e) => e.tipo === 'entrega' || e.tipo === 'fim' || e.tipo === 'erro').length)
  const andamento = useAndamento(post.id, gatilho)
  const [vendo, setVendo] = useState<number | null>(null)

  const slides = [...(post.slides ?? [])].sort((a, b) => a.ordem - b.ordem)
  const novos = useSlidesNovos(post.id, slides)
  const ids = Object.keys(estados) as AgenteId[]
  const trabalhando = ids.find((id) => estados[id] === 'trabalhando') ?? ids.find((id) => estados[id] === 'na_fila')
  const emProducao = ['em_producao', 'aprovado'].includes(post.status)
  const naMesa = ['aguardando_texto', 'aguardando_aprovacao', 'erro'].includes(post.status)
  const designerMexendo = estados.designer === 'trabalhando' || estados.designer === 'na_fila'
  const revisao = andamento?.revisao

  return (
    <aside className="painel painel-aprovacao pv" aria-label="Como o post está ficando">
      <header className="painel-topo">
        <div>
          <h2>Como o post está ficando</h2>
          <p className="muted">{post.briefing}</p>
        </div>
        <button className="fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
      </header>

      {emProducao && trabalhando ? (
        <div className="ag-ao-vivo">
          <span className="ag-pulso" aria-hidden />
          <div>
            <small>{agentePorId(trabalhando).nome} {estados[trabalhando] === 'na_fila' ? 'vai começar' : 'trabalhando'}</small>
            <p>{acaoAtual[trabalhando] || 'Começando…'}</p>
          </div>
        </div>
      ) : (
        SITUACAO[post.status] && (
          <div className="pv-situacao">
            <span>{SITUACAO[post.status]}</span>
            {naMesa && <button className="link" onClick={aoAbrirMesa}>Abrir na sua mesa</button>}
          </div>
        )
      )}

      {post.video?.url && (
        <section>
          <h3>Vídeo do Reel</h3>
          <video className="video-reel" src={post.video.url} controls playsInline preload="metadata" poster={slides[0]?.url} />
        </section>
      )}

      <section>
        <h3>{slides.length ? (slides.length === 1 ? 'Imagem renderizada mais nova' : 'Slides renderizados mais novos') : 'Slides'}</h3>
        {slides.length > 0 ? (
          <>
            <div className="slides">
              {slides.map((s, n) => (
                <button key={s.url} className={`slide-mini${novos.has(s.ordem) ? ' pv-novo' : ''}`} onClick={() => setVendo(n)} aria-label={`Ver slide ${s.ordem}`}>
                  <img src={s.url} alt={`Slide ${s.ordem}`} loading="lazy" />
                  {novos.has(s.ordem) && <span className="pv-selo">novo</span>}
                </button>
              ))}
            </div>
            {designerMexendo && emProducao && <p className="muted pv-nota">O designer está mexendo nos slides; a versão nova aparece aqui sozinha.</p>}
          </>
        ) : andamento?.textoDosSlides?.length ? (
          <>
            <p className="muted pv-nota">O designer ainda não desenhou. Este é o texto de cada slide.</p>
            <TextoDosSlides slides={andamento.textoDosSlides} />
          </>
        ) : (
          <p className="muted pv-nota">Aparecem aqui assim que o redator e o designer entregarem.</p>
        )}
        {slides.length > 0 && !!andamento?.textoDosSlides?.length && (
          <details className="pv-texto">
            <summary>Texto de cada slide</summary>
            <TextoDosSlides slides={andamento.textoDosSlides} />
          </details>
        )}
      </section>
      {vendo !== null && <VerSlides urls={slides.map((s) => s.url)} inicial={vendo} aoFechar={() => setVendo(null)} />}

      <section>
        <h3>Legenda</h3>
        {post.legenda ? <pre className="rascunho">{post.legenda}</pre> : <p className="muted pv-nota">O redator ainda não escreveu.</p>}
      </section>

      {post.video?.narracao?.texto && (
        <section>
          <h3>Narração</h3>
          <pre className="rascunho">{post.video.narracao.texto}</pre>
        </section>
      )}

      <section>
        <h3>
          Revisor
          {revisao?.quando && <span className="pv-quando"> · {revisao.vez > 1 ? `${revisao.vez}ª conferência` : 'conferência'} às {hora(revisao.quando)}</span>}
        </h3>
        {estados.revisor === 'trabalhando' && <p className="muted pv-nota">Conferindo agora…</p>}
        {revisao ? (
          <div className={`pv-revisao${revisao.aprovado ? ' ok' : ''}`}>
            <strong>{revisao.aprovado ? 'Aprovou' : revisao.problemas.length ? `Apontou ${revisao.problemas.length === 1 ? '1 ponto' : `${revisao.problemas.length} pontos`}` : 'Mandou com pendências'}</strong>
            {revisao.problemas.length > 0 && (
              <ul className="pv-apontamentos">
                {revisao.problemas.map((p, i) => {
                  const a = AGENTES.find((x) => x.id === p.agente)
                  return (
                    <li key={i} style={{ ['--cor' as string]: a?.cor ?? '#52738a' }}>
                      <span className="pv-para">Para o {a?.nome.toLowerCase() ?? p.agente}</span>
                      <p>{p.problema}</p>
                    </li>
                  )
                })}
              </ul>
            )}
            {revisao.resumo && <p className="pv-resumo">{revisao.resumo}</p>}
          </div>
        ) : (
          estados.revisor !== 'trabalhando' && <p className="muted pv-nota">{post.preferencias?.revisar === false ? 'Este post não passa pelo revisor.' : 'Ainda não conferiu.'}</p>
        )}
        {andamento?.checagem && (
          <div className="pv-checagem">
            <span>A checagem automática dos slides ainda aponta</span>
            <pre className="rascunho">{andamento.checagem}</pre>
          </div>
        )}
      </section>

      {emProducao && <p className="muted pv-rodape">Atualiza sozinho a cada entrega da equipe.</p>}
    </aside>
  )
}

function TextoDosSlides({ slides }: { slides: SlideDeTexto[] }) {
  return (
    <ol className="at-slides">
      {slides.map((s, i) => (
        <li key={i}>
          {s.etiqueta && <span className="at-etiqueta">{s.etiqueta}</span>}
          <strong>{s.titulo}</strong>
          {s.corpo && <p>{s.corpo}</p>}
          {!!s.itens?.length && (
            <ul>
              {s.itens.map((x, j) => (
                <li key={j}>{[x.quantidade, x.item].filter(Boolean).join(' ')}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  )
}

/** Slides que mudaram desde a última versão vista aqui: ficam marcados por alguns segundos. */
function useSlidesNovos(postId: string, slides: { ordem: number; url: string }[]) {
  const [novos, setNovos] = useState<Set<number>>(new Set())
  const vistos = useRef<{ post: string; urls: Map<number, string> } | null>(null)
  const chave = slides.map((s) => `${s.ordem}:${s.url}`).join('|')
  useEffect(() => {
    const atual = new Map(slides.map((s) => [s.ordem, s.url]))
    const antes = vistos.current
    vistos.current = { post: postId, urls: atual }
    // primeira vez que abre (ou outro post): nada é novo
    if (!antes || antes.post !== postId) return setNovos(new Set())
    const mudaram = new Set([...atual].filter(([ordem, url]) => antes.urls.get(ordem) !== url).map(([ordem]) => ordem))
    if (!mudaram.size) return
    setNovos(mudaram)
    const id = window.setTimeout(() => setNovos(new Set()), 10_000)
    return () => window.clearTimeout(id)
  }, [postId, chave]) // eslint-disable-line react-hooks/exhaustive-deps
  return novos
}
