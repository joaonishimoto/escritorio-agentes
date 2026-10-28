import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { supabase } from '../lib/supabase'

interface Midia {
  id: string
  caminho: string
  descricao: string | null
  tags: string[]
  aprovada: boolean
}

/** Tipos de referência: o primeiro tag conhecido decide. Sem tag conta como foto. */
const TIPOS = [
  { id: 'icone', nome: 'Logo e ícone', curto: 'Logo', dica: 'O logo e o ícone que vão na assinatura dos slides.' },
  { id: 'foto', nome: 'Fotos', curto: 'Foto', dica: 'Fotos que podem entrar nos posts: pessoas, ambientes, produto em uso.' },
  { id: 'produto', nome: 'Produto e telas', curto: 'Produto', dica: 'Telas do app, embalagens, mockups. Bom para posts que mostram o produto.' },
  { id: 'inspiracao', nome: 'Inspiração', curto: 'Inspiração', dica: 'Posts e peças que você gosta. O designer copia o estilo, mas não coloca a imagem no slide.' },
] as const
type Tipo = (typeof TIPOS)[number]['id']
const tipoDe = (m: Midia): Tipo => (TIPOS.find((t) => m.tags.includes(t.id))?.id ?? 'foto')

const urlDe = (caminho: string) => supabase!.storage.from('marcas').getPublicUrl(caminho).data.publicUrl
const ACEITA = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

const slug = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')

/** Referências da marca: o que o designer pode usar nos posts e o que serve só de inspiração. */
export function Biblioteca({ marcaId, marcaNome, marcaCor, aoFechar }: { marcaId: string; marcaNome?: string; marcaCor?: string; aoFechar: () => void }) {
  const [midias, setMidias] = useState<Midia[] | null>(null)
  const [filtro, setFiltro] = useState<Tipo | 'todas'>('todas')
  const [tipoNovo, setTipoNovo] = useState<Tipo>('foto')
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const [aberta, setAberta] = useState<number | null>(null)
  const [removendo, setRemovendo] = useState<string | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  const carregar = useCallback(
    () =>
      supabase
        ?.from('midias')
        .select('id, caminho, descricao, tags, aprovada')
        .eq('marca_id', marcaId)
        .order('criado_em', { ascending: false })
        .then(({ data }) => setMidias((data as Midia[]) ?? [])),
    [marcaId],
  )
  useEffect(() => {
    carregar()
  }, [carregar])

  // a aba escolhida vira o tipo de quem chega
  useEffect(() => {
    if (filtro !== 'todas') setTipoNovo(filtro)
  }, [filtro])

  const enviar = useCallback(
    async (arquivos: File[]) => {
      if (!supabase) return
      const validos = arquivos.filter((f) => ACEITA.includes(f.type))
      if (!validos.length) return setErro('Só imagens PNG, JPG, WebP ou SVG.')
      setErro(validos.length < arquivos.length ? 'Alguns arquivos não são imagem e ficaram de fora.' : null)
      setProgresso({ feito: 0, total: validos.length })
      for (const [i, f] of validos.entries()) {
        const nome = f.name.replace(/\.[^.]+$/, '') || 'imagem'
        const caminho = `${marcaId}/${Date.now().toString(36)}-${slug(f.name || 'imagem.png')}`
        const { error } = await supabase.storage.from('marcas').upload(caminho, f, { contentType: f.type })
        if (error) setErro(`${f.name}: ${error.message}`)
        else {
          const tipo: Tipo = /icone|logo/i.test(nome) ? 'icone' : tipoNovo
          await supabase.from('midias').insert({ marca_id: marcaId, caminho, descricao: nome.replace(/[-_]+/g, ' '), tags: [tipo] })
        }
        setProgresso({ feito: i + 1, total: validos.length })
      }
      setProgresso(null)
      carregar()
    },
    [marcaId, tipoNovo, carregar],
  )

  // colar uma imagem (Ctrl+V) também envia
  useEffect(() => {
    const colar = (e: ClipboardEvent) => {
      const arquivos = Array.from(e.clipboardData?.files ?? [])
      if (arquivos.length && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        enviar(arquivos)
      }
    }
    window.addEventListener('paste', colar)
    return () => window.removeEventListener('paste', colar)
  }, [enviar])

  const visiveis = useMemo(() => (midias ?? []).filter((m) => filtro === 'todas' || tipoDe(m) === filtro), [midias, filtro])

  // Esc fecha a foto aberta (ou o modal); setas passam as fotos
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return aberta !== null ? setAberta(null) : aoFechar()
      if (aberta === null || !visiveis.length) return
      if (e.key === 'ArrowRight') setAberta((aberta + 1) % visiveis.length)
      if (e.key === 'ArrowLeft') setAberta((aberta - 1 + visiveis.length) % visiveis.length)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aberta, visiveis.length, aoFechar])

  const mudar = async (m: Midia, campos: Partial<Pick<Midia, 'descricao' | 'tags' | 'aprovada'>>) => {
    setMidias((lista) => lista?.map((x) => (x.id === m.id ? { ...x, ...campos } : x)) ?? null)
    const { error } = await supabase!.from('midias').update(campos).eq('id', m.id)
    if (error) {
      setErro(error.message)
      carregar()
    }
  }
  const trocarTipo = (m: Midia, tipo: Tipo) => mudar(m, { tags: [tipo, ...m.tags.filter((t) => !TIPOS.some((x) => x.id === t))] })

  const remover = async (m: Midia) => {
    if (removendo !== m.id) return setRemovendo(m.id)
    setRemovendo(null)
    setMidias((lista) => lista?.filter((x) => x.id !== m.id) ?? null)
    await supabase?.from('midias').delete().eq('id', m.id)
    await supabase?.storage.from('marcas').remove([m.caminho])
  }

  const soltar = (e: DragEvent) => {
    e.preventDefault()
    setArrastando(false)
    enviar(Array.from(e.dataTransfer.files))
  }

  const total = midias?.length ?? 0
  const liberadas = midias?.filter((m) => m.aprovada && tipoDe(m) !== 'inspiracao').length ?? 0
  const conta = (t: Tipo) => midias?.filter((m) => tipoDe(m) === t).length ?? 0
  const temIcone = conta('icone') > 0
  const dicaAtual = filtro === 'todas' ? null : TIPOS.find((t) => t.id === filtro)!.dica
  const foto = aberta !== null ? visiveis[aberta] : null

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div
        className={`modal pm rf${arrastando ? ' arrastando' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setArrastando(false)
        }}
        onDrop={soltar}
        role="dialog"
        aria-label="Referências da marca"
      >
        <header className="pm-topo">
          <span className="pm-avatar" style={{ background: marcaCor ?? 'var(--primary)' }}>{(marcaNome ?? '?').charAt(0).toUpperCase()}</span>
          <div className="pm-titulo">
            <h2>Referências{marcaNome ? ` da ${marcaNome}` : ''}</h2>
            <p className="muted">
              {midias === null ? 'Carregando…' : `${total} ${total === 1 ? 'imagem' : 'imagens'} · ${liberadas} ${liberadas === 1 ? 'liberada' : 'liberadas'} para o designer`}
            </p>
          </div>
          <button type="button" className="fechar" onClick={aoFechar} aria-label="Fechar">×</button>
        </header>

        <nav className="pm-abas" role="tablist">
          <button type="button" role="tab" aria-selected={filtro === 'todas'} className={filtro === 'todas' ? 'ativo' : ''} onClick={() => setFiltro('todas')}>
            Todas <span className="rf-conta">{total}</span>
          </button>
          {TIPOS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={filtro === t.id} className={filtro === t.id ? 'ativo' : ''} onClick={() => setFiltro(t.id)}>
              {t.nome} <span className="rf-conta">{conta(t.id)}</span>
            </button>
          ))}
        </nav>

        <div className="pm-corpo">
          <div className="rf-envio">
            <button type="button" className="rf-solta" onClick={() => entrada.current?.click()} disabled={!!progresso}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
              </svg>
              {progresso ? (
                <span>
                  <strong>Enviando {progresso.feito + 1 > progresso.total ? progresso.total : progresso.feito + 1} de {progresso.total}…</strong>
                  <i className="rf-barra"><b style={{ width: `${(progresso.feito / progresso.total) * 100}%` }} /></i>
                </span>
              ) : (
                <span>
                  <strong>Arraste imagens aqui ou clique para escolher</strong>
                  <small>Também dá para colar com Ctrl+V. PNG, JPG, WebP ou SVG.</small>
                </span>
              )}
            </button>
            <label className="rf-tipo-novo">
              Entram como
              <select value={tipoNovo} onChange={(e) => setTipoNovo(e.target.value as Tipo)}>
                {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </label>
            <input
              ref={entrada}
              type="file"
              accept={ACEITA.join(',')}
              multiple
              hidden
              onChange={(e) => {
                enviar(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
          </div>

          {erro && <p className="aviso">{erro}</p>}
          {midias && !temIcone && filtro !== 'inspiracao' && (
            <p className="pm-nota">Falta o logo. Sem ele, o designer assina os slides só com o nome da marca.</p>
          )}
          {dicaAtual && <p className="pm-dica rf-dica">{dicaAtual}</p>}

          {midias === null ? (
            <p className="muted pm-carregando">Carregando as referências…</p>
          ) : visiveis.length === 0 ? (
            <div className="rf-vazio">
              <strong>{filtro === 'todas' ? 'Nenhuma referência ainda' : `Nada em ${TIPOS.find((t) => t.id === filtro)!.nome.toLowerCase()}`}</strong>
              <p className="muted">O designer só usa imagens daqui. Comece pelo logo e algumas fotos da marca.</p>
            </div>
          ) : (
            <ul className="rf-grade">
              {visiveis.map((m, i) => {
                const tipo = tipoDe(m)
                const inspiracao = tipo === 'inspiracao'
                return (
                  <li key={m.id} className={`rf-card${!m.aprovada && !inspiracao ? ' pausada' : ''}`}>
                    <button type="button" className={`rf-img${tipo === 'icone' ? ' icone' : ''}`} onClick={() => setAberta(i)} aria-label={`Ver ${m.descricao ?? 'imagem'}`}>
                      <img src={urlDe(m.caminho)} alt={m.descricao ?? ''} loading="lazy" />
                      <span className={`rf-selo ${tipo}`}>{TIPOS.find((t) => t.id === tipo)!.nome}</span>
                    </button>
                    <input
                      className="rf-desc"
                      defaultValue={m.descricao ?? ''}
                      placeholder="Descreva a imagem"
                      aria-label="Descrição"
                      onBlur={(e) => e.target.value.trim() !== (m.descricao ?? '') && mudar(m, { descricao: e.target.value.trim() || null })}
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    />
                    <div className="rf-linha">
                      <select value={tipo} onChange={(e) => trocarTipo(m, e.target.value as Tipo)} aria-label="Tipo">
                        {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.curto}</option>)}
                      </select>
                      {!inspiracao && (
                        <label className="rf-chave" title={m.aprovada ? 'O designer pode usar' : 'O designer não usa'}>
                          <input type="checkbox" checked={m.aprovada} onChange={(e) => mudar(m, { aprovada: e.target.checked })} />
                          <i aria-hidden />
                          <span>{m.aprovada ? 'Em uso' : 'Pausada'}</span>
                        </label>
                      )}
                      <button type="button" className={`rf-remover${removendo === m.id ? ' confirmar' : ''}`} onClick={() => remover(m)} onBlur={() => setRemovendo(null)} aria-label="Remover">
                        {removendo === m.id ? 'Remover?' : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <footer className="pm-rodape">
          <span className="pm-estado">Descreva cada imagem: o designer escolhe pela descrição.</span>
          <button type="button" className="primario" onClick={aoFechar}>Pronto</button>
        </footer>

        {arrastando && <div className="rf-arrasto">Solte para enviar como {TIPOS.find((t) => t.id === tipoNovo)!.nome.toLowerCase()}</div>}

        {foto && (
          <div className="rf-luz" onClick={() => setAberta(null)}>
            <img src={urlDe(foto.caminho)} alt={foto.descricao ?? ''} onClick={(e) => e.stopPropagation()} />
            <p>{foto.descricao}</p>
            {visiveis.length > 1 && (
              <>
                <button type="button" className="rf-luz-ant" aria-label="Anterior" onClick={(e) => { e.stopPropagation(); setAberta((aberta! - 1 + visiveis.length) % visiveis.length) }}>‹</button>
                <button type="button" className="rf-luz-prox" aria-label="Próxima" onClick={(e) => { e.stopPropagation(); setAberta((aberta! + 1) % visiveis.length) }}>›</button>
              </>
            )}
            <button type="button" className="rf-luz-fechar" aria-label="Fechar">×</button>
          </div>
        )}
      </div>
    </div>
  )
}
