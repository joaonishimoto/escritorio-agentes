import { useEffect, useState, type ClipboardEvent, type DragEvent, type FormEvent, type ReactNode } from 'react'
import { chamarApi, lerApi } from '../lib/api'
import { useIdeiasGuardadas, type Ideia } from '../lib/ideias'
import { CHAVE_DO_SERVICO, FUNCIONARIOS_IA, nomeDaIA, opcoesDe, type Servicos, padraoDe } from '../lib/ias'
import { supabase } from '../lib/supabase'
import { ESTRUTURAS, LAYOUTS, VOZES, nomeDe } from '../lib/estilos'
import type { Post } from '../lib/dados'

type Ref = { tipo: 'imagem'; url: string } | { tipo: 'link'; url: string }
type Formato = '' | 'carrossel' | 'foto' | 'reel'

const FORMATOS: { id: Formato; nome: string; desc: string }[] = [
  { id: '', nome: 'A equipe decide', desc: 'Escolhe pelo pedido' },
  { id: 'carrossel', nome: 'Carrossel', desc: '2 a 10 slides' },
  { id: 'foto', nome: 'Foto', desc: 'Uma imagem só' },
  { id: 'reel', nome: 'Reel', desc: 'Vídeo curto com IA' },
]

const PONTOS_DE_PARTIDA = [
  { nome: 'Dica rápida', texto: 'Uma dica rápida e prática sobre ' },
  { nome: 'Passo a passo', texto: 'Um passo a passo de como ' },
  { nome: 'Curiosidade', texto: 'Uma curiosidade pouco conhecida sobre ' },
  { nome: 'Erro comum', texto: 'O erro que quase todo mundo comete com ' },
  { nome: 'Novidade', texto: 'Anunciar a novidade: ' },
  { nome: 'Data especial', texto: 'Post para a data: ' },
]

const QUANTIDADES = [0, 3, 4, 5, 6, 7, 8, 10]

/** Data no formato do campo datetime-local, no fuso do navegador. */
function paraCampo(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function amanhaAs19() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(19, 0, 0, 0)
  return paraCampo(d)
}

/** Ícone pequeno de cada formato, desenhado em SVG. */
function IconeFormato({ id }: { id: Formato }) {
  const props = { width: 22, height: 22, viewBox: '0 0 22 22', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true }
  if (id === 'carrossel')
    return (
      <svg {...props}>
        <rect x="5" y="4" width="10" height="14" rx="2" />
        <path d="M17.5 6v10M2.5 6v10" />
      </svg>
    )
  if (id === 'foto')
    return (
      <svg {...props}>
        <rect x="3.5" y="4" width="15" height="14" rx="2" />
        <circle cx="8.5" cy="9" r="1.6" />
        <path d="m4 16 4.5-4 3 3 2.5-2 4 3.5" />
      </svg>
    )
  if (id === 'reel')
    return (
      <svg {...props}>
        <rect x="5" y="2.5" width="12" height="17" rx="2.5" />
        <path d="m9.5 8 4 3-4 3z" fill="currentColor" stroke="none" />
      </svg>
    )
  return (
    <svg {...props}>
      <path d="M11 3.5v3M11 15.5v3M3.5 11h3M15.5 11h3M5.7 5.7l2.1 2.1M14.2 14.2l2.1 2.1M5.7 16.3l2.1-2.1M14.2 7.8l2.1-2.1" />
    </svg>
  )
}

function Secao({ numero, titulo, extra, children }: { numero: number; titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="np-secao">
      <header>
        <span className="np-numero">{numero}</span>
        <h3>{titulo}</h3>
        {extra && <span className="np-extra">{extra}</span>}
      </header>
      {children}
    </section>
  )
}

/** Formato sugerido na ideia, no vocabulário do formulário. */
function formatoDaIdeia(i: Ideia): Formato {
  const f = i.formato.toLowerCase()
  if (f.includes('reel') || f.includes('vídeo')) return 'reel'
  if (f.includes('carrossel')) return 'carrossel'
  if (f.includes('foto')) return 'foto'
  return ''
}

export function NovoPost({
  marcaId,
  marcaNome,
  marcaCor,
  neutra,
  inicial,
  agendarPara,
  ideiaGuardadaId,
  aoCriar,
  aoFechar,
}: {
  marcaId: string
  marcaNome?: string
  marcaCor?: string
  neutra?: boolean
  /** o pedido já preenchido (vindo de uma ideia do pesquisador) e, se era uma ideia guardada, qual, para sair da lista quando o post for criado */
  inicial?: string | Ideia
  ideiaGuardadaId?: string
  /** vindo do "Planejar a semana": já marca para agendar neste horário */
  agendarPara?: Date
  aoCriar: (p: Post) => void
  aoFechar: () => void
}) {
  const [formato, setFormato] = useState<Formato>(typeof inicial === 'object' && inicial ? formatoDaIdeia(inicial) : '')
  const [slides, setSlides] = useState(0)
  const [briefing, setBriefing] = useState(typeof inicial === 'string' ? inicial : (inicial?.briefing ?? ''))
  // ideia guardada que virou este post: sai da lista quando o post é criado
  const [ideiaUsada, setIdeiaUsada] = useState<string | undefined>(ideiaGuardadaId)
  const guardadas = useIdeiasGuardadas(marcaId)
  const [refs, setRefs] = useState<Ref[]>([])
  const [link, setLink] = useState('')
  const [subindo, setSubindo] = useState(0)
  const [arrastando, setArrastando] = useState(false)
  const [estiloAberto, setEstiloAberto] = useState(false)
  const [estrutura, setEstrutura] = useState('')
  const [layout, setLayout] = useState('')
  const [voz, setVoz] = useState('')
  const [agendar, setAgendar] = useState(!!agendarPara)
  const [quando, setQuando] = useState(() => (agendarPara ? paraCampo(agendarPara) : amanhaAs19()))
  const [linha, setLinha] = useState('')
  const [ideias, setIdeias] = useState<Ideia[]>([])
  const [pensando, setPensando] = useState(false)
  const [ideiasAbertas, setIdeiasAbertas] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [iasAbertas, setIasAbertas] = useState(false)
  const [ias, setIas] = useState<Record<string, string>>({})
  const [servicos, setServicos] = useState<Servicos | null>(null)

  useEffect(() => {
    lerApi<{ servicos?: Servicos }>('posts').then((r) => setServicos(r.servicos ?? null)).catch(() => setServicos(null))
  }, [])

  const subir = async (arquivos: File[]) => {
    if (!supabase) return setErro('Entre na sua conta para mandar imagens')
    const imagens = arquivos.filter((f) => f.type.startsWith('image/')).slice(0, 12 - refs.length)
    setSubindo((n) => n + imagens.length)
    for (const f of imagens) {
      try {
        const nome = f.name.replace(/[^a-z0-9.]+/gi, '-').toLowerCase() || 'imagem.png'
        const caminho = `${marcaId}/referencias/${Date.now()}-${nome}`
        const { error } = await supabase.storage.from('marcas').upload(caminho, f, { contentType: f.type })
        if (error) throw error
        const url = supabase.storage.from('marcas').getPublicUrl(caminho).data.publicUrl
        setRefs((r) => [...r, { tipo: 'imagem', url }])
      } catch (e) {
        setErro(`Não subiu ${f.name}: ${e instanceof Error ? e.message : 'erro'}`)
      } finally {
        setSubindo((n) => n - 1)
      }
    }
  }

  const colar = (e: ClipboardEvent) => {
    const arquivos = Array.from(e.clipboardData.files)
    if (arquivos.length) {
      e.preventDefault()
      void subir(arquivos)
    }
  }
  const soltar = (e: DragEvent) => {
    e.preventDefault()
    setArrastando(false)
    void subir(Array.from(e.dataTransfer.files))
  }

  const addLink = () => {
    const u = link.trim()
    if (!/^https?:\/\//i.test(u)) return setErro('O link precisa começar com http:// ou https://')
    setRefs((r) => [...r, { tipo: 'link', url: u }])
    setLink('')
    setErro(null)
  }

  const pedirIdeias = async () => {
    setPensando(true)
    setErro(null)
    try {
      const r = await chamarApi<{ ideias: Ideia[] }>('ideias', { marca_id: marcaId, linha })
      setIdeias(r.ideias)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'O pesquisador não respondeu')
    } finally {
      setPensando(false)
    }
  }
  const usarIdeia = (i: Ideia, guardadaId?: string) => {
    setBriefing(i.briefing)
    const f = formatoDaIdeia(i)
    if (f) setFormato(f)
    setIdeiaUsada(guardadaId)
    setIdeiasAbertas(false)
    document.getElementById('np-pedido')?.focus()
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!briefing.trim()) return setErro('Escreva o que você quer postar')
    if (neutra && refs.length === 0) return setErro('Na sala neutra, mande pelo menos uma referência')
    if (agendar && new Date(quando).getTime() < Date.now()) return setErro('O horário para publicar já passou')
    setEnviando(true)
    setErro(null)
    try {
      const { post } = await chamarApi<{ post: Post }>('posts', {
        marca_id: marcaId,
        briefing,
        referencias: refs,
        preferencias: {
          formato: formato || undefined,
          slides: formato === 'carrossel' && slides ? slides : undefined,
          estrutura: estrutura || undefined,
          layout: formato === 'reel' ? undefined : layout || undefined,
          voz: voz || undefined,
          agendar_para: agendar ? new Date(quando).toISOString() : undefined,
          ias: Object.keys(iasDoPost).length ? iasDoPost : undefined,
        },
      })
      if (ideiaUsada) void guardadas.tirar(ideiaUsada)
      aoCriar(post)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não deu para criar o post')
      setEnviando(false)
    }
  }

  // o cinegrafista e o narrador só trabalham em Reel; num carrossel ou foto a escolha deles não vale
  const funcionarios = FUNCIONARIOS_IA.filter((f) => !f.video || formato === 'reel' || formato === '')
  const iasDoPost = Object.fromEntries(Object.entries(ias).filter(([a]) => funcionarios.some((f) => f.agente === a)))
  const resumoIas = Object.entries(iasDoPost).map(([a, id]) => `${FUNCIONARIOS_IA.find((f) => f.agente === a)?.nome}: ${nomeDaIA(id)}`)
  const semChave = (servico: keyof typeof CHAVE_DO_SERVICO) => servicos?.[servico] === false

  const escolhasDeEstilo = [nomeDe(ESTRUTURAS, estrutura), formato !== 'reel' ? nomeDe(LAYOUTS, layout) : undefined, nomeDe(VOZES, voz)].filter(Boolean)
  const resumoFormato = formato ? `${FORMATOS.find((f) => f.id === formato)!.nome}${formato === 'carrossel' && slides ? ` · ${slides} slides` : ''}` : 'A equipe decide'
  const quandoTexto = agendar
    ? new Date(quando).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Você escolhe ao aprovar'

  const painelIdeias = (
    <div className="np-ideias">
      <div className="np-ideias-topo">
        <span className="np-ideias-avatar" aria-hidden>P</span>
        <div>
          <strong>Sem ideia? Pergunte ao pesquisador</strong>
          <p>Dê uma linha e ele sugere posts no tom da marca.</p>
        </div>
      </div>
      <div className="np-ideias-busca">
        <input
          value={linha}
          onChange={(e) => setLinha(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void pedirIdeias() } }}
          placeholder="Ex.: dicas para o fim de semana"
          aria-label="Linha para as ideias"
        />
        <button type="button" className="secundario" disabled={pensando} onClick={pedirIdeias}>
          {pensando ? 'Pensando…' : ideias.length ? 'Outras' : 'Sugerir'}
        </button>
      </div>
      {pensando && !ideias.length && (
        <ul className="np-ideias-lista carregando">
          {[0, 1, 2].map((i) => <li key={i} />)}
        </ul>
      )}
      {ideias.length > 0 && (
        <ul className="np-ideias-lista">
          {ideias.map((i) => {
            const g = guardadas.guardada(i)
            return (
              <li key={i.titulo}>
                <button type="button" onClick={() => usarIdeia(i, g?.id)}>
                  <span className="np-ideia-formato">{i.formato}</span>
                  <strong>{i.titulo}</strong>
                  <span className="np-ideia-gancho">“{i.gancho}”</span>
                  <span className="np-ideia-usar">Usar esta ideia →</span>
                </button>
                <button type="button" className={`np-ideia-guardar${g ? ' guardada' : ''}`} onClick={() => (g ? guardadas.tirar(g.id) : guardadas.guardar(i))} aria-pressed={!!g} title={g ? 'Tirar das guardadas' : 'Guardar para depois'}>
                  {g ? 'Guardada ✓' : 'Guardar'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {guardadas.erro && <p className="aviso">{guardadas.erro}</p>}
      {guardadas.ideias.length > 0 && (
        <div className="np-guardadas">
          <strong>Guardadas para depois</strong>
          <ul className="np-ideias-lista">
            {guardadas.ideias.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => usarIdeia(i, i.id)}>
                  <span className="np-ideia-formato">{i.formato}</span>
                  <strong>{i.titulo}</strong>
                  <span className="np-ideia-gancho">“{i.gancho}”</span>
                  <span className="np-ideia-usar">Usar esta ideia →</span>
                </button>
                <button type="button" className="np-ideia-guardar" onClick={() => guardadas.tirar(i.id)} title="Tirar das guardadas">Tirar</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <form className="modal np" onSubmit={enviar} onClick={(e) => e.stopPropagation()} onPaste={colar} aria-label="Novo post">
        <header className="np-topo">
          <div>
            <h2>Novo post</h2>
            <p>
              <i className="ponto-marca" style={{ background: marcaCor ?? 'var(--primary)' }} /> {marcaNome ?? 'Marca'}
              {neutra && <span className="chip">sala neutra</span>}
            </p>
          </div>
          <button type="button" className="fechar" onClick={aoFechar} aria-label="Fechar">×</button>
        </header>

        <div className="np-corpo">
          <div className="np-principal">
            <Secao numero={1} titulo="O que você quer postar?">
              <button type="button" className="np-ideias-botao" onClick={() => setIdeiasAbertas(!ideiasAbertas)} aria-expanded={ideiasAbertas}>
                Sem ideia? Pedir sugestões ao pesquisador
              </button>
              {ideiasAbertas && <div className="np-ideias-movel">{painelIdeias}</div>}
              <textarea
                id="np-pedido"
                className="np-pedido"
                rows={5}
                autoFocus
                placeholder={neutra ? 'Ex.: carrossel no estilo dessas referências sobre…' : 'Ex.: carrossel sobre a história do Negroni, com a receita no final'}
                value={briefing}
                onChange={(e) => setBriefing(e.target.value)}
              />
              <div className="np-chips" aria-label="Pontos de partida">
                {PONTOS_DE_PARTIDA.map((p) => (
                  <button key={p.nome} type="button" onClick={() => { setBriefing((b) => (b.trim() ? `${b.trim()}\n${p.texto}` : p.texto)); document.getElementById('np-pedido')?.focus() }}>
                    {p.nome}
                  </button>
                ))}
              </div>
            </Secao>

            <Secao numero={2} titulo="Formato">
              <div className="np-formatos" role="radiogroup" aria-label="Formato">
                {FORMATOS.map((f) => (
                  <button key={f.id || 'auto'} type="button" role="radio" aria-checked={formato === f.id} className={formato === f.id ? 'ativo' : ''} onClick={() => setFormato(f.id)}>
                    <IconeFormato id={f.id} />
                    <strong>{f.nome}</strong>
                    <span>{f.desc}</span>
                  </button>
                ))}
              </div>
              {formato === 'carrossel' && (
                <div className="np-slides">
                  <span>Slides</span>
                  <div className="np-segmentos">
                    {QUANTIDADES.map((q) => (
                      <button key={q} type="button" className={slides === q ? 'ativo' : ''} onClick={() => setSlides(q)}>
                        {q || 'Auto'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {formato === 'reel' && (
                <p className="np-nota">
                  {ias.cinegrafista === 'claude'
                    ? 'O Claude faz uma animação com texto na tela, gravada no próprio app. A capa é um slide.'
                    : 'O vídeo é gerado por IA a partir de cenas, sem texto na tela. A capa é um slide.'}
                </p>
              )}
            </Secao>

            <Secao numero={3} titulo="Referências" extra={neutra ? 'obrigatório' : 'opcional'}>
              <label
                className={`np-soltar${arrastando ? ' ativo' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
                onDragLeave={() => setArrastando(false)}
                onDrop={soltar}
              >
                <input type="file" accept="image/*" multiple onChange={(e) => { void subir(Array.from(e.target.files ?? [])); e.target.value = '' }} />
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="M11 14V4M7 8l4-4 4 4M4 14v3a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 18 17v-3" />
                </svg>
                <span>{subindo ? `Subindo ${subindo} imagem${subindo > 1 ? 'ns' : ''}…` : 'Arraste imagens, clique para escolher ou cole com ⌘/Ctrl+V'}</span>
                <small>Estilos que você gostou, prints, fotos do produto</small>
              </label>
              {refs.length > 0 && (
                <ul className="np-refs">
                  {refs.map((r, i) => (
                    <li key={r.url} className={r.tipo}>
                      {r.tipo === 'imagem' ? <img src={r.url} alt={`Referência ${i + 1}`} /> : <a href={r.url} target="_blank" rel="noreferrer">{r.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 34)}</a>}
                      <button type="button" aria-label="Tirar referência" onClick={() => setRefs((x) => x.filter((_, n) => n !== i))}>×</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="np-link">
                <input
                  placeholder="Ou cole um link (post, site, Pinterest)"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
                  aria-label="Link de referência"
                />
                <button type="button" className="secundario" disabled={!link.trim()} onClick={addLink}>Adicionar</button>
              </div>
            </Secao>

            <Secao
              numero={4}
              titulo="Estilo"
              extra={
                <button type="button" className="link" onClick={() => setEstiloAberto(!estiloAberto)} aria-expanded={estiloAberto}>
                  {estiloAberto ? 'Fechar' : escolhasDeEstilo.length ? 'Editar' : 'Escolher'}
                </button>
              }
            >
              {!estiloAberto && (
                <p className="np-dica">
                  {escolhasDeEstilo.length ? escolhasDeEstilo.join(' · ') : 'A equipe varia estrutura, layout e voz sozinha, fugindo do que usou nos últimos posts.'}
                </p>
              )}
              {estiloAberto && (
                <div className="np-estilo">
                  <div>
                    <h4>Estrutura</h4>
                    <div className="np-opcoes">
                      <button type="button" className={!estrutura ? 'ativo' : ''} onClick={() => setEstrutura('')}>Variar</button>
                      {ESTRUTURAS.map((x) => (
                        <button key={x.id} type="button" title={x.desc} className={estrutura === x.id ? 'ativo' : ''} onClick={() => setEstrutura(x.id)}>{x.nome}</button>
                      ))}
                    </div>
                  </div>
                  {formato !== 'reel' && (
                    <div>
                      <h4>Layout</h4>
                      <div className="np-layouts">
                        <button type="button" className={!layout ? 'ativo' : ''} onClick={() => setLayout('')}>
                          <span className="np-mini variar">?</span>
                          Variar
                        </button>
                        {LAYOUTS.map((x) => (
                          <button key={x.id} type="button" className={layout === x.id ? 'ativo' : ''} onClick={() => setLayout(x.id)}>
                            <span className={`np-mini ${x.id}`} aria-hidden><i /><b /></span>
                            {x.nome}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <h4>Voz do texto</h4>
                    <div className="np-opcoes">
                      <button type="button" className={!voz ? 'ativo' : ''} onClick={() => setVoz('')}>Variar</button>
                      {VOZES.map((x) => (
                        <button key={x.id} type="button" title={x.desc} className={voz === x.id ? 'ativo' : ''} onClick={() => setVoz(x.id)}>{x.nome}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Secao>

            <Secao
              numero={5}
              titulo="IAs da equipe"
              extra={
                <button type="button" className="link" onClick={() => setIasAbertas(!iasAbertas)} aria-expanded={iasAbertas}>
                  {iasAbertas ? 'Fechar' : resumoIas.length ? 'Editar' : 'Escolher'}
                </button>
              }
            >
              {!iasAbertas && <p className="np-dica">{resumoIas.length ? resumoIas.join(' · ') : 'Cada funcionário usa a IA de sempre. Troque só para este post, se quiser.'}</p>}
              {iasAbertas && (
                <div className="np-ias">
                  {funcionarios.map((f) => {
                    const opcoes = opcoesDe(f.agente)
                    const escolhida = ias[f.agente] ?? ''
                    const atual = opcoes.find((o) => o.id === (escolhida || padraoDe(f, servicos)))
                    return (
                      <label key={f.agente} className="np-ia">
                        <span>
                          <strong>{f.nome}</strong>
                          <small>
                            {f.video && formato === '' ? 'Só se o post virar Reel · ' : ''}
                            {atual?.desc}
                            {f.agente === 'narrador' && escolhida !== 'nenhum' && semChave('elevenlabs') ? ' · a voz precisa de ELEVENLABS_API_KEY na Vercel' : ''}
                          </small>
                        </span>
                        <select value={escolhida} onChange={(e) => setIas((x) => ({ ...x, [f.agente]: e.target.value }))}>
                          <option value="">Padrão ({nomeDaIA(padraoDe(f, servicos))})</option>
                          {opcoes.map((o) => (
                            <option key={o.id} value={o.id} disabled={semChave(o.servico)}>
                              {o.nome}{semChave(o.servico) ? ` · falta ${CHAVE_DO_SERVICO[o.servico]} na Vercel` : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                    )
                  })}
                  <p className="np-nota">GPT, Gemini e DeepSeek usam a chave do OpenRouter; Kling 3.0, Hailuo e Seedance usam a do fal.ai.</p>
                </div>
              )}
            </Secao>

            <Secao numero={6} titulo="Quando publicar">
              <div className="np-quando" role="radiogroup" aria-label="Quando publicar">
                <button type="button" role="radio" aria-checked={!agendar} className={!agendar ? 'ativo' : ''} onClick={() => setAgendar(false)}>
                  <strong>Decido na aprovação</strong>
                  <span>Publico ou agendo quando o post chegar na minha mesa</span>
                </button>
                <button type="button" role="radio" aria-checked={agendar} className={agendar ? 'ativo' : ''} onClick={() => setAgendar(true)}>
                  <strong>Já sei o horário</strong>
                  <span>Vem sugerido na aprovação</span>
                </button>
              </div>
              {agendar && <input type="datetime-local" className="np-data" value={quando} onChange={(e) => setQuando(e.target.value)} aria-label="Data e hora" />}
              <p className="np-dica">Nada vai para o Instagram sem você aprovar.</p>
            </Secao>
          </div>

          <aside className="np-lado">
            {painelIdeias}
            <div className="np-resumo">
              <h4>Resumo do pedido</h4>
              <dl>
                <dt>Formato</dt>
                <dd>{resumoFormato}</dd>
                <dt>Estilo</dt>
                <dd>{escolhasDeEstilo.length ? escolhasDeEstilo.join(' · ') : 'Variado'}</dd>
                <dt>IAs</dt>
                <dd>{resumoIas.length ? resumoIas.join(' · ') : 'As de sempre'}</dd>
                <dt>Referências</dt>
                <dd>{refs.length ? `${refs.length} ${refs.length > 1 ? 'itens' : 'item'}` : 'Nenhuma'}</dd>
                <dt>Publicação</dt>
                <dd>{quandoTexto}</dd>
              </dl>
            </div>
          </aside>
        </div>

        <footer className="np-rodape">
          {erro ? <p className="aviso">{erro}</p> : <p className="np-caminho">Chefe de pauta → pesquisa → texto → {formato === 'reel' ? 'vídeo → narração' : 'design'} → revisão → você</p>}
          <button type="button" className="secundario" onClick={aoFechar}>Cancelar</button>
          <button className="primario" disabled={enviando || subindo > 0 || !briefing.trim()}>{enviando ? 'Chamando a equipe…' : 'Pôr a equipe para trabalhar'}</button>
        </footer>
      </form>
    </div>
  )
}
