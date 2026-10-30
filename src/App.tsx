import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { avisoDoToken } from './lib/token'
import type { Session } from '@supabase/supabase-js'
import { EscritorioPixel } from './pixel/EscritorioPixel'
import { PainelAgente } from './ui/PainelAgente'
import { LinhaDoTempo } from './ui/LinhaDoTempo'
import { Login, TrocarSenha } from './ui/Login'
import { NovoPost } from './ui/NovoPost'
import { Aprovacao, RegrasPropostas } from './ui/Aprovacao'
import { AprovarTexto } from './ui/AprovarTexto'
import { Biblioteca } from './ui/Biblioteca'
import { PerfilDaMarca } from './ui/PerfilDaMarca'
import { PainelFinanceiro, type DadosFin } from './ui/PainelFinanceiro'
import { SuaMesa } from './ui/SuaMesa'
import { Gaveta } from './ui/Gaveta'
import { Calendario } from './ui/Calendario'
import { PainelGastos } from './ui/Gastos'
import { dolar } from './lib/formato'
import { ConectarInstagram } from './ui/ConectarInstagram'
import { NovaSala } from './ui/NovaSala'
import { PostComErro } from './ui/PostComErro'
import { ListaDePosts } from './ui/ListaDePosts'
import { PreviaAoVivo } from './ui/PreviaAoVivo'
import { useEscritorio } from './store/escritorio'
import { supabase } from './lib/supabase'
import { chamarApi } from './lib/api'
import { ESPERANDO_VOCE, type Marca, corDaMarca, salvarOrdemDasSalas, salvarSala, useAndar, useCustos, useMarcas, usePostAoVivo, usePosts, useQuadrosDoAndar, useRegrasPropostas } from './lib/dados'
import { RegrasDaMarca } from './ui/RegrasDaMarca'
import { Menu } from './ui/Menu'
import { Etapa } from './ui/Etapa'
import { ORDEM_ESTILOS, type Quadro, type SalaCustom } from './pixel/mapa'
import type { Ideia } from './lib/ideias'
import { PainelSala } from './ui/PainelSala'
import { Abertura } from './ui/Abertura'

export default function App() {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(!!supabase)

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
  if (!sessao) return <Login />
  return <Painel />
}

function Painel() {
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
  const marcasDoBanco = useMarcas(true, versaoMarcas)
  const marcas = useMemo(() => marcasDoBanco ?? [], [marcasDoBanco])
  // o escritório só aparece depois que as marcas chegam (antes piscava vazio)
  const carregandoMarcas = marcasDoBanco === null
  const [marcaId, setMarcaId] = useState<string | null>(null)
  const [postId, setPostId] = useState<string | null>(null)
  const [recarregar, setRecarregar] = useState(0)
  const [novo, setNovo] = useState(false)
  // ideia do pesquisador que abre o Novo post já preenchido (e qual ideia guardada era, para sair da lista ao criar)
  const [ideiaInicial, setIdeiaInicial] = useState<{ ideia: Ideia; guardadaId?: string; quando?: Date } | undefined>()
  const [trocarSenha, setTrocarSenha] = useState(false)
  const [biblioteca, setBiblioteca] = useState(false)
  const [perfilMarca, setPerfilMarca] = useState(false)
  // números do Financeiro: carregam ao entrar e de novo quando você abre a sala dele
  const [financeiro, setFinanceiro] = useState<DadosFin | null>(null)
  const [muralRegras, setMuralRegras] = useState(false)
  const [instagram, setInstagram] = useState(false)

  useEffect(() => {
    if (!marcaId && marcas[0]) setMarcaId(marcas[0].id)
  }, [marcas, marcaId])

  const { posts, carregado: postsCarregados } = usePosts(marcaId, recarregar)
  const post = usePostAoVivo(postId)
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
  // ordem das salas no andar: a que você arrastou na barra; sem isso, a mais nova fica na ponta, longe da sua sala
  const [ordemSalas, setOrdemSalas] = useState<string[] | null>(null)
  const posicaoDe = (m: Marca, ordem: number) =>
    ordemSalas?.includes(m.id) ? ordemSalas.indexOf(m.id) : typeof m.identidade?.posicao === 'number' ? (m.identidade.posicao as number) : -1000 - ordem
  const marcasNoAndar = marcas
    .map((m, ordem) => ({ m, ordem, pos: posicaoDe(m, ordem) }))
    .sort((a, b) => a.pos - b.pos)
    .map(({ m, ordem }) => comEdicao({ id: m.id, nome: m.nome, cor: corDaMarca(m), ordem, instagram: !!m.instagram_conta_id, instagramAviso: avisoDoToken(m.identidade, !!m.instagram_conta_id) }, m.identidade?.sala as SalaCustom | undefined))
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
    if (!marcas.some((m) => m.id === id)) return setEstadoSala('local')
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
  const marcaIds = useMemo(() => marcas.map((m) => m.id), [marcas])
  const andar = useAndar(marcaIds, recarregar)
  const quadrosDoBanco = useQuadrosDoAndar(marcaIds, recarregar)
  // quantos posts guardados em cada gaveta (a cômoda abre quando tem algum)
  const quadros = useMemo(() => {
    const x: Record<string, { dias: number[]; regras: number; referencias?: number; gaveta?: number }> = { ...quadrosDoBanco }
    for (const [id, lista] of Object.entries(andar.gaveta)) x[id] = { ...(x[id] ?? { dias: [], regras: 0 }), gaveta: lista.length }
    return x
  }, [quadrosDoBanco, andar.gaveta])
  // quadros da parede: referências, calendário, branding e mural de regras abrem para a marca daquela sala
  const abrirQuadro = (id: string, quadro: Quadro) => {
    escolherMarca(id)
    if (quadro === 'calendario') {
      calendarioDaSala.current = id
      return focar('calendario')
    }
    if (!marcas.some((m) => m.id === id)) return
    if (quadro === 'branding') setPerfilMarca(true)
    else if (quadro === 'referencias') setBiblioteca(true)
    else setMuralRegras(true)
  }
  useEffect(() => {
    // só escolhe um post da marca aberta (a lista pode ainda ser da marca anterior)
    if (!postId && posts[0]?.marca_id === marcaId) setPostId(posts[0].id)
  }, [posts, postId, marcaId])

  // quando o status do post muda, atualiza a lista
  useEffect(() => {
    if (post) mudou()
  }, [post?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // o calendário da sua sala é geral: tudo que tem data em todas as marcas (agendados pela data marcada,
  // publicados pela data em que saíram); o calendário da parede de cada sala abre só com a marca dela
  const geral = marcas.length > 0
  const fontes = geral ? andar.comData : posts
  useLayoutEffect(() => {
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
  }, [fontes, definirAgenda]) // eslint-disable-line react-hooks/exhaustive-deps
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
    if (!post || !['em_producao', 'aprovado'].includes(post.status)) return
    const id = window.setInterval(() => {
      const desde = Date.now() - new Date(ultimoEvento ?? post.criado_em).getTime()
      if (desde < 45_000 || cutucando.current) return
      cutucando.current = true
      chamarApi('acordar', { post_id: post.id })
        .catch((e) => console.error('não consegui retomar o post', e))
        .finally(() => (cutucando.current = false))
    }, 15_000)
    return () => window.clearInterval(id)
  }, [post, ultimoEvento])

  // Esc fecha o que estiver aberto no palco (painel de agente, sua mesa, gaveta, cofre, calendário);
  // os modais e o visualizador de slides cuidam do próprio Esc
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (document.querySelector('.ver-slides, .modal-fundo')) return
      if (selecionado) selecionar(null)
      else if (foco) focar(null)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [selecionado, foco, selecionar, focar])

  const verPost = (id: string) => setPostId(id)

  const esperando = post?.status === 'aguardando_aprovacao'
  const textoEsperando = post?.status === 'aguardando_texto'
  // o post pronto não abre o painel sozinho: você pula na sua mesa e toca um aviso; o painel abre clicando nela
  const definirPostEsperandoVoce = useEscritorio((s) => s.definirPostEsperandoVoce)
  // na sua mesa: tudo que espera você em qualquer sala; com mais de um, a mesa mostra a lista para você escolher
  const naSuaMesa = andar.naSuaMesa.length ? andar.naSuaMesa : posts.filter((p) => ESPERANDO_VOCE.includes(p.status))
  const [escolhido, setEscolhido] = useState<string | null>(null)
  useEffect(() => {
    if (foco !== 'voce') setEscolhido(null)
  }, [foco])
  const direto = naSuaMesa.length <= 1 || escolhido === post?.id
  const algoNaMesa = esperando || textoEsperando || naSuaMesa.length > 0
  useEffect(() => definirPostEsperandoVoce(algoNaMesa), [algoNaMesa, definirPostEsperandoVoce])
  const mostrarAprovacao = esperando && !selecionado && foco === 'voce' && direto
  const mostrarErro = post?.status === 'erro' && !selecionado && foco === 'voce' && direto
  const mostrarTexto = textoEsperando && !selecionado && foco === 'voce' && direto
  const abrirDaMesa = (p: { id: string; marca_id: string }) => {
    if (p.marca_id !== marcaId) setMarcaId(p.marca_id)
    setPostId(p.id)
    setEscolhido(p.id)
    focar('voce')
  }
  const voltarParaMesa = () => (naSuaMesa.length > 1 ? setEscolhido(null) : focar(null))
  const custos = useCustos(marcaId, post?.id ?? null, post ? Number(post.custo_usd) : undefined, post?.status)
  useEffect(() => {
    if (foco !== 'financeiro' && financeiro) return
    chamarApi<DadosFin>('financeiro', { acao: 'ver' }).then(setFinanceiro).catch(() => {})
  }, [foco]) // eslint-disable-line react-hooks/exhaustive-deps
  const resumoFin = useMemo(() => {
    if (!financeiro?.numeros) return undefined
    const alertas = financeiro.ultima?.analise.alertas ?? []
    return {
      barras: financeiro.numeros.por_dia.slice(-14).map((d) => d.custo),
      alerta: alertas.some((x) => x.gravidade === 'alta'),
    }
  }, [financeiro])
  // gasto do mês embaixo do cofrinho de cada sala (a aberta usa o número ao vivo do post aberto)
  const cofres = useMemo(() => {
    const x: Record<string, string> = Object.fromEntries(Object.entries(andar.mes).map(([id, v]) => [id, `${dolar(v)} no mês`]))
    if (marcaId && custos) x[marcaId] = `${dolar(custos.mes)} no mês`
    return x
  }, [andar.mes, custos, marcaId])

  return (
    <div className="app">

      <div className="corpo">
      <ListaDePosts
        posts={posts}
        postId={postId}
        aberta={listaAberta}
        aoEscolher={(id) => {
          verPost(id)
          // post em produção abre direto a prévia: dá para ver como está ficando sem esperar chegar na sua mesa
          const escolhido = posts.find((p) => p.id === id)
          if (escolhido && ['em_producao', 'aprovado'].includes(escolhido.status)) focar('previa')
          else if (foco === 'previa') focar(null)
          if (window.matchMedia('(max-width: 760px)').matches) alternarLista(false)
        }}
        aoNovo={marcaId ? () => setNovo(true) : undefined}
        aoFechar={() => alternarLista(false)}
        aoAbrir={() => alternarLista(true)}
      />
      <main className="palco">
        <div className="palco-menu">
          <Menu>
            <button onClick={() => setNovaSala(true)}>+ Nova sala</button>
            <hr />
            <button onClick={() => setTrocarSenha(true)}>Trocar senha</button>
            <button onClick={() => supabase?.auth.signOut()}>Sair</button>
          </Menu>
        </div>
        <Etapa estados={estados} aguardando={esperando || textoEsperando} ativo={post?.status === 'em_producao'} aoAbrir={post ? () => focar('previa') : undefined} />
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
                      if (marcas.length) salvarOrdemDasSalas(ids).catch((e) => console.error('não salvou a ordem das salas', e))
                    }
                  : undefined
              }
              porSala={andar.porSala}
              naSuaMesa={naSuaMesa.length}
              aoEditarSala={(id) => {
                escolherMarca(id)
                focar('sala')
              }}
              aoNovoPost={(id) => {
                escolherMarca(id)
                focar(null)
                setNovo(true)
              }}
              aoConectarInstagram={(id) => {
                escolherMarca(id)
                focar(null)
                setInstagram(true)
              }}
            />
          )}
        </Suspense>
        {mostrarErro && post ? (
          <PostComErro post={post} aoMudar={mudou} aoFechar={voltarParaMesa} />
        ) : mostrarTexto && post ? (
          <AprovarTexto post={post} aoMudar={mudou} aoFechar={voltarParaMesa} />
        ) : mostrarAprovacao && post ? (
          <Aprovacao
            post={post}
            regras={regras}
            aoMudar={mudou}
            aoFechar={voltarParaMesa}
          />
        ) : foco === 'financeiro' ? (
          <PainelFinanceiro
            dados={financeiro}
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
            aoMudar={mudou}
            aoUsar={abrirDaMesa}
            aoFechar={() => focar(null)}
          />
        ) : foco === 'cofre' ? (
          <PainelGastos
            custos={custos}
            marcaNome={marca?.nome}
            emProducao={post?.status === 'em_producao'}
            aoFechar={() => focar(null)}
            aoAbrirFinanceiro={() => focar('financeiro')}
          />
        ) : foco === 'previa' && post ? (
          <PreviaAoVivo post={post} aoFechar={() => focar(null)} aoAbrirMesa={() => abrirDaMesa(post)} />
        ) : foco === 'voce' ? (
          <SuaMesa pendentes={naSuaMesa} marcas={marcasNoAndar} aoAbrirPost={abrirDaMesa} />
        ) : (
          <PainelAgente
            post={post}
            aoVerPrevia={post ? () => focar('previa') : undefined}
            porAgente={custos?.porAgente}
            aoMudar={mudou}
            marcaId={marcaId}
            aoUsarIdeia={(ideia, guardadaId) => {
              selecionar(null)
              setIdeiaInicial({ ideia, guardadaId })
              setNovo(true)
            }}
          />
        )}
        {marcas.length === 0 && (
          <div className="vazio">
            <h2>Nenhuma marca ainda</h2>
            <p className="muted">Peça no chat para cadastrar uma marca.</p>
          </div>
        )}
        {!mostrarAprovacao && !mostrarErro && !mostrarTexto && !selecionado && !foco && !novo && !biblioteca && !instagram && !novaSala && !trocarSenha && regras.length > 0 && (
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
          carregando={geral ? !andar.carregado : !postsCarregados}
          aoPlanejar={
            calendarioDe
              ? (ideia, quando) => {
                  escolherMarca(calendarioDe)
                  selecionar(null)
                  setIdeiaInicial({ ideia, quando })
                  setNovo(true)
                }
              : undefined
          }
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
      {instagram && marca && <ConectarInstagram marca={marca} aoFechar={() => setInstagram(false)} aoConectar={() => setVersaoMarcas((v) => v + 1)} />}
      {trocarSenha && <TrocarSenha aoFechar={() => setTrocarSenha(false)} />}
      {novo && marcaId && (
        <NovoPost
          marcaId={marcaId}
          marcaNome={marca?.nome}
          marcaCor={marca ? corDaMarca(marca) : undefined}
          neutra={!!marca?.identidade?.neutra}
          inicial={ideiaInicial?.ideia}
          ideiaGuardadaId={ideiaInicial?.guardadaId}
          agendarPara={ideiaInicial?.quando}
          aoFechar={() => { setNovo(false); setIdeiaInicial(undefined) }}
          aoCriar={(p) => {
            setNovo(false)
            setIdeiaInicial(undefined)
            mudou()
            verPost(p.id)
          }}
        />
      )}
    </div>
  )
}
