import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Escritorio } from './office/Escritorio'
import { PainelAgente } from './ui/PainelAgente'
import { LinhaDoTempo } from './ui/LinhaDoTempo'
import { Login, TrocarSenha } from './ui/Login'
import { NovoPost } from './ui/NovoPost'
import { Aprovacao, RegrasPropostas } from './ui/Aprovacao'
import { Biblioteca } from './ui/Biblioteca'
import { Logo } from './ui/Logo'
import { SuaMesa } from './ui/SuaMesa'
import { Calendario } from './ui/Calendario'
import { useEscritorio } from './store/escritorio'
import { rodarDemo, pararDemo } from './lib/simulacao'
import { modoDemo, supabase } from './lib/supabase'
import { useMarcas, usePostAoVivo, usePosts, useRegrasPropostas } from './lib/dados'

const ROTULO_STATUS: Record<string, string> = {
  rascunho: 'rascunho',
  em_producao: 'em produção',
  aguardando_aprovacao: 'esperando você',
  aprovado: 'publicando',
  agendado: 'agendado',
  publicado: 'publicado',
  reprovado: 'reprovado',
  erro: 'com erro',
}

export default function App() {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(!modoDemo)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setCarregando(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (carregando) return <p className="carregando">Carregando…</p>
  if (!modoDemo && !sessao) return <Login />
  return <Painel logado={!!sessao} />
}

function Painel({ logado }: { logado: boolean }) {
  const aplicar = useEscritorio((s) => s.aplicar)
  const reiniciar = useEscritorio((s) => s.reiniciar)
  const selecionado = useEscritorio((s) => s.selecionado)
  const foco = useEscritorio((s) => s.foco)
  const focar = useEscritorio((s) => s.focar)
  const definirAgenda = useEscritorio((s) => s.definirAgenda)

  const marcas = useMarcas(logado)
  const [marcaId, setMarcaId] = useState<string | null>(null)
  const [postId, setPostId] = useState<string | null>(null)
  const [recarregar, setRecarregar] = useState(0)
  const [novo, setNovo] = useState(false)
  const [trocarSenha, setTrocarSenha] = useState(false)
  const [biblioteca, setBiblioteca] = useState(false)
  const [emDemo, setEmDemo] = useState(modoDemo)

  useEffect(() => {
    if (!marcaId && marcas[0]) setMarcaId(marcas[0].id)
  }, [marcas, marcaId])

  const posts = usePosts(marcaId, recarregar)
  const post = usePostAoVivo(emDemo ? null : postId)
  const regras = useRegrasPropostas(marcaId, recarregar)
  const marca = marcas.find((m) => m.id === marcaId)
  const mudou = () => setRecarregar((n) => n + 1)
  // na demonstração (sem conta) o andar mostra a Drinfy e uma sala de exemplo
  const marcasNoAndar = marcas.length ? marcas : [{ id: 'demo', nome: 'Drinfy' }, { id: 'demo-2', nome: 'Outra marca' }]

  useEffect(() => {
    if (!postId && posts[0] && !emDemo) setPostId(posts[0].id)
  }, [posts, postId, emDemo])

  // quando o status do post muda, atualiza a lista
  useEffect(() => {
    if (post) mudou()
  }, [post?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // o calendário da parede mostra o que tem data: agendados pela data marcada, publicados pela data em que saíram
  useEffect(() => {
    if (emDemo && posts.length === 0) return definirAgenda(agendaDemo())
    definirAgenda(
      posts.flatMap((p) => {
        const data = p.status === 'agendado' ? p.agendado_para : p.status === 'publicado' ? p.publicado_em : null
        return data ? [{ id: p.id, data, titulo: p.briefing, status: p.status as 'agendado' | 'publicado' }] : []
      }),
    )
  }, [posts, emDemo, definirAgenda])

  const demo = () => {
    setEmDemo(true)
    pararDemo()
    reiniciar()
    rodarDemo(aplicar)
  }

  const verPost = (id: string) => {
    pararDemo()
    setEmDemo(false)
    setPostId(id)
  }

  const esperando = !emDemo && post?.status === 'aguardando_aprovacao'
  const mostrarAprovacao = esperando && !selecionado && (foco === 'voce' || foco === null)
  const pendentes = posts.filter((p) => p.status === 'aguardando_aprovacao')

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          <Logo />
          {logado && marcas.length > 1 ? (
            <select className="seletor" aria-label="Marca" value={marcaId ?? ''} onChange={(e) => { setMarcaId(e.target.value); setPostId(null) }}>
              {marcas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          ) : (
            <strong className="nome-marca">{marca?.nome ?? 'Drinfy'}</strong>
          )}
          {logado && posts.length > 0 && (
            <>
              <span className="barra" aria-hidden>/</span>
              <select className="seletor" aria-label="Post" value={emDemo ? '' : (postId ?? '')} onChange={(e) => verPost(e.target.value)}>
                {emDemo && <option value="">Demonstração</option>}
                {posts.map((p) => (
                  <option key={p.id} value={p.id}>{p.briefing.slice(0, 48)}</option>
                ))}
              </select>
            </>
          )}
          {emDemo && <span className="chip chip-demo">demonstração</span>}
          {!emDemo && post && <span className={`chip status-${post.status}`}>{ROTULO_STATUS[post.status] ?? post.status}</span>}
        </div>
        <div className="topo-acoes">
          {logado && marcaId && <button className="primario" onClick={() => setNovo(true)}>Novo post</button>}
          <Menu>
            {logado && marcaId && <button onClick={() => setBiblioteca(true)}>Fotos da marca</button>}
            <button onClick={() => focar('calendario')}>Calendário</button>
            <button onClick={demo}>Ver demonstração</button>
            {logado && <hr />}
            {logado && <button onClick={() => setTrocarSenha(true)}>Trocar senha</button>}
            {logado && <button onClick={() => supabase?.auth.signOut()}>Sair</button>}
          </Menu>
        </div>
      </header>

      <main className="palco">
        <Suspense fallback={<p className="carregando">Montando o escritório…</p>}>
          <Escritorio
            marcas={marcasNoAndar}
            marcaAtiva={marcaId ?? marcasNoAndar[0]?.id ?? null}
            aoEscolherMarca={(id) => {
              if (id === marcaId || !marcas.some((m) => m.id === id)) return
              setMarcaId(id)
              setPostId(null)
            }}
          />
        </Suspense>
        {mostrarAprovacao && post ? (
          <Aprovacao post={post} regras={regras} aoMudar={mudou} />
        ) : foco === 'voce' ? (
          <SuaMesa pendentes={pendentes} emDemo={emDemo} aoAbrirPost={(id) => { verPost(id); focar('voce') }} />
        ) : (
          <PainelAgente />
        )}
        {logado && marcas.length === 0 && (
          <div className="vazio">
            <h2>Nenhuma marca ainda</h2>
            <p className="muted">Peça no chat para cadastrar uma marca.</p>
          </div>
        )}
        {!mostrarAprovacao && !selecionado && !foco && regras.length > 0 && !emDemo && (
          <aside className="painel painel-regras" aria-label="Regras propostas">
            <RegrasPropostas regras={regras} aoMudar={mudou} />
          </aside>
        )}
      </main>

      <footer className="rodape">
        <LinhaDoTempo extra={!emDemo && post && <span className="custo mono muted">US$ {Number(post.custo_usd).toFixed(2)}</span>} />
      </footer>

      {foco === 'calendario' && <Calendario aoAbrirPost={verPost} />}
      {biblioteca && marcaId && <Biblioteca marcaId={marcaId} aoFechar={() => setBiblioteca(false)} />}
      {trocarSenha && <TrocarSenha aoFechar={() => setTrocarSenha(false)} />}
      {novo && marcaId && (
        <NovoPost
          marcaId={marcaId}
          aoFechar={() => setNovo(false)}
          aoCriar={(p) => {
            setNovo(false)
            mudou()
            verPost(p.id)
          }}
        />
      )}
    </div>
  )
}

/** Alguns posts de mentira para o calendário não ficar vazio na demonstração. */
function agendaDemo() {
  const d = (dias: number, h: number) => {
    const x = new Date()
    x.setDate(x.getDate() + dias)
    x.setHours(h, 0, 0, 0)
    return x.toISOString()
  }
  return [
    { id: 'demo-1', data: d(-6, 19), titulo: 'Negroni: a história do conde', status: 'publicado' as const },
    { id: 'demo-2', data: d(-2, 18), titulo: '3 drinks com limão', status: 'publicado' as const },
    { id: 'demo-3', data: d(2, 19), titulo: 'Gin tônica do jeito certo', status: 'agendado' as const },
    { id: 'demo-4', data: d(5, 20), titulo: 'Caipirinha: açúcar ou mel?', status: 'agendado' as const },
  ]
}

/** Menu de três pontinhos: fecha ao clicar fora, ao apertar Esc ou ao escolher uma opção. */
function Menu({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setAberto(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  return (
    <div className="menu" ref={ref}>
      <button className="icone" aria-label="Mais opções" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" /></svg>
      </button>
      {aberto && (
        <div className="menu-lista" role="menu" onClick={() => setAberto(false)}>
          {children}
        </div>
      )}
    </div>
  )
}
