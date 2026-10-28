import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { agentePorId, type AgenteId } from './agents/catalogo'
import type { Estado } from './store/escritorio'
import type { Session } from '@supabase/supabase-js'
import { Escritorio } from './office/Escritorio'
import { EscritorioPixel } from './pixel/EscritorioPixel'
import { PainelAgente } from './ui/PainelAgente'
import { LinhaDoTempo } from './ui/LinhaDoTempo'
import { Login, TrocarSenha } from './ui/Login'
import { NovoPost } from './ui/NovoPost'
import { Aprovacao, RegrasPropostas } from './ui/Aprovacao'
import { Biblioteca } from './ui/Biblioteca'
import { Logo } from './ui/Logo'
import { SuaMesa } from './ui/SuaMesa'
import { Calendario } from './ui/Calendario'
import { Gastos } from './ui/Gastos'
import { ConectarInstagram } from './ui/ConectarInstagram'
import { NovaSala } from './ui/NovaSala'
import { useEscritorio } from './store/escritorio'
import { rodarDemo, pararDemo } from './lib/simulacao'
import { modoDemo, supabase } from './lib/supabase'
import { chamarApi } from './lib/api'
import { tocarAviso } from './lib/som'
import { corDaMarca, salvarCorDaMarca, type Post, useCustos, useMarcas, usePostAoVivo, usePosts, useRegrasPropostas } from './lib/dados'

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
  const estados = useEscritorio((s) => s.estados)
  const eventos = useEscritorio((s) => s.eventos)

  const [versaoMarcas, setVersaoMarcas] = useState(0)
  const [novaSala, setNovaSala] = useState(false)
  const marcasDoBanco = useMarcas(logado, versaoMarcas)
  const marcas = marcasDoBanco ?? []
  // logado, o escritório só aparece depois que as marcas chegam (antes piscava a sala de exemplo)
  const carregandoMarcas = logado && !!supabase && marcasDoBanco === null
  const [marcaId, setMarcaId] = useState<string | null>(null)
  const [postId, setPostId] = useState<string | null>(null)
  const [recarregar, setRecarregar] = useState(0)
  const [novo, setNovo] = useState(false)
  const [trocarSenha, setTrocarSenha] = useState(false)
  const [biblioteca, setBiblioteca] = useState(false)
  const [instagram, setInstagram] = useState(false)
  const [emDemo, setEmDemo] = useState(modoDemo)
  const [visual, setVisual] = useState<'pixel' | '3d'>(() => {
    const pedido = new URLSearchParams(location.search).get('visual')
    if (pedido === 'pixel' || pedido === '3d') return pedido
    try {
      return localStorage.getItem('visual') === '3d' ? '3d' : 'pixel'
    } catch {
      return 'pixel'
    }
  })
  const trocarVisual = () => {
    const novo = visual === 'pixel' ? '3d' : 'pixel'
    setVisual(novo)
    try {
      localStorage.setItem('visual', novo)
    } catch {
      // sem armazenamento local: vale até recarregar
    }
  }

  useEffect(() => {
    if (!marcaId && marcas[0]) setMarcaId(marcas[0].id)
  }, [marcas, marcaId])

  const posts = usePosts(marcaId, recarregar)
  const post = usePostAoVivo(emDemo ? null : postId)
  const regras = useRegrasPropostas(marcaId, recarregar)
  const marca = marcas.find((m) => m.id === marcaId)
  const mudou = () => setRecarregar((n) => n + 1)
  const escolherMarca = (id: string) => {
    if (id === marcaId || !marcas.some((m) => m.id === id)) return
    setMarcaId(id)
    setPostId(null)
  }
  // na demonstração (sem conta) o andar mostra a Drinfy e uma sala de exemplo
  const marcasNoAndar = marcas.length
    ? marcas.map((m) => ({ id: m.id, nome: m.nome, cor: corDaMarca(m) }))
    : [{ id: 'demo', nome: 'Drinfy', cor: '#EE382B' }, { id: 'demo-2', nome: 'Outra marca', cor: '#2f6f73' }]
  const mudarCor = (id: string, cor: string) => {
    const m = marcas.find((x) => x.id === id)
    if (m) salvarCorDaMarca(m, cor).catch((e) => console.error('não salvou a cor da sala', e))
  }

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
        // agendado que deu erro na hora de publicar aparece como "falhou" no dia marcado
        const falhou = p.status === 'erro' && !!p.agendado_para
        const data = p.status === 'agendado' || falhou ? p.agendado_para : p.status === 'publicado' ? p.publicado_em : null
        const slides = [...(p.slides ?? [])].sort((a, b) => a.ordem - b.ordem).map((x) => x.url)
        const status = falhou ? 'falhou' : (p.status as 'agendado' | 'publicado')
        return data ? [{ id: p.id, data, titulo: p.briefing, status, slides, legenda: p.legenda }] : []
      }),
    )
  }, [posts, emDemo, definirAgenda])

  // rede de segurança: se o post em produção ficar 45 s sem nenhum evento, pede para o servidor rodar a fila
  const ultimoEvento = eventos.at(-1)?.criado_em
  const cutucando = useRef(false)
  useEffect(() => {
    if (emDemo || !post || !['em_producao', 'aprovado'].includes(post.status)) return
    const id = window.setInterval(() => {
      const desde = Date.now() - new Date(ultimoEvento ?? post.criado_em).getTime()
      if (desde < 45_000 || cutucando.current) return
      cutucando.current = true
      chamarApi('acordar', { post_id: post.id })
        .catch((e) => console.error('não consegui retomar o post', e))
        .finally(() => (cutucando.current = false))
    }, 15_000)
    return () => window.clearInterval(id)
  }, [emDemo, post, ultimoEvento])

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
  // o post pronto não abre o painel sozinho: você pula na sua mesa e toca um aviso; o painel abre clicando nela
  const mostrarAprovacao = esperando && !selecionado && foco === 'voce'
  const statusAnterior = useRef<{ id: string; status: string } | null>(null)
  useEffect(() => {
    if (!post) return
    const antes = statusAnterior.current
    if (antes?.id === post.id && antes.status !== 'aguardando_aprovacao' && post.status === 'aguardando_aprovacao' && visual === '3d') tocarAviso() // no pixel, toca quando a pasta chega na sua mesa
    statusAnterior.current = { id: post.id, status: post.status }
  }, [post?.id, post?.status]) // eslint-disable-line react-hooks/exhaustive-deps
  const custos = useCustos(emDemo ? null : marcaId, emDemo ? null : (post?.id ?? null), post ? Number(post.custo_usd) : undefined)
  const pendentes = posts.filter((p) => p.status === 'aguardando_aprovacao')
  const agendados = emDemo ? 0 : posts.filter((p) => p.status === 'agendado').length

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          <Logo />
          <span className="nome-app">Escritório</span>
          <span className="barra" aria-hidden>/</span>
          <Popover
            rotulo="Marca"
            botao={
              <>
                <i className="ponto-marca" style={{ background: marcasNoAndar.find((m) => m.id === (marcaId ?? marcasNoAndar[0]?.id))?.cor }} />
                <strong>{marca?.nome ?? 'Drinfy'}</strong>
              </>
            }
            desativado={!logado}
          >
            {marcas.map((m) => (
              <button key={m.id} className={m.id === marcaId ? 'ativo' : ''} onClick={() => escolherMarca(m.id)}>
                <i className="ponto-marca" style={{ background: corDaMarca(m) }} /> {m.nome}
                {m.identidade?.neutra ? <small className="muted">neutra</small> : null}
              </button>
            ))}
            <hr />
            <button onClick={() => setNovaSala(true)}>+ Nova sala</button>
          </Popover>
          {emDemo ? (
            <span className="chip chip-demo">demonstração</span>
          ) : (
            logado &&
            posts.length > 0 && (
              <Popover
                rotulo="Post"
                largo
                botao={
                  <>
                    {post && <i className={`ponto-status status-${post.status}`} />}
                    <span className="seletor-texto">{post?.briefing ?? 'Escolha um post'}</span>
                    {post && <span className={`chip status-${post.status}`}>{ROTULO_STATUS[post.status] ?? post.status}</span>}
                  </>
                }
              >
                {GRUPOS_STATUS.map(([titulo, status]) => {
                  const doGrupo = posts.filter((p) => status.includes(p.status))
                  if (!doGrupo.length) return null
                  return (
                    <div key={titulo} className="pop-grupo">
                      <span className="pop-titulo">{titulo}</span>
                      {doGrupo.map((p) => {
                        const capa = [...(p.slides ?? [])].sort((x, y) => x.ordem - y.ordem)[0]?.url
                        return (
                          <button key={p.id} className={`pop-post${p.id === postId ? ' ativo' : ''}`} onClick={() => verPost(p.id)}>
                            {capa ? <img src={capa} alt="" loading="lazy" /> : <span className="pop-capa" />}
                            <span className="pop-post-texto">
                              <span>{p.briefing}</span>
                              <small className="muted">{quandoDoPost(p)}</small>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </Popover>
            )
          )}
        </div>
        <div className="topo-acoes">
          <button className="botao-topo" onClick={() => focar('calendario')} aria-label="Calendário">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <rect x="2" y="3" width="12" height="11" rx="2" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
            </svg>
            <span className="so-largo">Calendário</span>
            {agendados > 0 && <span className="contador">{agendados}</span>}
          </button>
          {logado && marcaId && (
            <button className="botao-topo" onClick={() => setBiblioteca(true)} aria-label="Fotos da marca">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <rect x="2" y="2.5" width="12" height="11" rx="2" /><circle cx="6" cy="6.5" r="1.3" /><path d="m2.5 12 3.5-3.5 3 3 2-2 2.5 2.5" />
              </svg>
              <span className="so-largo">Fotos</span>
            </button>
          )}
          {logado && marcaId && <button className="primario" onClick={() => setNovo(true)}>Novo post</button>}
          <Menu>
            {logado && marca && (
              <button onClick={() => setInstagram(true)}>{marca.instagram_conta_id ? 'Instagram conectado' : 'Conectar Instagram'}</button>
            )}
            <button onClick={demo}>Ver demonstração</button>
            <button onClick={trocarVisual}>{visual === 'pixel' ? 'Ver em 3D' : 'Ver em pixel art'}</button>
            {logado && <hr />}
            {logado && <button onClick={() => setTrocarSenha(true)}>Trocar senha</button>}
            {logado && <button onClick={() => supabase?.auth.signOut()}>Sair</button>}
          </Menu>
        </div>
      </header>

      <main className="palco">
        {custos && <Gastos custos={custos} />}
        <Etapa estados={estados} aguardando={!emDemo && post?.status === 'aguardando_aprovacao'} ativo={emDemo || post?.status === 'em_producao'} />
        <Suspense fallback={<p className="carregando">Montando o escritório…</p>}>
          {carregandoMarcas ? (
            <p className="carregando">Montando o escritório…</p>
          ) : visual === 'pixel' ? (
            <EscritorioPixel
              aoMudarCor={mudarCor}
              marcas={marcasNoAndar}
              marcaAtiva={marcaId ?? marcasNoAndar[0]?.id ?? null}
              aoEscolherMarca={escolherMarca}
            />
          ) : (
            <Escritorio
              marcas={marcasNoAndar}
              marcaAtiva={marcaId ?? marcasNoAndar[0]?.id ?? null}
              aoEscolherMarca={escolherMarca}
            />
          )}
        </Suspense>
        {mostrarAprovacao && post ? (
          <Aprovacao
            post={post}
            regras={regras}
            aoMudar={mudou}
            aoFechar={() => focar(null)}
          />
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
        <LinhaDoTempo />
      </footer>

      {foco === 'calendario' && <Calendario aoAbrirPost={verPost} aoMudar={mudou} />}
      {biblioteca && marcaId && <Biblioteca marcaId={marcaId} aoFechar={() => setBiblioteca(false)} />}
      {novaSala && (
        <NovaSala
          aoFechar={() => setNovaSala(false)}
          aoCriar={(m) => {
            setNovaSala(false)
            setVersaoMarcas((v) => v + 1)
            setMarcaId(m.id)
            setPostId(null)
          }}
        />
      )}
      {instagram && marca && <ConectarInstagram marca={marca} aoFechar={() => setInstagram(false)} aoConectar={() => location.reload()} />}
      {trocarSenha && <TrocarSenha aoFechar={() => setTrocarSenha(false)} />}
      {novo && marcaId && (
        <NovoPost
          marcaId={marcaId}
          neutra={!!marca?.identidade?.neutra}
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

const GRUPOS_STATUS: [string, string[]][] = [
  ['Esperando você', ['aguardando_aprovacao']],
  ['Em produção', ['em_producao', 'rascunho', 'aprovado']],
  ['Agendados', ['agendado']],
  ['Publicados', ['publicado']],
  ['Outros', ['reprovado', 'erro']],
]

function quandoDoPost(p: Post) {
  const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  if (p.status === 'agendado' && p.agendado_para) return `sai ${fmt(p.agendado_para)}`
  if (p.status === 'publicado' && p.publicado_em) return `saiu ${fmt(p.publicado_em)}`
  return `criado ${fmt(p.criado_em)}`
}

/** Botão do topo que abre uma lista; fecha ao clicar fora, no Esc ou ao escolher. */
function Popover({ rotulo, botao, children, largo, desativado }: { rotulo: string; botao: ReactNode; children: ReactNode; largo?: boolean; desativado?: boolean }) {
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
  if (desativado) return <span className="seletor-topo estatico">{botao}</span>
  return (
    <div className="menu" ref={ref}>
      <button className="seletor-topo" aria-label={rotulo} aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        {botao}
        <svg className="seta-baixo" width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
      {aberto && (
        <div className={`menu-lista pop-lista${largo ? ' largo' : ''}`} role="menu" onClick={() => setAberto(false)}>
          {children}
        </div>
      )}
    </div>
  )
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

/** Em que etapa o post está agora, sempre visível no canto do escritório. */
function Etapa({ estados, aguardando, ativo }: { estados: Record<AgenteId, Estado>; aguardando: boolean; ativo: boolean }) {
  const ids = Object.keys(estados) as AgenteId[]
  const trabalhando = ids.find((id) => estados[id] === 'trabalhando')
  const naFila = ids.find((id) => estados[id] === 'na_fila')
  const texto = aguardando
    ? 'Esperando sua aprovação'
    : trabalhando
      ? `${agentePorId(trabalhando).nome} trabalhando`
      : naFila
        ? `${agentePorId(naFila).nome} vai começar`
        : null
  if (!texto || (!ativo && !aguardando)) return null
  return (
    <div className="etapa" role="status">
      <span className={`etapa-ponto${aguardando ? ' voce' : ''}`} />
      {texto}
    </div>
  )
}
