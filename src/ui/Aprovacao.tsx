import { useState } from 'react'
import { chamarApi } from '../lib/api'
import { VerSlides } from './VerSlides'
import { decidirRegra, type Post, type Regra } from '../lib/dados'

/** Sua mesa: slides e legenda para aprovar, ajustar ou reprovar, e regras novas para aceitar. */
export function Aprovacao({ post, regras, aoMudar, aoFechar }: { post: Post; regras: Regra[]; aoMudar: () => void; aoFechar: () => void }) {
  const [vendo, setVendo] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmarPublicar, setConfirmarPublicar] = useState(false)
  const slides = [...(post.slides ?? [])].sort((a, b) => a.ordem - b.ordem)

  const decidir = async (acao: 'aprovar' | 'corrigir' | 'reprovar') => {
    setEnviando(true)
    setErro(null)
    try {
      await chamarApi('aprovar', { post_id: post.id, acao, comentario })
      setComentario('')
      setConfirmarPublicar(false)
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

      <section>
        <label htmlFor="comentario"><h3>Ajuste (vira regra para a equipe)</h3></label>
        <textarea
          id="comentario"
          rows={3}
          placeholder="Ex.: o título da capa está cobrindo o copo"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />
      </section>
      {erro && <p className="aviso">{erro}</p>}

      <div className="acoes acoes-coluna">
        {confirmarPublicar ? (
          <div className="confirmar">
            <p>Publicar agora no Instagram? Isso não dá para desfazer daqui.</p>
            <div className="acoes">
              <button className="secundario" onClick={() => setConfirmarPublicar(false)}>Voltar</button>
              <button className="primario" disabled={enviando} onClick={() => decidir('aprovar')}>Publicar agora</button>
            </div>
          </div>
        ) : (
          <button className="primario" disabled={enviando} onClick={() => setConfirmarPublicar(true)}>Aprovar e publicar</button>
        )}
        <button className="secundario" disabled={enviando || !comentario.trim()} onClick={() => decidir('corrigir')}>Pedir ajuste</button>
        <button className="perigo" disabled={enviando || !comentario.trim()} onClick={() => decidir('reprovar')}>Reprovar</button>
      </div>

      <RegrasPropostas regras={regras} aoMudar={aoMudar} />
    </aside>
  )
}

export function RegrasPropostas({ regras, aoMudar }: { regras: Regra[]; aoMudar: () => void }) {
  if (regras.length === 0) return null
  return (
    <section>
      <h3>Regras novas propostas pelo curador</h3>
      <ul className="regras">
        {regras.map((r) => (
          <li key={r.id}>
            <span className="mono muted">{r.agente}</span>
            <p>{r.regra}</p>
            <div className="acoes">
              <button className="secundario" onClick={() => decidirRegra(r.id, 'arquivada').then(aoMudar)}>Descartar</button>
              <button className="primario" onClick={() => decidirRegra(r.id, 'ativa').then(aoMudar)}>Aceitar</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
