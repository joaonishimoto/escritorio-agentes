import { useEffect, useState, type FormEvent } from 'react'
import { chamarApi } from '../lib/api'

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

const HEX = /^#[0-9a-f]{6}$/i
// chaves que têm campo próprio ou que o app cuida sozinho
const FORA_DAS_REGRAS = ['cores', 'fonte', 'cor_sala', 'instagram', 'instagram_conectado_em', 'neutra', 'tom_editado']

const rotulo = (k: string) => (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, ' ')
const chave = (r: string) => r.trim().toLowerCase().replace(/\s+/g, '_')

/** Perfil da marca que os agentes seguem: tom de voz, cores, fontes, regras visuais, legenda e checklist do revisor. */
export function PerfilDaMarca({ marcaId, aoFechar, aoSalvar }: { marcaId: string; aoFechar: () => void; aoSalvar: () => void }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
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
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  const preencher = (p: Perfil) => {
    const id = p.identidade ?? {}
    setPerfil(p)
    setNome(p.nome)
    setInstagram(p.instagram_usuario ? `@${p.instagram_usuario}` : '')
    setCorSala(typeof id.cor_sala === 'string' && HEX.test(id.cor_sala) ? id.cor_sala : '#1e3d66')
    setTom(p.tom_de_voz ?? '')
    const c = id.cores && typeof id.cores === 'object' && !Array.isArray(id.cores) ? (id.cores as Record<string, unknown>) : {}
    setCores(Object.entries(c).filter(([, v]) => typeof v === 'string' && HEX.test(v)).map(([k, v]) => ({ chave: k, valor: v as string })))
    setFonte(typeof id.fonte === 'string' ? id.fonte : '')
    setRegras(Object.entries(id).filter(([k, v]) => !FORA_DAS_REGRAS.includes(k) && typeof v === 'string').map(([k, v]) => ({ chave: rotulo(k), valor: v as string })))
    setHashtags((p.hashtags_fixas ?? []).join(' '))
    setAviso(p.aviso_final ?? '')
    setChecklist(p.checklist_revisor ?? '')
  }

  useEffect(() => {
    chamarApi<{ marca: Perfil }>('marcas', { acao: 'ler', id: marcaId })
      .then(({ marca }) => preencher(marca))
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não deu para abrir a marca'))
  }, [marcaId])

  const neutra = Boolean(perfil?.identidade?.neutra)

  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    if (!perfil) return
    setSalvando(true)
    setErro(null)
    // começa da identidade atual para não perder o que não aparece no formulário (formatos, listas…)
    const antiga = perfil.identidade ?? {}
    const identidade: Record<string, unknown> = Object.fromEntries(Object.entries(antiga).filter(([, v]) => typeof v !== 'string'))
    for (const k of ['cor_sala', 'instagram', 'instagram_conectado_em']) if (k in antiga) identidade[k] = antiga[k]
    identidade.cor_sala = corSala
    const coresAntigas = antiga.cores && typeof antiga.cores === 'object' && !Array.isArray(antiga.cores) ? (antiga.cores as Record<string, unknown>) : {}
    const outrasCores = Object.fromEntries(Object.entries(coresAntigas).filter(([, v]) => !(typeof v === 'string' && HEX.test(v))))
    const novasCores = Object.fromEntries(cores.filter((c) => c.chave.trim() && HEX.test(c.valor)).map((c) => [chave(c.chave), c.valor]))
    if (Object.keys(novasCores).length || Object.keys(outrasCores).length) identidade.cores = { ...novasCores, ...outrasCores }
    else delete identidade.cores
    if (fonte.trim()) identidade.fonte = fonte.trim()
    for (const r of regras) if (r.chave.trim() && r.valor.trim()) identidade[chave(r.chave)] = r.valor.trim()
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

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <form className="modal modal-largo perfil-marca" onSubmit={salvar} onClick={(e) => e.stopPropagation()}>
        <header className="painel-topo">
          <div>
            <h2>Marca{perfil ? `: ${perfil.nome}` : ''}</h2>
            <p className="muted">Tudo aqui vai para os agentes em cada post. Mudou, salvou, o próximo post já usa.</p>
          </div>
          <button type="button" className="fechar" onClick={aoFechar} aria-label="Fechar">×</button>
        </header>

        {!perfil && !erro && <p className="muted">Carregando…</p>}
        {perfil && (
          <>
            <section className="perfil-secao">
              <h3>Básico</h3>
              <div className="perfil-linha">
                <div className="perfil-campo">
                  <label htmlFor="pm-nome">Nome</label>
                  <input id="pm-nome" required maxLength={40} value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="perfil-campo">
                  <label htmlFor="pm-ig">Instagram</label>
                  <input id="pm-ig" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@conta" />
                </div>
                <div className="perfil-campo estreito">
                  <label htmlFor="pm-sala">Cor da sala</label>
                  <input id="pm-sala" type="color" value={corSala} onChange={(e) => setCorSala(e.target.value)} />
                </div>
              </div>
            </section>

            {neutra && <p className="muted">Sala neutra: os agentes seguem as referências de cada pedido. O que você preencher aqui vale como base.</p>}

            <section className="perfil-secao">
              <h3>Tom de voz</h3>
              <p className="dica muted">Como a marca fala, para quem, o que evitar. Redator, chefe de pauta e revisor seguem isto.</p>
              <textarea rows={8} value={tom} onChange={(e) => setTom(e.target.value)} placeholder="Frases curtas, português do dia a dia…" />
            </section>

            <section className="perfil-secao">
              <h3>Identidade visual</h3>
              <p className="dica muted">O designer usa estas cores, a fonte e as regras visuais em todos os slides.</p>
              <label>Cores</label>
              <ul className="perfil-cores">
                {cores.map((c, i) => (
                  <li key={i}>
                    <input type="color" value={c.valor} onChange={(e) => mudarItem(cores, setCores, i, 'valor', e.target.value)} aria-label={`Cor ${c.chave}`} />
                    <input value={c.chave} onChange={(e) => mudarItem(cores, setCores, i, 'chave', e.target.value)} placeholder="Nome (ex.: fundo)" />
                    <code className="muted">{c.valor.toUpperCase()}</code>
                    <button type="button" className="fechar" onClick={() => setCores(cores.filter((_, j) => j !== i))} aria-label="Remover cor">×</button>
                  </li>
                ))}
              </ul>
              <button type="button" className="secundario perfil-mais" onClick={() => setCores([...cores, { chave: '', valor: '#000000' }])}>+ Cor</button>
              <label htmlFor="pm-fonte">Fonte</label>
              <input id="pm-fonte" value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="Ex.: Inter (títulos em bold)" />
              <label>Regras visuais</label>
              <ul className="perfil-regras">
                {regras.map((r, i) => (
                  <li key={i}>
                    <input value={r.chave} onChange={(e) => mudarItem(regras, setRegras, i, 'chave', e.target.value)} placeholder="Assunto (ex.: Fotos)" />
                    <textarea rows={2} value={r.valor} onChange={(e) => mudarItem(regras, setRegras, i, 'valor', e.target.value)} placeholder="O que seguir" />
                    <button type="button" className="fechar" onClick={() => setRegras(regras.filter((_, j) => j !== i))} aria-label="Remover regra">×</button>
                  </li>
                ))}
              </ul>
              <button type="button" className="secundario perfil-mais" onClick={() => setRegras([...regras, { chave: '', valor: '' }])}>+ Regra visual</button>
            </section>

            <section className="perfil-secao">
              <h3>Legenda</h3>
              <label htmlFor="pm-hash">Hashtags fixas</label>
              <input id="pm-hash" value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#marca #assunto" />
              <label htmlFor="pm-aviso">Aviso no fim da legenda</label>
              <input id="pm-aviso" value={aviso} onChange={(e) => setAviso(e.target.value)} placeholder="Ex.: Aprecie com moderação." />
            </section>

            <section className="perfil-secao">
              <h3>Checklist do revisor</h3>
              <p className="dica muted">O revisor confere cada item antes de mandar o post para você.</p>
              <textarea rows={7} value={checklist} onChange={(e) => setChecklist(e.target.value)} />
            </section>
          </>
        )}

        {erro && <p className="aviso">{erro}</p>}
        <div className="acoes">
          {salvo && <span className="muted perfil-salvo">Salvo</span>}
          <button type="button" className="secundario" onClick={aoFechar}>Fechar</button>
          <button type="submit" className="primario" disabled={!perfil || salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </div>
  )
}
