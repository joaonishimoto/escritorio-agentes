import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { agentePorId, type AgenteId } from './agents/catalogo'
import type { Estado } from './store/escritorio'
import type { Session } from '@supabase/supabase-js'
import { EscritorioPixel } from './pixel/EscritorioPixel'
import { PainelAgente } from './ui/PainelAgente'
import { LinhaDoTempo } from './ui/LinhaDoTempo'
import { Login, TrocarSenha } from './ui/Login'
import { NovoPost } from './ui/NovoPost'
import { Aprovacao, RegrasPropostas } from './ui/Aprovacao'
import { Biblioteca } from './ui/Biblioteca'
import { PerfilDaMarca } from './ui/PerfilDaMarca'
import { PainelFinanceiro, type DadosFin } from './ui/PainelFinanceiro'
import { Logo } from './ui/Logo'
import { SuaMesa } from './ui/SuaMesa'
import { Gaveta } from './ui/Gaveta'
import { Calendario } from './ui/Calendario'
import { PainelGastos, dolar } from './ui/Gastos'
import { ConectarInstagram } from './ui/ConectarInstagram'
import { NovaSala } from './ui/NovaSala'
import { PostComErro } from './ui/PostComErro'
import { ListaDePosts } from './ui/ListaDePosts'
import { useEscritorio } from './store/escritorio'
import { rodarDemo, pararDemo } from './lib/simulacao'
import { modoDemo, supabase } from './lib/supabase'
import { chamarApi } from './lib/api'
import { type Marca, corDaMarca, salvarOrdemDasSalas, salvarSala, useAndar, useCustos, useMarcas, usePostAoVivo, usePosts, useQuadrosDoAndar, useRegrasPropostas } from './lib/dados'
import { RegrasDaMarca } from './ui/RegrasDaMarca'
import { ORDEM_ESTILOS, type Quadro, type SalaCustom } from './pixel/mapa'
import { PainelSala } from './ui/PainelSala'
import { Abertura } from './ui/Abertura'

const ROTULO_STATUS: Record<string, string> = {
  rascunho: 'rascunho',
  em_producao: 'em produção',
  aguardando_aprovacao: 'esperando você',
  aprovado: 'publicando',
  agendado: 'agendado',
  publicado: 'publicado',
  reprovado: 'reprovado',
  erro: 'com erro',
  guardado: 'na gaveta',
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

  if (carregando) return <Abertura />
  if (!modoDemo && !sessao) return <Login />
  return <Painel logado={!!sessao} />
}

function Painel({ logado }: { logado: boolean }) {
  const aplicar = useEscritorio((s) => s.aplicar)
  const reiniciar = useEscritorio((s) => s.reiniciar)
  const selecionado = useEscritorio((s) => s.selecionado)
  const selecionar = useEscritorio((s) => s.selecionar)
  const foco = useEscritorio((s) => s.foco)
  const focar = useEscritorio((s) => s.focar)
  const definirAgenda = useEscritorio((s) => s.definirAgenda)
  const estados = useEscritorio((s) => s.estados)
  const eventos = useEscritorio((s) => s.eventos)

  const [versaoMarcas, setVersaoMarcas] = useState(0)
  const [novaSala, setNovaSala] = useState(false)
  // lista de posts na lateral: aberta por padrão no computador, lembrada entre visitas
  const [listaAberta, setListaAberta] = useState(() => {
    try {
      const salvo = localStorage.getItem('lista-posts')
      if (salvo) return salvo === '1'
    } catch {
      // sem armazenamento local
    }
    return !window.matchMedia('(max-width: 760px)').matches
  })
  const alternarLista = (v?: boolean) =>
    setListaAberta((atual) => {
      const novo = v ?? !atual
      try {
        localStorage.setItem('lista-posts', novo ? '1' : '0')
      } catch {
        // vale até recarregar
      }
      return novo
    })
  const marcasDoBanco = useMarcas(logado, versaoMarcas)
  const marcas = marcasDoBanco ?? []
  // logado, o escritório só aparece depois que as marcas chegam (antes piscava a sala de exemplo)
  const carregandoMarcas = logado && !!supabase && marcasDoBanco === null
  const [marcaId, setMarcaId] = useState<string | null>(null)
  const [postId, setPostId] = useState<string | null>(null)
  const [recarregar, setRecarregar] = useState(0)
  const [novo, setNovo] = useState(false)
  const [briefingInicial, setBriefingInicial] = useState<string | undefined>()
  const [trocarSenha, setTrocarSenha] = useState(false)
  const [biblioteca, setBiblioteca] = useState(false)
  const [perfilMarca, setPerfilMarca] = useState(false)
  // números do Financeiro: carregam ao entrar e de novo quando você abre a sala dele
  const [financeiro, setFinanceiro] = useState<DadosFin | null>(null)
  const [muralRegras, setMuralRegras] = useState(false)
  const [instagram, setInstagram] = useState(false)
  const [emDemo, setEmDemo] = useState(modoDemo)

  useEffect(() => {
    if (!marcaId && marcas[0]) setMarcaId(marcas[0].id)
  }, [marcas, marcaId])

  const { posts, carregado: postsCarregados } = usePosts(marcaId, recarregar)
  const post = usePostAoVivo(emDemo ? null : postId)
  const regras = useRegrasPropostas(marcaId, recarregar)
  const marca = marcas.find((m) => m.id === marcaId)
  const mudou = () => setRecarregar((n) => n + 1)
  const escolherMarca = (id: string) => {
    if (id === marcaId || !marcas.some((m) => m.id === id)) return
    setMarcaId(id)
    setPostId(null)
  }
  // o que o dono mexeu na decoração das salas nesta visita (aparece na hora, antes de voltar do banco)
  const [salasEditadas, setSalasEditadas] = useState<Record<string, { sala: SalaCustom; cor: string }>>({})
  const [estadoSala, setEstadoSala] = useState<'salvo' | 'salvando' | 'erro' | 'local' | null>(null)
  const salvarSalaDepois = useRef<number | undefined>(undefined)
  const comEdicao = <T extends { id: string; cor: string }>(m: T, sala?: SalaCustom | null) =>
    salasEditadas[m.id] ? { ...m, cor: salasEditadas[m.id].cor, sala: salasEditadas[m.id].sala } : { ...m, sala }
  // na demonstração (sem conta) o andar mostra a Drinfy e uma sala de exemplo
  // ordem das salas no andar: a que você arrastou na barra; sem isso, a mais nova fica na ponta, longe da sua sala
  const [ordemSalas, setOrdemSalas] = useState<string[] | null>(null)
  const posicaoDe = (m: Marca, ordem: number) =>
    ordemSalas?.includes(m.id) ? ordemSalas.indexOf(m.id) : typeof m.identidade?.posicao === 'number' ? (m.identidade.posicao as number) : -1000 - ordem
  const marcasNoAndar = marcas.length
    ? marcas
        .map((m, ordem) => ({ m, ordem, pos: posicaoDe(m, ordem) }))
        .sort((a, b) => a.pos - b.pos)
        .map(({ m, ordem }) => comEdicao({ id: m.id, nome: m.nome, cor: corDaMarca(m), ordem }, m.identidade?.sala as SalaCustom | undefined))
    : [comEdicao({ id: 'demo', nome: 'Drinfy', cor: '#EE382B', ordem: 0 }), comEdicao({ id: 'demo-2', nome: 'Outra marca', cor: '#2f6f73', ordem: 1 })].sort(
        (a, b) => (ordemSalas?.indexOf(a.id) ?? 0) - (ordemSalas?.indexOf(b.id) ?? 0),
      )
  const salaAtiva = marcasNoAndar.find((m) => m.id === (marcaId ?? marcasNoAndar[0]?.id)) ?? marcasNoAndar[0]
  // estilo da sala quando ninguém escolheu: o que ficou neste navegador, senão o da ordem de criação
  const estiloPadrao = (id: string, ordem: number) => {
    try {
      const antigo = (JSON.parse(localStorage.getItem('estilos-pixel') ?? '{}') as Record<string, string>)[id]
      if (antigo) return antigo
    } catch {
      // sem armazenamento local
    }
    return ORDEM_ESTILOS[ordem % ORDEM_ESTILOS.length]
  }
  const mudarSala = (id: string, sala: SalaCustom, cor: string) => {
    setSalasEditadas((x) => ({ ...x, [id]: { sala, cor } }))
    if (!logado || !marcas.some((m) => m.id === id)) return setEstadoSala('local')
    setEstadoSala('salvando')
    window.clearTimeout(salvarSalaDepois.current)
    salvarSalaDepois.current = window.setTimeout(() => {
      salvarSala(id, sala as Record<string, unknown>, cor)
        .then(() => setEstadoSala('salvo'))
        .catch((e) => {
          console.error('não salvou a sala', e)
          setEstadoSala('erro')
        })
    }, 600)
  }
  // o andar inteiro ao vivo: cada sala com o próprio post e tudo que espera você, de todas as marcas
  const andar = useAndar(logado && !emDemo ? marcas.map((m) => m.id) : [], recarregar)
  const quadrosDoBanco = useQuadrosDoAndar(logado ? marcas.map((m) => m.id) : [], recarregar)
  const quadrosDemo = useMemo(() => ({ demo: { dias: agendaDemo().filter((a) => new Date(a.data).getMonth() === new Date().getMonth()).map((a) => new Date(a.data).getDate()), regras: 4, referencias: 5, gaveta: 2 } }), [])
  // quantos posts guardados em cada gaveta (a cômoda abre quando tem algum)
  const quadros = useMemo(() => {
    if (!marcas.length) return quadrosDemo
    const x: Record<string, { dias: number[]; regras: number; referencias?: number; gaveta?: number }> = { ...quadrosDoBanco }
    for (const [id, lista] of Object.entries(andar.gaveta)) x[id] = { ...(x[id] ?? { dias: [], regras: 0 }), gaveta: lista.length }
    return x
  }, [marcas.length, quadrosDoBanco, quadrosDemo, andar.gaveta])
  // quadros da parede: referências, calendário, branding e mural de regras abrem para a marca daquela sala
  const abrirQuadro = (id: string, quadro: Quadro) => {
    escolherMarca(id)
    if (quadro === 'calendario') {
      calendarioDaSala.current = id
      return focar('calendario')
    }
    if (!logado || !marcas.some((m) => m.id === id)) return
    if (quadro === 'branding') setPerfilMarca(true)
    else if (quadro === 'referencias') setBiblioteca(true)
    else setMuralRegras(true)
  }
  useEffect(() => {
    // só escolhe um post da marca aberta (a lista pode ainda ser da marca anterior)
    if (!postId && posts[0]?.marca_id === marcaId && !emDemo) setPostId(posts[0].id)
  }, [posts, postId, emDemo, marcaId])

  // quando o status do post muda, atualiza a lista
  useEffect(() => {
    if (post) mudou()
  }, [post?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // o calendário da sua sala é geral: tudo que tem data em todas as marcas (agendados pela data marcada,
  // publicados pela data em que saíram); o calendário da parede de cada sala abre só com a marca dela
  const geral = logado && !emDemo && marcas.length > 0
  const fontes = geral ? andar.comData : posts
  useLayoutEffect(() => {
    if (emDemo && posts.length === 0) return definirAgenda(agendaDemo())
    definirAgenda(
      fontes.flatMap((p) => {
        // agendado que deu erro na hora de publicar aparece como "falhou" no dia marcado
        const falhou = p.status === 'erro' && !!p.agendado_para
        const data = p.status === 'agendado' || falhou ? p.agendado_para : p.status === 'publicado' ? p.publicado_em : null
        const slides = [...(p.slides ?? [])].sort((a, b) => a.ordem - b.ordem).map((x) => x.url)
        const status = falhou ? 'falhou' : (p.status as 'agendado' | 'publicado')
        const m = marcasNoAndar.find((x) => x.id === p.marca_id)
        return data ? [{ id: p.id, data, titulo: p.briefing, status, slides, legenda: p.legenda, marcaId: p.marca_id, marca: m?.nome, cor: m?.cor }] : []
      }),
    )
  }, [fontes, emDemo, definirAgenda]) // eslint-disable-line react-hooks/exhaustive-deps
  // qual calendário abriu: o da parede de uma sala (só aquela marca) ou o geral (sua sala e o botão do topo)
  const calendarioDaSala = useRef<string | null>(null)
  const [calendarioDe, setCalendarioDe] = useState<string | null>(null)
  useEffect(() => {
    if (foco !== 'calendario') return
    setCalendarioDe(calendarioDaSala.current)
    calendarioDaSala.current = null
  }, [foco])

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
    // depois do escritório limpar o post que estava aberto
    window.setTimeout(() => rodarDemo(aplicar), 50)
  }

  const verPost = (id: string) => {
    pararDemo()
    setEmDemo(false)
    setPostId(id)
  }

  const esperando = !emDemo && post?.status === 'aguardando_aprovacao'
  // o post pronto não abre o painel sozinho: você pula na sua mesa e toca um aviso; o painel abre clicando nela
  const definirPostEsperandoVoce = useEscritorio((s) => s.definirPostEsperandoVoce)
  // na sua mesa: tudo que espera você em qualquer sala; com mais de um, a mesa mostra a lista para você escolher
  const naSuaMesa = emDemo ? [] : andar.naSuaMesa.length ? andar.naSuaMesa : posts.filter((p) => p.status === 'aguardando_aprovacao' || p.status === 'erro')
  const [escolhido, setEscolhido] = useState<string | null>(null)
  useEffect(() => {
    if (foco !== 'voce') setEscolhido(null)
  }, [foco])
  const direto = naSuaMesa.length <= 1 || escolhido === post?.id
  const algoNaMesa = esperando || naSuaMesa.length > 0
  useEffect(() => definirPostEsperandoVoce(emDemo ? null : algoNaMesa), [emDemo, algoNaMesa, definirPostEsperandoVoce])
  const mostrarAprovacao = esperando && !selecionado && foco === 'voce' && direto
  const mostrarErro = !emDemo && post?.status === 'erro' && !selecionado && foco === 'voce' && direto
  const abrirDaMesa = (p: { id: string; marca_id: string }) => {
    pararDemo()
    setEmDemo(false)
    if (p.marca_id !== marcaId) setMarcaId(p.marca_id)
    setPostId(p.id)
    setEscolhido(p.id)
    focar('voce')
  }
  const voltarParaMesa = () => (naSuaMesa.length > 1 ? setEscolhido(null) : focar(null))
  const custos = useCustos(emDemo ? null : marcaId, emDemo ? null : (post?.id ?? null), post ? Number(post.custo_usd) : undefined, post?.status)
  useEffect(() => {
    if (!logado || emDemo || !supabase) return
    if (foco !== 'financeiro' && financeiro) return
    chamarApi<DadosFin>('financeiro', { acao: 'ver' }).then(setFinanceiro).catch(() => {})
  }, [logado, emDemo, foco]) // eslint-disable-line react-hooks/exhaustive-deps
  const resumoFin = useMemo(() => {
    if (!financeiro?.numeros) return undefined
    const alertas = financeiro.ultima?.analise.alertas ?? []
    return {
      barras: financeiro.numeros.por_dia.slice(-14).map((d) => d.custo),
      dicas: alertas.length,
      alerta: alertas.some((x) => x.gravidade === 'alta'),
    }
  }, [financeiro])
  // gasto do mês embaixo do cofrinho de cada sala (a aberta usa o número ao vivo do post aberto)
  const cofres = useMemo(() => {
    if (emDemo || !logado) return undefined
    const x: Record<string, string> = Object.fromEntries(Object.entries(andar.mes).map(([id, v]) => [id, `${dolar(v)} no mês`]))
    if (marcaId && custos) x[marcaId] = `${dolar(custos.mes)} no mês`
    return x
  }, [andar.mes, custos, marcaId, emDemo, logado])

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          <button className="icone alternar-lista" onClick={() => alternarLista()} aria-expanded={listaAberta} aria-label={listaAberta ? 'Recolher lista de posts' : 'Abrir lista de posts'} title={listaAberta ? 'Recolher posts' : 'Abrir posts'}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <rect x="2" y="3" width="14" height="12" rx="2.5" />
              <path d="M7 3v12" />
              <path className="alternar-seta" d="M11.5 7 10 9l1.5 2" />
            </svg>
          </button>
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
            {marcaId && <button onClick={() => setPerfilMarca(true)}>Editar marca</button>}
            {marcaId && <button onClick={() => setBiblioteca(true)}>Referências</button>}
            <button onClick={() => setNovaSala(true)}>+ Nova sala</button>
          </Popover>
          {emDemo ? (
            <span className="chip chip-demo">demonstração</span>
          ) : (
            post && <span className={`chip status-${post.status}`}>{ROTULO_STATUS[post.status] ?? post.status}</span>
          )}
        </div>
        <div className="topo-acoes">
          {logado && marcaId && <button className="primario so-lista-fechada" data-lista={listaAberta ? 'aberta' : 'fechada'} onClick={() => setNovo(true)}>Novo<span className="so-largo"> post</span></button>}
          <Menu>
            {logado && marca && (
              <button onClick={() => setInstagram(true)}>{marca.instagram_conta_id ? 'Instagram conectado' : 'Conectar Instagram'}</button>
            )}
            <button onClick={demo}>Ver demonstração</button>
            {logado && <hr />}
            {logado && <button onClick={() => setTrocarSenha(true)}>Trocar senha</button>}
            {logado && <button onClick={() => supabase?.auth.signOut()}>Sair</button>}
          </Menu>
        </div>
      </header>

      <div className="corpo">
      <ListaDePosts
        posts={posts}
        postId={postId}
        emDemo={emDemo}
        aberta={listaAberta}
        aoEscolher={(id) => {
          verPost(id)
          if (window.matchMedia('(max-width: 760px)').matches) alternarLista(false)
        }}
        aoNovo={logado && marcaId ? () => setNovo(true) : undefined}
        aoFechar={() => alternarLista(false)}
        aoAbrir={() => alternarLista(true)}
      />
      <main className="palco">
        <Etapa estados={estados} aguardando={!emDemo && post?.status === 'aguardando_aprovacao'} ativo={emDemo || post?.status === 'em_producao'} />
        <Suspense fallback={<Abertura noPalco frase="Montando o escritório…" />}>
          {carregandoMarcas ? (
            <Abertura noPalco frase="Montando o escritório…" />
          ) : (
            <EscritorioPixel
              marcas={marcasNoAndar}
              marcaAtiva={marcaId ?? marcas[0]?.id ?? marcasNoAndar[0]?.id ?? null}
              aoEscolherMarca={escolherMarca}
              quadros={quadros}
              aoAbrirQuadro={abrirQuadro}
              financeiro={resumoFin}
              cofres={cofres}
              aoReordenar={
                marcasNoAndar.length > 1
                  ? (ids) => {
                      setOrdemSalas(ids)
                      if (logado && marcas.length) salvarOrdemDasSalas(ids).catch((e) => console.error('não salvou a ordem das salas', e))
                    }
                  : undefined
              }
              porSala={andar.porSala}
              naSuaMesa={naSuaMesa.length}
              aoEditarSala={(id) => {
                escolherMarca(id)
                focar('sala')
              }}
            />
          )}
        </Suspense>
        {mostrarErro && post ? (
          <PostComErro post={post} aoMudar={mudou} aoFechar={voltarParaMesa} />
        ) : mostrarAprovacao && post ? (
          <Aprovacao
            post={post}
            regras={regras}
            aoMudar={mudou}
            aoFechar={voltarParaMesa}
          />
        ) : foco === 'financeiro' ? (
          <PainelFinanceiro
            dados={emDemo || !logado ? { numeros: null, ultima: null } : financeiro}
            aoAtualizar={setFinanceiro}
            aoFechar={() => focar(null)}
            aoAbrirPost={(id) => { verPost(id); focar(null) }}
          />
        ) : foco === 'sala' && salaAtiva ? (
          <PainelSala
            marcaNome={salaAtiva.nome}
            padrao={estiloPadrao(salaAtiva.id, salaAtiva.ordem ?? 0)}
            cor={salaAtiva.cor}
            sala={salaAtiva.sala ?? {}}
            estado={estadoSala}
            aoMudar={(sala, cor) => mudarSala(salaAtiva.id, sala, cor)}
            aoFechar={() => {
              focar(null)
              setEstadoSala(null)
            }}
          />
        ) : foco === 'gaveta' ? (
          <Gaveta
            posts={marcaId ? andar.gaveta[marcaId] ?? [] : []}
            marcaNome={marca?.nome}
            emDemo={emDemo || !logado}
            aoMudar={mudou}
            aoUsar={abrirDaMesa}
            aoFechar={() => focar(null)}
          />
        ) : foco === 'cofre' ? (
          <PainelGastos
            custos={emDemo ? null : custos}
            marcaNome={marca?.nome}
            emProducao={post?.status === 'em_producao'}
            aoFechar={() => focar(null)}
            aoAbrirFinanceiro={logado && !emDemo ? () => focar('financeiro') : undefined}
          />
        ) : foco === 'voce' ? (
          <SuaMesa pendentes={naSuaMesa} marcas={marcasNoAndar} emDemo={emDemo} aoAbrirPost={abrirDaMesa} />
        ) : (
          <PainelAgente
            post={emDemo ? null : post}
            porAgente={custos?.porAgente}
            aoMudar={mudou}
            marcaId={logado ? marcaId : null}
            aoUsarIdeia={(b) => {
              selecionar(null)
              setBriefingInicial(b)
              setNovo(true)
            }}
          />
        )}
        {logado && marcas.length === 0 && (
          <div className="vazio">
            <h2>Nenhuma marca ainda</h2>
            <p className="muted">Peça no chat para cadastrar uma marca.</p>
          </div>
        )}
        {!mostrarAprovacao && !mostrarErro && !selecionado && !foco && !novo && !biblioteca && !instagram && !novaSala && !trocarSenha && regras.length > 0 && !emDemo && (
          <aside className="painel painel-regras" aria-label="Regras propostas">
            <RegrasPropostas regras={regras} aoMudar={mudou} />
          </aside>
        )}
      </main>
      </div>

      <footer className="rodape">
        <LinhaDoTempo />
      </footer>

      {foco === 'calendario' && (
        <Calendario
          aoAbrirPost={verPost}
          aoMudar={mudou}
          marcaId={calendarioDe}
          marcaNome={calendarioDe ? marcasNoAndar.find((m) => m.id === calendarioDe)?.nome : undefined}
          carregando={!emDemo && logado && (geral ? !andar.carregado : !postsCarregados)}
        />
      )}
      {biblioteca && marcaId && <Biblioteca marcaId={marcaId} marcaNome={marca?.nome} marcaCor={marca ? corDaMarca(marca) : undefined} aoFechar={() => setBiblioteca(false)} />}
      {muralRegras && marcaId && <RegrasDaMarca marcaId={marcaId} nomeMarca={marca?.nome ?? ''} aoFechar={() => setMuralRegras(false)} aoMudar={mudou} />}
      {perfilMarca && marcaId && <PerfilDaMarca marcaId={marcaId} aoFechar={() => setPerfilMarca(false)} aoSalvar={() => setVersaoMarcas((v) => v + 1)} />}
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
          marcaNome={marca?.nome}
          marcaCor={marca ? corDaMarca(marca) : undefined}
          neutra={!!marca?.identidade?.neutra}
          inicial={briefingInicial}
          aoFechar={() => { setNovo(false); setBriefingInicial(undefined) }}
          aoCriar={(p) => {
            setNovo(false)
            setBriefingInicial(undefined)
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
