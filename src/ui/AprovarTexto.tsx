import { useEffect, useState } from 'react'
import { chamarApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Post } from '../lib/dados'

interface SlideDeTexto {
  tipo?: string
  etiqueta?: string
  titulo?: string
  destaque?: string
  corpo?: string
  itens?: { quantidade: string; item: string }[]
}

/** Sua mesa, antes do design: o texto do copywriter para aprovar ou pedir ajuste. Aprovado, o designer começa. */
export function AprovarTexto({ post, aoMudar, aoFechar }: { post: Post; aoMudar: () => void; aoFechar: () => void }) {
  const [slides, setSlides] = useState<SlideDeTexto[] | null>(null)
  const [comentario, setComentario] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let valendo = true
    supabase
      ?.from('passos')
      .select('saida')
      .eq('post_id', post.id)
      .eq('agente', 'redator')
      .eq('status', 'feito')
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => valendo && setSlides(((data?.saida as { slides?: SlideDeTexto[] } | null)?.slides) ?? []))
    return () => {
      valendo = false
    }
  }, [post.id, post.legenda])

  const decidir = async (acao: 'aprovar_texto' | 'ajustar_texto') => {
    setEnviando(true)
    setErro(null)
    try {
      await chamarApi('aprovar', { post_id: post.id, acao, comentario })
      setComentario('')
      aoMudar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu certo')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <aside className="painel painel-aprovacao" aria-label="Aprovação do texto">
      <header className="painel-topo">
        <div>
          <h2>Aprovar o texto</h2>
          <p className="muted">{post.briefing}</p>
        </div>
        <button className="fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
      </header>
      <p className="muted at-dica">O copywriter terminou. Aprovado o texto, o designer começa os slides; depois o post pronto volta para a sua aprovação final.</p>

      <section>
        <h3>Slides</h3>
        {slides === null ? (
          <p className="muted">Carregando o texto…</p>
        ) : (
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
        )}
      </section>

      <section>
        <h3>Legenda</h3>
        <pre className="rascunho">{post.legenda}</pre>
      </section>

      {erro && <p className="aviso">{erro}</p>}

      <section className="ap-decidir">
        <button className="primario ap-largo" disabled={enviando || slides === null} onClick={() => decidir('aprovar_texto')}>
          Aprovar texto e seguir para o design
        </button>
      </section>

      <section className="ap-ajuste">
        <label htmlFor="ajuste-texto">
          <h3>Quer mudar algo no texto?</h3>
          <span className="muted">Volta para o copywriter, que mexe só no que você pedir, e o texto passa por aqui de novo.</span>
        </label>
        <textarea id="ajuste-texto" rows={3} placeholder="Ex.: troque o título da capa por uma pergunta" value={comentario} onChange={(e) => setComentario(e.target.value)} />
        <button className="secundario" disabled={enviando || !comentario.trim()} onClick={() => decidir('ajustar_texto')}>Pedir ajuste no texto</button>
      </section>
    </aside>
  )
}
