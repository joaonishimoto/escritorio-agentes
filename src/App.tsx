import { Suspense, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Escritorio } from './office/Escritorio'
import { PainelAgente } from './ui/PainelAgente'
import { LinhaDoTempo } from './ui/LinhaDoTempo'
import { Login } from './ui/Login'
import { NovoPost } from './ui/NovoPost'
import { Aprovacao, RegrasPropostas } from './ui/Aprovacao'
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

  const marcas = useMarcas(logado)
  const [marcaId, setMarcaId] = useState<string | null>(null)
  const [postId, setPostId] = useState<string | null>(null)
  const [recarregar, setRecarregar] = useState(0)
  const [novo, setNovo] = useState(false)
  const [emDemo, setEmDemo] = useState(modoDemo)

  useEffect(() => {
    if (!marcaId && marcas[0]) setMarcaId(marcas[0].id)
  }, [marcas, marcaId])

  const posts = usePosts(marcaId, recarregar)
  const post = usePostAoVivo(emDemo ? null : postId)
  const regras = useRegrasPropostas(marcaId, recarregar)
  const marca = marcas.find((m) => m.id === marcaId)
  const mudou = () => setRecarregar((n) => n + 1)

  useEffect(() => {
    if (!postId && posts[0] && !emDemo) setPostId(posts[0].id)
  }, [posts, postId, emDemo])

  // quando o status do post muda, atualiza a lista
  useEffect(() => {
    if (post) mudou()
  }, [post?.status]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const mostrarAprovacao = !emDemo && post?.status === 'aguardando_aprovacao' && !selecionado

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          <h1>Escritório de Agentes</h1>
          {logado && marcas.length > 1 ? (
            <select aria-label="Marca" value={marcaId ?? ''} onChange={(e) => { setMarcaId(e.target.value); setPostId(null) }}>
              {marcas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          ) : (
            <span className="chip">{marca?.nome ?? 'Drinfy'}</span>
          )}
          {emDemo && <span className="chip chip-demo">demonstração</span>}
          {!emDemo && post && <span className={`chip status-${post.status}`}>{ROTULO_STATUS[post.status] ?? post.status}</span>}
        </div>
        <div className="topo-acoes">
          {logado && posts.length > 0 && (
            <select aria-label="Post" value={emDemo ? '' : (postId ?? '')} onChange={(e) => verPost(e.target.value)}>
              {emDemo && <option value="">Escolha um post</option>}
              {posts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.briefing.slice(0, 40)} · {ROTULO_STATUS[p.status] ?? p.status}
                </option>
              ))}
            </select>
          )}
          <button className="secundario" onClick={demo}>Ver demonstração</button>
          {logado && marcaId && <button className="primario" onClick={() => setNovo(true)}>Novo post</button>}
          {logado && <button className="link" onClick={() => supabase?.auth.signOut()}>Sair</button>}
        </div>
      </header>

      <main className="palco">
        <Suspense fallback={<p className="carregando">Montando o escritório…</p>}>
          <Escritorio />
        </Suspense>
        {mostrarAprovacao && post ? (
          <Aprovacao post={post} regras={regras} aoMudar={mudou} />
        ) : (
          <PainelAgente />
        )}
        {logado && marcas.length === 0 && (
          <div className="vazio">
            <h2>Nenhuma marca ainda</h2>
            <p className="muted">Sua conta está criada. Me avise no chat que eu cadastro a Drinfy como primeira marca.</p>
          </div>
        )}
        {!mostrarAprovacao && !selecionado && regras.length > 0 && !emDemo && (
          <aside className="painel painel-regras" aria-label="Regras propostas">
            <RegrasPropostas regras={regras} aoMudar={mudou} />
          </aside>
        )}
      </main>

      <footer className="rodape">
        <LinhaDoTempo />
        {!emDemo && post && <span className="custo mono muted">custo deste post: US$ {Number(post.custo_usd).toFixed(2)}</span>}
      </footer>

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
