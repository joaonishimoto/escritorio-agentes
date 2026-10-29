import { useState } from 'react'
import { chamarApi } from '../lib/api'
import { VerSlides } from './VerSlides'
import { AGENTES } from '../agents/catalogo'
import { decidirRegra, type Post, type Regra } from '../lib/dados'

/** Sua mesa: slides e legenda para aprovar, ajustar ou reprovar, e regras novas para aceitar. */
export function Aprovacao({ post, regras, aoMudar, aoFechar }: { post: Post; regras: Regra[]; aoMudar: () => void; aoFechar: () => void }) {
  const [vendo, setVendo] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmar, setConfirmar] = useState<'agora' | 'agendar' | null>(null)
  // horário que você já tinha escolhido no Novo post, se ainda não passou
  const [quando, setQuando] = useState(() => {
    const d = post.preferencias?.agendar_para ? new Date(post.preferencias.agendar_para) : null
    return d && d.getTime() > Date.now() + 5 * 60_000 ? paraCampo(d) : sugestaoDeHorario()
  })
  const slides = [...(post.slides ?? [])].sort((a, b) => a.ordem - b.ordem)

  const decidir = async (acao: 'aprovar' | 'agendar' | 'corrigir' | 'reprovar' | 'guardar') => {
    setEnviando(true)
    setErro(null)
    try {
      await chamarApi('aprovar', { post_id: post.id, acao, comentario, quando: acao === 'agendar' ? new Date(quando).toISOString() : undefined })
      setComentario('')
      setConfirmar(null)
      aoMudar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu certo')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <aside className="painel painel-aprovacao" aria-label="Aprovação do post">
      <header className="painel-topo">
        <div>
          <h2>Sua aprovação</h2>
          <p className="muted">{post.briefing}</p>
        </div>
        <button className="fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
      </header>

      {post.video?.url && (
        <section>
          <h3>Vídeo do Reel</h3>
          <video className="video-reel" src={post.video.url} controls playsInline preload="metadata" poster={slides[0]?.url} />
          <p className="muted">A imagem abaixo é a capa.</p>
          {post.video.narracao?.texto && (
            <>
              <h3>Narração</h3>
              <pre className="rascunho">{post.video.narracao.texto}</pre>
            </>
          )}
        </section>
      )}
      {slides.length > 0 && (
        <div className="slides">
          {slides.map((s, n) => (
            <button key={s.ordem} className="slide-mini" onClick={() => setVendo(n)} aria-label={`Ver slide ${s.ordem}`}>
              <img src={s.url} alt={`Slide ${s.ordem}`} loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {vendo !== null && <VerSlides urls={slides.map((s) => s.url)} inicial={vendo} aoFechar={() => setVendo(null)} />}

      <section>
        <h3>Legenda</h3>
        <pre className="rascunho">{post.legenda}</pre>
      </section>

      {erro && <p className="aviso">{erro}</p>}

      <section className="ap-decidir">
        {confirmar === 'agora' ? (
          <div className="confirmar">
            <p>Publicar agora no Instagram? Isso não dá para desfazer daqui.</p>
            <div className="ap-par">
              <button className="secundario" onClick={() => setConfirmar(null)}>Voltar</button>
              <button className="primario" disabled={enviando} onClick={() => decidir('aprovar')}>Publicar agora</button>
            </div>
          </div>
        ) : confirmar === 'agendar' ? (
          <div className="confirmar">
            <label htmlFor="quando"><p>Publicar no Instagram em:</p></label>
            <input id="quando" type="datetime-local" value={quando} min={paraCampo(new Date(Date.now() + 5 * 60_000))} onChange={(e) => setQuando(e.target.value)} />
            <p className="muted">Dá para cancelar pelo calendário até a hora marcada.</p>
            <div className="ap-par">
              <button className="secundario" onClick={() => setConfirmar(null)}>Voltar</button>
              <button className="primario" disabled={enviando || !quando} onClick={() => decidir('agendar')}>Agendar</button>
            </div>
          </div>
        ) : (
          <>
            <h3>Ficou bom?</h3>
            <button className="primario ap-largo" disabled={enviando} onClick={() => setConfirmar('agendar')}>Aprovar e agendar</button>
            <button className="secundario ap-largo" disabled={enviando} onClick={() => setConfirmar('agora')}>Publicar agora</button>
            <button className="link ap-gaveta" disabled={enviando} onClick={() => decidir('guardar')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 12h18M10 8h4M10 16h4" /></svg>
              Guardar na gaveta para usar depois
            </button>
          </>
        )}
      </section>

      <section className="ap-ajuste">
        <label htmlFor="comentario">
          <h3>Quer mudar algo?</h3>
          <span className="muted">O que você escrever volta para a equipe e vira regra para os próximos posts.</span>
        </label>
        <textarea
          id="comentario"
          rows={3}
          placeholder="Ex.: o título da capa está cobrindo o copo"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />
        <div className="ap-par">
          <button className="secundario" disabled={enviando || !comentario.trim()} onClick={() => decidir('corrigir')}>Pedir ajuste</button>
          <button className="perigo" disabled={enviando || !comentario.trim()} onClick={() => decidir('reprovar')}>Reprovar</button>
        </div>
      </section>

      <RegrasPropostas regras={regras} aoMudar={aoMudar} />
    </aside>
  )
}

export function RegrasPropostas({ regras, aoMudar }: { regras: Regra[]; aoMudar: () => void }) {
  const [decidindo, setDecidindo] = useState<string | null>(null)
  if (regras.length === 0) return null
  const decidir = (id: string, status: 'ativa' | 'arquivada') => {
    setDecidindo(id)
    decidirRegra(id, status).then(aoMudar).finally(() => setDecidindo(null))
  }
  return (
    <section className="rp">
      <header className="rp-cabeca">
        <span className="rp-icone" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /></svg>
        </span>
        <div>
          <h3>O curador sugeriu {regras.length === 1 ? 'uma regra nova' : `${regras.length} regras novas`}</h3>
          <p className="muted">Ele aprende com seus ajustes. Aceitas, valem para os próximos posts desta marca.</p>
        </div>
      </header>
      <ul className="rp-lista">
        {regras.map((r) => {
          const a = AGENTES.find((x) => x.id === r.agente)
          return (
            <li key={r.id} style={{ ['--cor' as string]: a?.cor ?? '#52738a' }}>
              <span className="rp-quem"><i />Para o {a?.nome.toLowerCase() ?? r.agente}</span>
              <p className="rp-regra">{r.regra}</p>
              {r.motivo && <p className="rp-motivo">Por quê: {r.motivo}</p>}
              <div className="rp-acoes">
                <button className="primario" disabled={decidindo === r.id} onClick={() => decidir(r.id, 'ativa')}>Aceitar regra</button>
                <button className="link" disabled={decidindo === r.id} onClick={() => decidir(r.id, 'arquivada')}>Descartar</button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Data no formato do campo datetime-local, no fuso do navegador. */
function paraCampo(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Próximo horário bom: hoje às 19h, ou amanhã se já passou. */
function sugestaoDeHorario() {
  const d = new Date()
  if (d.getHours() >= 18) d.setDate(d.getDate() + 1)
  d.setHours(19, 0, 0, 0)
  return paraCampo(d)
}
