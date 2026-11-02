import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import './Tarefas.css'
import {
  COR_PESSOAL,
  TOPICO_PADRAO,
  agrupar,
  corDoTopico,
  entenderTexto,
  resumoParaHoje,
  situacaoDoPrazo,
  textoDoPrazo,
  topicosConhecidos,
  type MarcaDaTarefa,
  type Tarefa,
} from '../lib/tarefas'
import type { useTarefas } from '../lib/usarTarefas'
import { CampoComSugestoes, Chave, Escolha, EscolhaDeData } from './Controles'

type Dados = ReturnType<typeof useTarefas>
type Modo = 'marca' | 'topico'

const lembrar = (chave: string, padrao: string) => {
  try {
    return localStorage.getItem(chave) ?? padrao
  } catch {
    return padrao
  }
}
const guardar = (chave: string, v: string) => {
  try {
    localStorage.setItem(chave, v)
  } catch {
    // vale até recarregar
  }
}

export function IconeAssistente({ tamanho = 22 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 10l1.5 1.5L13 9M9 16l1.5 1.5L13 15M15 10.5h1M15 16.5h1" />
    </svg>
  )
}

function fala(r: ReturnType<typeof resumoParaHoje>) {
  const n = (k: number, um: string, varios: string) => `${k} ${k === 1 ? um : varios}`
  if (r.atrasadas && r.paraHoje) return `${n(r.atrasadas, 'tarefa atrasada', 'tarefas atrasadas')} e ${n(r.paraHoje, 'para hoje', 'para hoje')}. Vamos começar por elas?`
  if (r.atrasadas) return `${n(r.atrasadas, 'tarefa atrasada', 'tarefas atrasadas')}. Que tal resolver ou mudar o prazo?`
  if (r.paraHoje) return `${n(r.paraHoje, 'tarefa para hoje', 'tarefas para hoje')}. O resto pode esperar.`
  if (r.abertas) return `${n(r.abertas, 'tarefa aberta', 'tarefas abertas')} e nada vencendo hoje.`
  return 'Tudo em dia! Me diga o que você precisa fazer que eu organizo.'
}

/** A Assistente da sua sala: anota qualquer tarefa, pessoal ou de uma marca, e separa por marca ou por tópico. */
export function Tarefas({ dados, marcas, aoFechar }: { dados: Dados; marcas: MarcaDaTarefa[]; aoFechar: () => void }) {
  const { tarefas, erro, faltaTabela, criar, mudar, apagar } = dados
  const lista = useMemo(() => tarefas ?? [], [tarefas])
  const [modo, setModoBruto] = useState<Modo>(() => (lembrar('tarefas-modo', 'marca') === 'topico' ? 'topico' : 'marca'))
  const setModo = (m: Modo) => {
    setModoBruto(m)
    setFiltro(null)
    guardar('tarefas-modo', m)
  }
  const [filtro, setFiltro] = useState<string | null>(null)
  const [verFeitas, setVerFeitas] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)

  // anotar
  const [texto, setTexto] = useState('')
  const [marcaSel, setMarcaSel] = useState<string>('')
  const [topicoSel, setTopicoSel] = useState('')
  const [prazoSel, setPrazoSel] = useState('')
  const [importanteSel, setImportanteSel] = useState(false)
  const campo = useRef<HTMLInputElement>(null)
  const entendido = useMemo(() => entenderTexto(texto, marcas), [texto, marcas])

  useEffect(() => {
    campo.current?.focus()
  }, [])
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      if (editando) setEditando(null)
      else aoFechar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [editando, aoFechar])

  const topicos = useMemo(() => topicosConhecidos(lista), [lista])
  const resumo = useMemo(() => resumoParaHoje(lista), [lista])
  const nomeDaMarca = (id: string | null) => (id ? marcas.find((m) => m.id === id) : null)

  const anotar = (e: FormEvent) => {
    e.preventDefault()
    if (!entendido.titulo) return
    criar({
      titulo: entendido.titulo.slice(0, 300),
      marca_id: entendido.marcaId ?? (marcaSel || null),
      topico: (entendido.topico ?? topicoSel.trim()) || TOPICO_PADRAO,
      prazo: entendido.prazo ?? (prazoSel || null),
      importante: entendido.importante || importanteSel,
    })
    setTexto('')
    setPrazoSel('')
    setImportanteSel(false)
    campo.current?.focus()
  }
  const anotarEm = (g: { chave: string; nome: string }) => {
    if (modo === 'marca') setMarcaSel(g.chave === 'pessoal' ? '' : g.chave)
    else setTopicoSel(g.nome)
    campo.current?.focus()
  }

  // agrupa por uma dimensão e filtra pela outra
  const visiveis = lista.filter((t) => (verFeitas || !t.feita_em) && (!filtro || (modo === 'marca' ? t.topico === filtro : (t.marca_id ?? 'pessoal') === filtro)))
  const grupos = agrupar(visiveis, modo, marcas)
  const chips =
    modo === 'marca'
      ? [...new Set(lista.filter((t) => verFeitas || !t.feita_em).map((t) => t.topico))].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((t) => ({ id: t, nome: t, cor: corDoTopico(t) }))
      : [
          ...(lista.some((t) => !t.marca_id) ? [{ id: 'pessoal', nome: 'Pessoal', cor: COR_PESSOAL }] : []),
          ...marcas.filter((m) => lista.some((t) => t.marca_id === m.id)).map((m) => ({ id: m.id, nome: m.nome, cor: m.cor })),
        ]
  const feitasEscondidas = verFeitas ? 0 : lista.filter((t) => t.feita_em).length

  const opcoesMarca = [{ valor: '', nome: 'Pessoal', cor: COR_PESSOAL }, ...marcas.map((m) => ({ valor: m.id, nome: m.nome, cor: m.cor }))]
  const previa = texto.trim() && (entendido.marcaId || entendido.topico || entendido.prazo || entendido.importante)

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal tf" role="dialog" aria-modal="true" aria-labelledby="tf-titulo" onClick={(e) => e.stopPropagation()}>
        <header className="tf-topo">
          <span className="tf-avatar">
            <IconeAssistente tamanho={24} />
          </span>
          <div className="tf-quem">
            <h2 id="tf-titulo">Assistente</h2>
            <p>{tarefas === null ? 'Separando suas tarefas…' : fala(resumo)}</p>
          </div>
          <button type="button" className="fechar" onClick={aoFechar} aria-label="Fechar">×</button>
        </header>

        {faltaTabela && <p className="aviso">Falta aplicar a migração <code>20261102000100_tarefas.sql</code> no Supabase para as tarefas ficarem guardadas.</p>}
        {erro && <p className="aviso">{erro}</p>}

        <form className="tf-anotar" onSubmit={anotar}>
          <div className="tf-linha">
            <input
              ref={campo}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={300}
              placeholder="O que você precisa fazer?"
              aria-label="Nova tarefa"
            />
            <button className="primario" disabled={!entendido.titulo || faltaTabela}>Anotar</button>
          </div>
          <div className="tf-opcoes">
            <Escolha rotulo="Marca" valor={entendido.marcaId ?? marcaSel} opcoes={opcoesMarca} aoMudar={setMarcaSel} travado={!!entendido.marcaId} dica="Achei a marca no texto" />
            <CampoComSugestoes rotulo="Tópico" placeholder="Tópico" valor={entendido.topico ?? topicoSel} aoMudar={setTopicoSel} sugestoes={topicos} corDe={corDoTopico} travado={!!entendido.topico} dica="Achei o tópico no texto (#)" />
            <EscolhaDeData rotulo="Prazo" valor={entendido.prazo ?? (prazoSel || null)} aoMudar={(v) => setPrazoSel(v ?? '')} texto={(v) => textoDoPrazo(v)} travado={!!entendido.prazo} dica="Achei o prazo no texto" />
            <button type="button" className={`tf-imp${entendido.importante || importanteSel ? ' ligado' : ''}`} aria-pressed={entendido.importante || importanteSel} onClick={() => setImportanteSel((v) => !v)}>
              ★ Importante
            </button>
          </div>
          <p className="tf-dica">
            {previa ? (
              <>Entendi: {[nomeDaMarca(entendido.marcaId ?? null)?.nome, entendido.topico, entendido.prazo && textoDoPrazo(entendido.prazo), entendido.importante && 'importante'].filter(Boolean).join(' · ')}</>
            ) : (
              <>Escreva do seu jeito, como “Drinfy gravar reels amanhã #conteúdo !”: eu acho a marca pelo nome, o tópico com #, o prazo (hoje, amanhã, sexta, 12/11) e ! para importante.</>
            )}
          </p>
        </form>

        <div className="tf-barra">
          <div className="tf-seg" role="tablist" aria-label="Separar por">
            <button type="button" role="tab" aria-selected={modo === 'marca'} className={modo === 'marca' ? 'ativo' : ''} onClick={() => setModo('marca')}>Por marca</button>
            <button type="button" role="tab" aria-selected={modo === 'topico'} className={modo === 'topico' ? 'ativo' : ''} onClick={() => setModo('topico')}>Por tópico</button>
          </div>
          {chips.length > 1 && (
            <div className="tf-chips" aria-label={modo === 'marca' ? 'Filtrar por tópico' : 'Filtrar por marca'}>
              <button type="button" className={!filtro ? 'ativo' : ''} onClick={() => setFiltro(null)}>Tudo</button>
              {chips.map((c) => (
                <button key={c.id} type="button" className={filtro === c.id ? 'ativo' : ''} onClick={() => setFiltro(filtro === c.id ? null : c.id)}>
                  <i style={{ background: c.cor }} />
                  {c.nome}
                </button>
              ))}
            </div>
          )}
          <span className="tf-feitas">
            <Chave ligada={verFeitas} aoMudar={setVerFeitas}>Mostrar feitas{feitasEscondidas ? ` (${feitasEscondidas})` : ''}</Chave>
          </span>
        </div>

        <div className="tf-grade">
          {tarefas === null ? (
            <p className="muted tf-vazio">Carregando…</p>
          ) : grupos.length === 0 ? (
            <div className="tf-vazio">
              <span className="tf-avatar grande"><IconeAssistente tamanho={30} /></span>
              <strong>{lista.length ? 'Nada aberto por aqui' : 'Nenhuma tarefa ainda'}</strong>
              <p className="muted">{lista.length ? 'Tudo que estava aqui já foi feito.' : 'Anote a primeira lá em cima. Pode ser da casa, do banco ou de qualquer marca.'}</p>
            </div>
          ) : (
            grupos.map((g) => {
              const abertas = g.tarefas.filter((t) => !t.feita_em).length
              return (
                <section key={g.chave} className="tf-grupo" style={{ ['--cor' as string]: g.cor }}>
                  <header>
                    <i />
                    <h3>{g.nome}</h3>
                    <span className="tf-conta">{abertas}</span>
                  </header>
                  <ul>
                    {g.tarefas.map((t) => (
                      <Linha
                        key={t.id}
                        t={t}
                        modo={modo}
                        marca={nomeDaMarca(t.marca_id)}
                        marcas={marcas}
                        topicos={topicos}
                        aberta={editando === t.id}
                        aoAbrir={() => setEditando(editando === t.id ? null : t.id)}
                        aoMudar={(c) => mudar(t.id, c)}
                        aoApagar={() => {
                          setEditando(null)
                          apagar(t.id)
                        }}
                      />
                    ))}
                  </ul>
                  <button type="button" className="tf-mais" onClick={() => anotarEm(g)}>+ Anotar em {g.nome}</button>
                </section>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function Linha({
  t,
  modo,
  marca,
  marcas,
  topicos,
  aberta,
  aoAbrir,
  aoMudar,
  aoApagar,
}: {
  t: Tarefa
  modo: Modo
  marca: MarcaDaTarefa | null | undefined
  marcas: MarcaDaTarefa[]
  topicos: string[]
  aberta: boolean
  aoAbrir: () => void
  aoMudar: (c: Partial<Tarefa>) => void
  aoApagar: () => void
}) {
  const feita = !!t.feita_em
  const situacao = t.prazo && !feita ? situacaoDoPrazo(t.prazo) : null
  const [rascunho, setRascunho] = useState(t)
  useEffect(() => {
    if (aberta) setRascunho(t)
  }, [aberta]) // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = () => {
    const titulo = rascunho.titulo.trim()
    if (!titulo) return
    const c: Partial<Tarefa> = {}
    if (titulo !== t.titulo) c.titulo = titulo
    if (rascunho.marca_id !== t.marca_id) c.marca_id = rascunho.marca_id
    const topico = rascunho.topico.trim() || TOPICO_PADRAO
    if (topico !== t.topico) c.topico = topico
    if (rascunho.prazo !== t.prazo) c.prazo = rascunho.prazo
    const notas = rascunho.notas?.trim() || null
    if (notas !== t.notas) c.notas = notas
    if (Object.keys(c).length) aoMudar(c)
    aoAbrir()
  }

  return (
    <li className={`tf-tarefa${feita ? ' feita' : ''}${aberta ? ' aberta' : ''}`}>
      <div className="tf-tarefa-linha">
        <button type="button" className="tf-check" aria-pressed={feita} aria-label={feita ? 'Reabrir tarefa' : 'Marcar como feita'} onClick={() => aoMudar({ feita_em: feita ? null : new Date().toISOString() })}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" className="tf-texto" onClick={aoAbrir} aria-expanded={aberta}>
          <span className="tf-titulo-tarefa">{t.titulo}</span>
          <span className="tf-meta">
            {modo === 'marca' ? (
              t.topico !== TOPICO_PADRAO && <span className="tf-etq"><i style={{ background: corDoTopico(t.topico) }} />{t.topico}</span>
            ) : (
              <span className="tf-etq"><i style={{ background: marca?.cor ?? COR_PESSOAL }} />{marca?.nome ?? 'Pessoal'}</span>
            )}
            {t.prazo && <span className={`tf-prazo${situacao ? ` ${situacao}` : ''}`}>{situacao === 'atrasada' ? `Atrasada · ${textoDoPrazo(t.prazo)}` : textoDoPrazo(t.prazo)}</span>}
            {t.notas && <span className="tf-etq" title={t.notas}>✎ nota</span>}
          </span>
        </button>
        <button type="button" className={`tf-estrela${t.importante ? ' ligada' : ''}`} aria-pressed={t.importante} aria-label={t.importante ? 'Tirar de importante' : 'Marcar como importante'} onClick={() => aoMudar({ importante: !t.importante })}>
          ★
        </button>
      </div>
      {aberta && (
        <div className="tf-editar">
          <input value={rascunho.titulo} onChange={(e) => setRascunho({ ...rascunho, titulo: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && salvar()} maxLength={300} aria-label="Título" autoFocus />
          <div className="tf-opcoes">
            <Escolha rotulo="Marca" valor={rascunho.marca_id ?? ''} opcoes={[{ valor: '', nome: 'Pessoal', cor: COR_PESSOAL }, ...marcas.map((m) => ({ valor: m.id, nome: m.nome, cor: m.cor }))]} aoMudar={(v) => setRascunho({ ...rascunho, marca_id: v || null })} />
            <CampoComSugestoes rotulo="Tópico" placeholder="Tópico" valor={rascunho.topico} aoMudar={(v) => setRascunho({ ...rascunho, topico: v })} sugestoes={topicos} corDe={corDoTopico} />
            <EscolhaDeData rotulo="Prazo" valor={rascunho.prazo} aoMudar={(v) => setRascunho({ ...rascunho, prazo: v })} texto={(v) => textoDoPrazo(v)} />
          </div>
          <textarea rows={2} value={rascunho.notas ?? ''} onChange={(e) => setRascunho({ ...rascunho, notas: e.target.value })} placeholder="Notas (links, detalhes, com quem falar…)" maxLength={2000} aria-label="Notas" />
          <div className="acoes">
            <button type="button" className="tf-apagar" onClick={aoApagar}>Apagar</button>
            <button type="button" className="secundario" onClick={aoAbrir}>Cancelar</button>
            <button type="button" className="primario" onClick={salvar}>Salvar</button>
          </div>
        </div>
      )}
    </li>
  )
}
