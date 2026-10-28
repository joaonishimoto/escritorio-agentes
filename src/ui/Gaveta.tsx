import { useState } from 'react'
import { chamarApi } from '../lib/api'
import { VerSlides } from './VerSlides'
import type { Post } from '../lib/dados'

function IconeGaveta() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 12h18M10 8h4M10 16h4" />
    </svg>
  )
}

const FORMATO: Record<string, string> = { carrossel: 'Carrossel', foto: 'Foto', reel: 'Reel' }

/** Gaveta da sala: posts prontos guardados para usar depois. Usar tira da gaveta e leva para a sua mesa. */
export function Gaveta({
  posts,
  marcaNome,
  emDemo,
  aoUsar,
  aoMudar,
  aoFechar,
}: {
  posts: Post[]
  marcaNome?: string
  emDemo: boolean
  aoUsar: (p: Post) => void
  aoMudar: () => void
  aoFechar: () => void
}) {
  const [enviando, setEnviando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [vendo, setVendo] = useState<string[] | null>(null)

  const usar = async (p: Post) => {
    setEnviando(p.id)
    setErro(null)
    try {
      await chamarApi('aprovar', { post_id: p.id, acao: 'tirar_da_gaveta' })
      aoMudar()
      aoUsar(p)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu certo')
    } finally {
      setEnviando(null)
    }
  }

  return (
    <aside className="painel ag gv" aria-label="Gaveta de posts" style={{ ['--cor-agente' as string]: '#8a6a4a', ['--cor-estado' as string]: '#8a6a4a' }}>
      <header className="ag-capa">
        <button className="ag-fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
        <span className="ag-icone">
          <IconeGaveta />
        </span>
        <div className="ag-nome">
          <h2>Gaveta{marcaNome ? ` da ${marcaNome}` : ''}</h2>
          <p>Posts prontos guardados para usar quando quiser. Na aprovação, use "Guardar na gaveta".</p>
        </div>
      </header>
      <div className="ag-corpo">
        {erro && <p className="aviso">{erro}</p>}
        {emDemo || posts.length === 0 ? (
          <div className="ag-vazio">
            <span className="ag-vazio-icone"><IconeGaveta /></span>
            <strong>Gaveta vazia</strong>
            <p>{emDemo ? 'Entre na sua conta para guardar posts aqui.' : 'Quando um post ficar pronto e você não quiser publicar agora, guarde aqui.'}</p>
          </div>
        ) : (
          <ul className="gv-lista">
            {posts.map((p) => {
              const slides = [...(p.slides ?? [])].sort((a, b) => a.ordem - b.ordem).map((s) => s.url)
              const formato = (p as Post & { formato?: string }).formato
              return (
                <li key={p.id}>
                  <button className="gv-capa" onClick={() => slides.length && setVendo(slides)} aria-label="Ver os slides" disabled={!slides.length}>
                    {slides[0] && <img src={slides[0]} alt="" loading="lazy" />}
                    {slides.length > 1 && <span>{slides.length}</span>}
                  </button>
                  <div className="gv-info">
                    <small>
                      {formato ? `${FORMATO[formato] ?? formato} · ` : ''}guardado {new Date(p.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </small>
                    <strong>{p.briefing}</strong>
                    <button className="primario" disabled={enviando === p.id} onClick={() => usar(p)}>
                      {enviando === p.id ? 'Tirando da gaveta…' : 'Usar agora'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {vendo && <VerSlides urls={vendo} inicial={0} aoFechar={() => setVendo(null)} />}
    </aside>
  )
}
