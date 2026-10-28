import { useEffect, useState } from 'react'
import { chamarApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import { VerSlides } from './VerSlides'
import type { Post } from '../lib/dados'

const NOMES: Record<string, string> = {
  chefe: 'chefe de pauta',
  pesquisador: 'pesquisador',
  redator: 'redator',
  designer: 'designer',
  revisor: 'revisor',
  publicador: 'publicador',
  curador: 'curador',
}

/** Post que parou com erro: mostra o motivo e deixa tentar de novo, ou voltar para aprovação se os slides já existem. */
export function PostComErro({ post, aoMudar, aoFechar }: { post: Post; aoMudar: () => void; aoFechar: () => void }) {
  const [falha, setFalha] = useState<{ agente: string; erro: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [vendo, setVendo] = useState<number | null>(null)
  const slides = [...(post.slides ?? [])].sort((a, b) => a.ordem - b.ordem)

  useEffect(() => {
    supabase
      ?.from('passos')
      .select('agente, saida')
      .eq('post_id', post.id)
      .eq('status', 'falhou')
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => data && setFalha({ agente: data.agente, erro: String((data.saida as { erro?: string } | null)?.erro ?? '') }))
  }, [post.id])

  const agir = async (acao: 'tentar_de_novo' | 'desagendar') => {
    setEnviando(true)
    setErro(null)
    try {
      await chamarApi('aprovar', { post_id: post.id, acao })
      aoMudar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu certo')
    } finally {
      setEnviando(false)
    }
  }

  const publicacao = falha?.agente === 'publicador'
  return (
    <aside className="painel" aria-label="Post com erro">
      <header className="painel-topo">
        <div>
          <h2>{publicacao ? 'Não publicou' : 'O post parou no meio'}</h2>
          <p className="muted">{post.briefing}</p>
        </div>
        <button className="fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
      </header>

      <section className="erro-caixa">
        <h3>{falha ? `Erro no ${NOMES[falha.agente] ?? falha.agente}` : 'Erro'}</h3>
        <p>{falha?.erro || 'Carregando o motivo…'}</p>
      </section>

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
      {erro && <p className="aviso">{erro}</p>}

      <div className="acoes acoes-coluna">
        <button className="primario" disabled={enviando} onClick={() => agir('tentar_de_novo')}>
          {publicacao ? 'Publicar de novo agora' : `Tentar de novo${falha ? ` a partir do ${NOMES[falha.agente] ?? falha.agente}` : ''}`}
        </button>
        {slides.length > 0 && (
          <button className="secundario" disabled={enviando} onClick={() => agir('desagendar')}>
            Voltar para aprovação (para agendar ou pedir ajuste)
          </button>
        )}
      </div>
    </aside>
  )
}
