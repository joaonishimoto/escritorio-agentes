import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { chamarApi, lerApi } from '../lib/api'

interface Perfil {
  id: string
  nome: string
  instagram_usuario: string | null
  tom_de_voz: string
  identidade: Record<string, unknown>
  hashtags_fixas: string[]
  aviso_final: string | null
  checklist_revisor: string
}

type Item = { chave: string; valor: string }
type Aba = 'voz' | 'visual' | 'legenda' | 'revisao' | 'narracao' | 'servicos' | 'sala'

const HEX = /^#[0-9a-f]{6}$/i
// chaves que têm campo próprio ou que o app cuida sozinho
const FORA_DAS_REGRAS = ['cores', 'fonte', 'cor_sala', 'instagram', 'instagram_conectado_em', 'instagram_token', 'neutra', 'tom_editado']
const ABAS: { id: Aba; nome: string; quem: string }[] = [
  { id: 'voz', nome: 'Tom de voz', quem: 'Chefe de pauta, redator e revisor' },
  { id: 'visual', nome: 'Visual', quem: 'Designer e revisor' },
  { id: 'legenda', nome: 'Legenda', quem: 'Redator' },
  { id: 'revisao', nome: 'Revisão', quem: 'Revisor' },
  { id: 'narracao', nome: 'Narração', quem: 'Narrador (Reels)' },
  { id: 'servicos', nome: 'Serviços', quem: 'Cinegrafista, narrador e publicador' },
  { id: 'sala', nome: 'Sala', quem: 'Escritório' },
]

// vozes prontas da ElevenLabs (as mesmas de api/_lib/elevenlabs.ts); dá para usar outra pelo ID
const VOZES_NARRACAO = [
  { id: 'YU8EsJtXFMyKMxYtheDk', nome: 'Mário' },
  { id: 'zNEsdgTUa3ndwKry8Xcq', nome: 'Elvis' },
]
const NARRACAO_PADRAO = { ativa: true, voz: VOZES_NARRACAO[0].id, velocidade: 0.95, estabilidade: 0.5 }
type Narracao = typeof NARRACAO_PADRAO

type Servico = { id: string; nome: string; estado: 'ok' | 'erro' | 'falta' | 'incerto'; detalhe: string }
const ESTADO = { ok: 'Funcionando', erro: 'Com problema', falta: 'Não configurado', incerto: 'Não deu para confirmar' }

const rotulo = (k: string) => (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ')
const chave = (r: string) => r.trim().toLowerCase().replace(/\s+/g, '_')
const primeiraFonte = (f: string) => f.split(/[(,]/)[0].trim()

/** Perfil da marca que os agentes seguem: tom de voz, cores, fonte, regras visuais, legenda e checklist do revisor. */
export function PerfilDaMarca({ marcaId, aoFechar, aoSalvar }: { marcaId: string; aoFechar: () => void; aoSalvar: () => void }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [aba, setAba] = useState<Aba>('voz')
  const [nome, setNome] = useState('')
  const [instagram, setInstagram] = useState('')
  const [corSala, setCorSala] = useState('#1e3d66')
  const [tom, setTom] = useState('')
  const [cores, setCores] = useState<Item[]>([])
  const [fonte, setFonte] = useState('')
  const [regras, setRegras] = useState<Item[]>([])
  const [hashtags, setHashtags] = useState('')
  const [aviso, setAviso] = useState('')
  const [checklist, setChecklist] = useState('')
  const [narracao, setNarracao] = useState<Narracao>(NARRACAO_PADRAO)
  // teto de gasto em US$, como texto do campo; vazio no mês = sem teto, vazio no post = padrão
  const [tetoPost, setTetoPost] = useState('')
  const [tetoMes, setTetoMes] = useState('')
  const [gastoMes, setGastoMes] = useState<number | null>(null)
  const [base, setBase] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [servicos, setServicos] = useState<Servico[] | null>(null)
  const [testando, setTestando] = useState(false)
  const [erroTeste, setErroTeste] = useState<string | null>(null)
  const [saude, setSaude] = useState<Servico[] | null>(null)
  // a saúde da produção vem do banco (não chama serviço nenhum): carrega sozinha ao abrir a aba
  useEffect(() => {
    if (aba !== 'servicos') return
    let vivo = true
    lerApi<{ saude: Servico[] }>('servicos?so=saude')
      .then((r) => vivo && setSaude(r.saude))
      .catch(() => vivo && setSaude(null))
    return () => {
      vivo = false
    }
  }, [aba])

  const testarServicos = async () => {
    setTestando(true)
    setErroTeste(null)
    try {
      const r = await lerApi<{ servicos: Servico[] }>('servicos')
      setServicos(r.servicos)
    } catch (e) {
      setErroTeste(e instanceof Error ? e.message : 'Não deu para testar')
    } finally {
      setTestando(false)
    }
  }

  const preencher = (p: Perfil) => {
    const id = p.identidade ?? {}
    setPerfil(p)
    setNome(p.nome)
    setInstagram(p.instagram_usuario ? `@${p.instagram_usuario}` : '')
    setCorSala(typeof id.cor_sala === 'string' && HEX.test(id.cor_sala) ? id.cor_sala : '#1e3d66')
    setTom(p.tom_de_voz ?? '')
    const c = id.cores && typeof id.cores === 'object' && !Array.isArray(id.cores) ? (id.cores as Record<string, unknown>) : {}
    setCores(Object.entries(c).filter(([, v]) => typeof v === 'string' && HEX.test(v)).map(([k, v]) => ({ chave: rotulo(k), valor: v as string })))
    setFonte(typeof id.fonte === 'string' ? id.fonte : '')
    setRegras(Object.entries(id).filter(([k, v]) => !FORA_DAS_REGRAS.includes(k) && typeof v === 'string').map(([k, v]) => ({ chave: rotulo(k), valor: v as string })))
    setHashtags((p.hashtags_fixas ?? []).join(' '))
    setAviso(p.aviso_final ?? '')
    setChecklist(p.checklist_revisor ?? '')
    const n = id.narracao && typeof id.narracao === 'object' ? (id.narracao as Partial<Narracao>) : {}
    setNarracao({ ...NARRACAO_PADRAO, ...n })
    const t = id.teto && typeof id.teto === 'object' ? (id.teto as { por_post_usd?: unknown; por_mes_usd?: unknown }) : {}
    setTetoPost(t.por_post_usd === null ? 'sem' : typeof t.por_post_usd === 'number' ? String(t.por_post_usd).replace('.', ',') : '')
    setTetoMes(typeof t.por_mes_usd === 'number' ? String(t.por_mes_usd).replace('.', ',') : '')
  }

  const retrato = JSON.stringify([nome, instagram, corSala, tom, cores, fonte, regras, hashtags, aviso, checklist, narracao, tetoPost, tetoMes])
  const mudou = perfil !== null && retrato !== base

  useEffect(() => {
    chamarApi<{ marca: Perfil; gasto_mes?: number }>('marcas', { acao: 'ler', id: marcaId })
      .then(({ marca, gasto_mes }) => {
        preencher(marca)
        setGastoMes(gasto_mes ?? null)
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não deu para abrir a marca'))
  }, [marcaId])
  // depois de preencher, guarda o retrato para saber se algo mudou
  useEffect(() => {
    if (perfil) setBase(retrato)
  }, [perfil]) // eslint-disable-line react-hooks/exhaustive-deps

  // carrega a fonte da marca do Google Fonts só para a prévia
  const nomeFonte = primeiraFonte(fonte)
  useEffect(() => {
    if (!nomeFonte || /system|sans-serif|serif/i.test(nomeFonte)) return
    const id = `fonte-${chave(nomeFonte)}`
    if (document.getElementById(id)) return
    const l = document.createElement('link')
    l.id = id
    l.rel = 'stylesheet'
    l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(nomeFonte)}:wght@400;700&display=swap`
    document.head.appendChild(l)
  }, [nomeFonte])

  const fechar = () => {
    if (mudou && !confirm('Sair sem salvar as mudanças?')) return
    aoFechar()
  }

  const neutra = Boolean(perfil?.identidade?.neutra)
  const paleta = useMemo(() => cores.filter((c) => HEX.test(c.valor)), [cores])
  // prévia: fundo = cor mais escura, texto = mais clara, destaque = mais saturada
  const previa = useMemo(() => {
    const info = paleta.map((c) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.valor.slice(i, i + 2), 16) / 255)
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      return { cor: c.valor, luz: 0.2126 * r + 0.7152 * g + 0.0722 * b, sat: max === 0 ? 0 : (max - min) / max }
    })
    if (!info.length) return { fundo: '#14181f', texto: '#ffffff', destaque: corSala }
    const porLuz = [...info].sort((a, b) => a.luz - b.luz)
    const destaque = [...info].sort((a, b) => b.sat - a.sat)[0]
    const fundo = porLuz[0].luz < 0.35 ? porLuz[0].cor : '#14181f'
    const texto = porLuz[porLuz.length - 1].luz > 0.6 ? porLuz[porLuz.length - 1].cor : '#ffffff'
    return { fundo, texto, destaque: destaque.sat > 0.25 ? destaque.cor : corSala }
  }, [paleta, corSala])

  const salvar = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!perfil) return
    setSalvando(true)
    setErro(null)
    // começa da identidade atual para não perder o que não aparece no formulário (formatos, listas…)
    const antiga = perfil.identidade ?? {}
    const identidade: Record<string, unknown> = Object.fromEntries(Object.entries(antiga).filter(([, v]) => typeof v !== 'string'))
    for (const k of ['instagram', 'instagram_conectado_em']) if (k in antiga) identidade[k] = antiga[k]
    identidade.cor_sala = corSala
    const coresAntigas = antiga.cores && typeof antiga.cores === 'object' && !Array.isArray(antiga.cores) ? (antiga.cores as Record<string, unknown>) : {}
    const outrasCores = Object.fromEntries(Object.entries(coresAntigas).filter(([, v]) => !(typeof v === 'string' && HEX.test(v))))
    const novasCores = Object.fromEntries(cores.filter((c) => c.chave.trim() && HEX.test(c.valor)).map((c) => [chave(c.chave), c.valor]))
    if (Object.keys(novasCores).length || Object.keys(outrasCores).length) identidade.cores = { ...novasCores, ...outrasCores }
    else delete identidade.cores
    if (fonte.trim()) identidade.fonte = fonte.trim()
    for (const r of regras) if (r.chave.trim() && r.valor.trim()) identidade[chave(r.chave)] = r.valor.trim()
    identidade.narracao = { ...narracao, voz: narracao.voz.trim() || NARRACAO_PADRAO.voz }
    const dinheiro = (v: string) => {
      const n = Number(v.trim().replace(/[^\d,.]/g, '').replace(',', '.'))
      return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined
    }
    const teto: Record<string, number | null> = {}
    if (/^sem/i.test(tetoPost.trim())) teto.por_post_usd = null
    else if (dinheiro(tetoPost) !== undefined) teto.por_post_usd = dinheiro(tetoPost)!
    if (dinheiro(tetoMes) !== undefined) teto.por_mes_usd = dinheiro(tetoMes)!
    if (Object.keys(teto).length) identidade.teto = teto
    else delete identidade.teto
    try {
      const { marca } = await chamarApi<{ marca: Perfil }>('marcas', {
        acao: 'salvar',
        id: marcaId,
        campos: {
          nome,
          instagram_usuario: instagram,
          tom_de_voz: tom,
          identidade,
          hashtags_fixas: hashtags.split(/[\s,]+/),
          aviso_final: aviso,
          checklist_revisor: checklist,
        },
      })
      preencher(marca)
      setSalvo(true)
      setTimeout(() => setSalvo(false), 2500)
      aoSalvar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não deu para salvar')
    }
    setSalvando(false)
  }

  const mudarItem = (lista: Item[], set: (l: Item[]) => void, i: number, campo: keyof Item, valor: string) =>
    set(lista.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)))

  const listaHashtags = hashtags.split(/[\s,]+/).filter(Boolean).map((h) => (h.startsWith('#') ? h : `#${h}`))
  const itensChecklist = checklist.split('\n').filter((l) => l.trim()).length
  const atual = ABAS.find((a) => a.id === aba)!

  return (
    <div className="modal-fundo" onClick={fechar}>
      <form className="modal pm" onSubmit={salvar} onClick={(e) => e.stopPropagation()} aria-label="Perfil da marca">
        <header className="pm-topo">
          <span className="pm-avatar" style={{ background: corSala }}>{(nome || perfil?.nome || '?').charAt(0).toUpperCase()}</span>
          <div className="pm-titulo">
            <h2>{nome || perfil?.nome || 'Marca'}</h2>
            <p className="muted">
              {instagram || 'sem Instagram'}
              {neutra && ' · sala neutra'}
            </p>
          </div>
          <button type="button" className="fechar" onClick={fechar} aria-label="Fechar">×</button>
        </header>

        <nav className="pm-abas" role="tablist">
          {ABAS.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={aba === a.id ? 'ativo' : ''} onClick={() => setAba(a.id)}>
              {a.nome}
            </button>
          ))}
        </nav>

        <div className="pm-corpo">
          {!perfil && !erro && <p className="muted pm-carregando">Carregando o perfil…</p>}
          {perfil && (
            <>
              <p className="pm-quem">
                <span>Quem usa:</span> {atual.quem}
              </p>

              {aba === 'voz' && (
                <section className="pm-secao">
                  {neutra && <p className="pm-nota">Sala neutra: cada post segue as referências do pedido. O que estiver aqui vale como base.</p>}
                  <label htmlFor="pm-tom">Como a marca fala</label>
                  <p className="pm-dica">Para quem, com que jeito, o que evitar, como abrir e fechar a legenda.</p>
                  <textarea id="pm-tom" className="pm-tom" value={tom} onChange={(e) => setTom(e.target.value)} placeholder="Frases curtas, português do dia a dia, sem jargão…" />
                  <p className="pm-contador muted">{tom.trim() ? `${tom.trim().split(/\s+/).length} palavras` : 'vazio'}</p>
                </section>
              )}

              {aba === 'visual' && (
                <>
                  <section className="pm-previa">
                    <div className="pm-previa-cartao" style={{ background: previa.fundo, color: previa.texto, fontFamily: nomeFonte ? `'${nomeFonte}', var(--font-sans)` : undefined }}>
                      <small style={{ color: previa.destaque }}>{nome || 'Marca'}</small>
                      <strong>
                        Um título de slide com <span style={{ color: previa.destaque }}>destaque</span>
                      </strong>
                      <span>Texto do corpo na fonte {nomeFonte || 'padrão'}.</span>
                    </div>
                    <div className="pm-previa-paleta">
                      {paleta.length ? paleta.map((c, i) => <i key={i} style={{ background: c.valor }} title={c.chave} />) : <span className="muted">Sem cores</span>}
                    </div>
                  </section>

                  <section className="pm-secao">
                    <div className="pm-cabeca">
                      <h3>Cores</h3>
                      <button type="button" className="link" onClick={() => setCores([...cores, { chave: '', valor: '#000000' }])}>+ Adicionar cor</button>
                    </div>
                    {cores.length === 0 && <p className="pm-dica">Nenhuma cor ainda. O designer escolhe livremente até você definir.</p>}
                    <ul className="pm-cores">
                      {cores.map((c, i) => (
                        <li key={i}>
                          <label className="pm-amostra" style={{ background: c.valor }} title="Trocar cor">
                            <input type="color" value={c.valor} onChange={(e) => mudarItem(cores, setCores, i, 'valor', e.target.value)} aria-label={`Cor ${c.chave}`} />
                          </label>
                          <div className="pm-cor-texto">
                            <input value={c.chave} onChange={(e) => mudarItem(cores, setCores, i, 'chave', e.target.value)} placeholder="Nome (ex.: Fundo)" aria-label="Nome da cor" />
                            <input
                              className="mono"
                              value={c.valor.toUpperCase()}
                              onChange={(e) => {
                                const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
                                mudarItem(cores, setCores, i, 'valor', v.slice(0, 7))
                              }}
                              aria-label="Código da cor"
                            />
                          </div>
                          <button type="button" className="fechar" onClick={() => setCores(cores.filter((_, j) => j !== i))} aria-label="Remover cor">×</button>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="pm-secao">
                    <label htmlFor="pm-fonte">Fonte</label>
                    <input id="pm-fonte" value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="Ex.: Inter (títulos em bold)" />
                    <p className="pm-dica">Use o nome da fonte do Google Fonts. Detalhes como peso podem ir entre parênteses.</p>
                  </section>

                  <section className="pm-secao">
                    <div className="pm-cabeca">
                      <h3>Regras visuais</h3>
                      <button type="button" className="link" onClick={() => setRegras([...regras, { chave: '', valor: '' }])}>+ Adicionar regra</button>
                    </div>
                    {regras.length === 0 && <p className="pm-dica">Ex.: Fotos: só fotos oficiais, sem pessoas. Destaque: uma cor de destaque por slide.</p>}
                    <ul className="pm-regras">
                      {regras.map((r, i) => (
                        <li key={i}>
                          <div className="pm-regra-topo">
                            <input value={r.chave} onChange={(e) => mudarItem(regras, setRegras, i, 'chave', e.target.value)} placeholder="Assunto" aria-label="Assunto da regra" />
                            <button type="button" className="fechar" onClick={() => setRegras(regras.filter((_, j) => j !== i))} aria-label="Remover regra">×</button>
                          </div>
                          <textarea rows={2} value={r.valor} onChange={(e) => mudarItem(regras, setRegras, i, 'valor', e.target.value)} placeholder="O que seguir" aria-label="Regra" />
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              )}

              {aba === 'legenda' && (
                <section className="pm-secao">
                  <label htmlFor="pm-hash">Hashtags fixas</label>
                  <input id="pm-hash" value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#marca #assunto" />
                  {listaHashtags.length > 0 && (
                    <div className="pm-tags">
                      {listaHashtags.map((h, i) => <span key={i} className="chip">{h}</span>)}
                    </div>
                  )}
                  <p className="pm-dica">Entram no fim de toda legenda. Separe por espaço.</p>
                  <label htmlFor="pm-aviso">Aviso obrigatório no fim</label>
                  <input id="pm-aviso" value={aviso} onChange={(e) => setAviso(e.target.value)} placeholder="Ex.: Aprecie com moderação." />
                </section>
              )}

              {aba === 'revisao' && (
                <section className="pm-secao">
                  <label htmlFor="pm-check">Checklist do revisor</label>
                  <p className="pm-dica">Um item por linha. O revisor confere cada um antes de mandar o post para você. {itensChecklist} itens.</p>
                  <textarea id="pm-check" className="pm-tom" value={checklist} onChange={(e) => setChecklist(e.target.value)} />
                </section>
              )}

              {aba === 'narracao' && (
                <section className="pm-secao">
                  <label className="pm-linha">
                    <input type="checkbox" checked={narracao.ativa} onChange={(e) => setNarracao({ ...narracao, ativa: e.target.checked })} />
                    Narrar os Reels desta marca
                  </label>
                  <p className="pm-dica">O narrador escreve a fala no tom da marca, grava a voz na ElevenLabs e põe no vídeo. Dá para tirar a narração de um post só em "IAs da equipe".</p>
                  <label htmlFor="pm-voz">Voz</label>
                  <select
                    id="pm-voz"
                    value={VOZES_NARRACAO.some((v) => v.id === narracao.voz) ? narracao.voz : 'outra'}
                    onChange={(e) => setNarracao({ ...narracao, voz: e.target.value === 'outra' ? '' : e.target.value })}
                  >
                    {VOZES_NARRACAO.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                    <option value="outra">Outra voz da ElevenLabs</option>
                  </select>
                  {!VOZES_NARRACAO.some((v) => v.id === narracao.voz) && (
                    <>
                      <input className="mono" value={narracao.voz} onChange={(e) => setNarracao({ ...narracao, voz: e.target.value.trim() })} placeholder="ID da voz (ex.: YU8EsJtXFMyKMxYtheDk)" aria-label="ID da voz" />
                      <p className="pm-dica">Na ElevenLabs, abra a voz em Voices e copie o Voice ID.</p>
                    </>
                  )}
                  <label htmlFor="pm-vel">Velocidade: {narracao.velocidade.toFixed(2).replace('.', ',')}</label>
                  <input id="pm-vel" type="range" min={0.7} max={1.2} step={0.05} value={narracao.velocidade} onChange={(e) => setNarracao({ ...narracao, velocidade: Number(e.target.value) })} />
                  <label htmlFor="pm-est">Estabilidade: {narracao.estabilidade.toFixed(2).replace('.', ',')}</label>
                  <input id="pm-est" type="range" min={0} max={1} step={0.05} value={narracao.estabilidade} onChange={(e) => setNarracao({ ...narracao, estabilidade: Number(e.target.value) })} />
                  <p className="pm-dica">Mais estabilidade deixa a voz mais constante; menos, mais expressiva.</p>
                </section>
              )}

              {aba === 'servicos' && (
                <section className="pm-secao">
                  <h3>Testar serviços</h3>
                  <p className="pm-dica">
                    Uma chamada mínima em cada serviço (Claude, OpenRouter, fal.ai, Kling, ElevenLabs e o Instagram de cada sala) para pegar chave errada, saldo zerado ou conta
                    desconectada antes de gastar um post. Não gera nada nem cobra.
                  </p>
                  <div>
                    <button type="button" className="secundario" disabled={testando} onClick={testarServicos}>
                      {testando ? 'Testando…' : servicos ? 'Testar de novo' : 'Testar agora'}
                    </button>
                  </div>
                  {erroTeste && <p className="aviso">{erroTeste}</p>}
                  {servicos && (
                    <ul className="pm-servicos">
                      {servicos.map((s) => (
                        <li key={s.id} className={s.estado}>
                          <span className="pm-servico-ponto" aria-hidden />
                          <div>
                            <strong>{s.nome}</strong> <span className="chip">{ESTADO[s.estado]}</span>
                            <p className="muted">{s.detalhe}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <h3>Saúde da produção</h3>
                  <p className="pm-dica">Posts parados, falhas da semana por agente e a faxina diária, de todas as salas.</p>
                  {saude === null ? (
                    <p className="muted">Carregando…</p>
                  ) : (
                    <ul className="pm-servicos">
                      {saude.map((s) => (
                        <li key={s.id} className={s.estado}>
                          <span className="pm-servico-ponto" aria-hidden />
                          <div>
                            <strong>{s.nome}</strong>
                            <p className="muted">{s.detalhe}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="pm-dica">O vídeo dos Reels sai pelo fal.ai (Kling 3.0) quando a FAL_KEY está na Vercel; sem ela, pela Kling direta; sem as duas, como animação do Claude.</p>
                </section>
              )}

              {aba === 'sala' && (
                <section className="pm-secao">
                  <label htmlFor="pm-nome">Nome</label>
                  <input id="pm-nome" required maxLength={40} value={nome} onChange={(e) => setNome(e.target.value)} />
                  <label htmlFor="pm-ig">Instagram</label>
                  <input id="pm-ig" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@conta" />
                  <label htmlFor="pm-sala">Cor da sala no escritório</label>
                  <div className="pm-linha">
                    <label className="pm-amostra" style={{ background: corSala }}>
                      <input id="pm-sala" type="color" value={corSala} onChange={(e) => setCorSala(e.target.value)} />
                    </label>
                    <span className="mono muted">{corSala.toUpperCase()}</span>
                  </div>

                  <h3 className="pm-subtitulo">Teto de gasto</h3>
                  <p className="pm-dica">
                    Por post: ao passar, a equipe para e manda o post como está para você decidir. Vazio usa US$ 2,00; escreva &quot;sem&quot; para não ter teto.
                    Por mês: ao passar, a sala não começa post novo até virar o mês. Vazio = sem teto.
                  </p>
                  <div className="pm-tetos">
                    <label>
                      <span>Por post (US$)</span>
                      <input inputMode="decimal" value={tetoPost} onChange={(e) => setTetoPost(e.target.value)} placeholder="2,00" aria-label="Teto por post em dólares" />
                    </label>
                    <label>
                      <span>Por mês (US$)</span>
                      <input inputMode="decimal" value={tetoMes} onChange={(e) => setTetoMes(e.target.value)} placeholder="sem teto" aria-label="Teto por mês em dólares" />
                    </label>
                  </div>
                  {gastoMes !== null && (
                    <p className="pm-dica">
                      Gasto desta sala no mês: <strong>US$ {gastoMes.toFixed(2).replace('.', ',')}</strong>
                      {(() => {
                        const n = Number(tetoMes.replace(',', '.'))
                        return Number.isFinite(n) && n > 0 ? ` de US$ ${n.toFixed(2).replace('.', ',')} (${Math.min(100, Math.round((gastoMes / n) * 100))}%)` : ''
                      })()}
                    </p>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        <footer className="pm-rodape">
          <span className={`pm-estado ${erro ? 'erro' : salvo ? 'ok' : ''}`} role="status">
            {erro ?? (salvo ? 'Salvo. O próximo post já usa.' : mudou ? 'Alterações não salvas' : 'Tudo aqui vai para os agentes em cada post.')}
          </span>
          <button type="button" className="secundario" onClick={fechar}>Fechar</button>
          <button type="submit" className="primario" disabled={!perfil || salvando || !mudou}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </footer>
      </form>
    </div>
  )
}
