import { useEffect, useState } from 'react'
import { chamarApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import { VerSlides } from './VerSlides'
import type { Post } from '../lib/dados'
import { FUNCIONARIOS_IA, nomeDaIA, opcoesDe } from '../lib/ias'
import { explicarErro } from '../lib/erros'

const NOMES: Record<string, string> = {
  chefe: 'Chefe de pauta',
  pesquisador: 'Pesquisador',
  redator: 'Copywriter',
  designer: 'Designer',
  cinegrafista: 'Cinegrafista',
  narrador: 'Narrador',
  revisor: 'Revisor',
  publicador: 'Publicador',
  curador: 'Curador',
}

function IconeAlerta() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.3 3.9 1.8 18.5A2 2 0 0 0 3.5 21.5h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  )
}

/** As ações para destravar: sugestão pronta, troca de IA e voltar para aprovação. Também aparece no painel do agente. */
export function AcoesDeErro({ post, agente, erro: dado, aoMudar }: { post: Post; agente: string; erro?: string; aoMudar: () => void }) {
  const [buscado, setBuscado] = useState('')
  const erro = dado ?? buscado
  // no painel do agente o erro não vem junto: busca o do passo que falhou
  useEffect(() => {
    if (dado !== undefined) return
    supabase
      ?.from('passos')
      .select('saida')
      .eq('post_id', post.id)
      .eq('agente', agente)
      .eq('status', 'falhou')
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => data && setBuscado(String((data.saida as { erro?: string } | null)?.erro ?? '')))
  }, [dado, post.id, agente])
  const [enviando, setEnviando] = useState<string | null>(null)
  const [falhou, setFalhou] = useState<string | null>(null)
  const [ia, setIa] = useState('')
  const exp = explicarErro(agente, erro)
  const f = FUNCIONARIOS_IA.find((x) => x.agente === agente)
  const atual = post.preferencias?.ias?.[agente] ?? f?.padrao
  const temSlides = (post.slides ?? []).length > 0

  const agir = async (acao: 'tentar_de_novo' | 'desagendar', com?: string) => {
    setEnviando(com ?? acao)
    setFalhou(null)
    try {
      await chamarApi('aprovar', { post_id: post.id, acao, ia: acao === 'tentar_de_novo' && com ? com : undefined })
      aoMudar()
    } catch (e) {
      setFalhou(e instanceof Error ? e.message : 'Não deu certo')
    } finally {
      setEnviando(null)
    }
  }

  const sugestao = exp.trocarPara && exp.trocarPara !== atual ? exp.trocarPara : null
  const trocaDeIA = !!f && !exp.semTrocaDeIA
  return (
    <div className="pe-acoes">
      {falhou && <p className="aviso">{falhou}</p>}
      {sugestao && (
        <button className="primario" disabled={!!enviando} onClick={() => agir('tentar_de_novo', sugestao)}>
          {enviando === sugestao ? 'Mandando…' : exp.rotuloTroca}
        </button>
      )}
      <button className={sugestao ? 'secundario' : 'primario'} disabled={!!enviando} onClick={() => agir('tentar_de_novo', ia || undefined)}>
        {enviando === (ia || 'tentar_de_novo')
          ? 'Mandando…'
          : ia ? `Tentar de novo com ${nomeDaIA(ia)}` : agente === 'publicador' ? 'Publicar de novo agora' : `Tentar de novo${atual && trocaDeIA ? ` com ${nomeDaIA(atual)}` : ''}`}
      </button>
      {trocaDeIA && (
        <label className="pe-ia">
          <span>Ou escolha outra IA para o {NOMES[agente]?.toLowerCase() ?? agente}</span>
          <select value={ia} onChange={(e) => setIa(e.target.value)}>
            <option value="">{atual ? `${nomeDaIA(atual)} (a de agora)` : 'A de agora'}</option>
            {opcoesDe(agente).filter((o) => o.id !== atual).map((o) => (
              <option key={o.id} value={o.id}>{o.nome} · {o.desc}</option>
            ))}
          </select>
        </label>
      )}
      {temSlides && (
        <button className="link pe-voltar" disabled={!!enviando} onClick={() => agir('desagendar')}>
          Voltar para aprovação, para agendar ou pedir ajuste
        </button>
      )}
    </div>
  )
}

/** Post que parou com erro: o que aconteceu em português claro, o que já ficou pronto e como destravar. */
export function PostComErro({ post, aoMudar, aoFechar }: { post: Post; aoMudar: () => void; aoFechar: () => void }) {
  const [falha, setFalha] = useState<{ agente: string; erro: string } | null>(null)
  const [vendo, setVendo] = useState<number | null>(null)
  const [detalhe, setDetalhe] = useState(false)
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

  const publicacao = falha?.agente === 'publicador'
  const exp = falha ? explicarErro(falha.agente, falha.erro) : null
  return (
    <aside className="painel ag pe" aria-label="Post com erro" style={{ ['--cor-agente' as string]: '#b74e45', ['--cor-estado' as string]: '#b74e45' }}>
      <header className="ag-capa">
        <button className="ag-fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
        <span className="ag-icone erro">
          <IconeAlerta />
        </span>
        <div className="ag-nome">
          <h2>{publicacao ? 'Não publicou' : 'O post parou no meio'}</h2>
          <p>{post.briefing}</p>
        </div>
      </header>

      <div className="ag-corpo">
        <section className="pe-motivo">
          <small>{falha ? `Parou no ${NOMES[falha.agente]?.toLowerCase() ?? falha.agente}` : 'Vendo o que aconteceu…'}</small>
          <h3>{exp?.titulo ?? ' '}</h3>
          {exp && <p>{exp.texto}</p>}
          {exp?.link && (
            <a className="primario pe-link" href={exp.link.url} target="_blank" rel="noreferrer">
              {exp.link.rotulo}
            </a>
          )}
          {falha?.erro && (
            <button className="link pe-detalhe" onClick={() => setDetalhe((d) => !d)} aria-expanded={detalhe}>
              {detalhe ? 'Esconder detalhe técnico' : 'Ver detalhe técnico'}
            </button>
          )}
          {detalhe && <code className="pe-cru">{falha?.erro}</code>}
        </section>

        {falha && <AcoesDeErro post={post} agente={falha.agente} erro={falha.erro} aoMudar={aoMudar} />}

        {slides.length > 0 && (
          <section className="pe-pronto">
            <h3>O que já ficou pronto</h3>
            <div className="pe-slides">
              {slides.map((s, n) => (
                <button key={s.ordem} onClick={() => setVendo(n)} aria-label={`Ver slide ${s.ordem}`}>
                  <img src={s.url} alt={`Slide ${s.ordem}`} loading="lazy" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
      {vendo !== null && <VerSlides urls={slides.map((s) => s.url)} inicial={vendo} aoFechar={() => setVendo(null)} />}
    </aside>
  )
}
