import { useState, type ClipboardEvent, type FormEvent } from 'react'
import { chamarApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Post } from '../lib/dados'

type Ref = { tipo: 'imagem'; url: string } | { tipo: 'link'; url: string }

export function NovoPost({ marcaId, neutra, inicial, aoCriar, aoFechar }: { marcaId: string; neutra?: boolean; inicial?: string; aoCriar: (p: Post) => void; aoFechar: () => void }) {
  const [briefing, setBriefing] = useState(inicial ?? '')
  const [refs, setRefs] = useState<Ref[]>([])
  const [link, setLink] = useState('')
  const [subindo, setSubindo] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const subir = async (arquivos: File[]) => {
    if (!supabase) return
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

  const addLink = () => {
    const u = link.trim()
    if (!/^https?:\/\//i.test(u)) return setErro('O link precisa começar com http:// ou https://')
    setRefs((r) => [...r, { tipo: 'link', url: u }])
    setLink('')
    setErro(null)
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (neutra && refs.length === 0) return setErro('Na sala neutra, mande pelo menos uma referência')
    setEnviando(true)
    setErro(null)
    try {
      const { post } = await chamarApi<{ post: Post }>('posts', { marca_id: marcaId, briefing, referencias: refs })
      aoCriar(post)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não deu para criar o post')
      setEnviando(false)
    }
  }

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <form className="modal" onSubmit={enviar} onClick={(e) => e.stopPropagation()} onPaste={colar}>
        <h2>Novo post</h2>
        <label htmlFor="briefing">O que você quer postar?</label>
        <textarea
          id="briefing"
          rows={4}
          required
          autoFocus
          placeholder={neutra ? 'Ex.: carrossel no estilo dessas referências sobre…' : 'Ex.: carrossel sobre a história do Negroni, com a receita no final'}
          value={briefing}
          onChange={(e) => setBriefing(e.target.value)}
        />

        <label>Referências {neutra ? '(obrigatório na sala neutra)' : '(opcional)'}</label>
        <p className="muted dica">Imagens de estilo, posts que você gostou, prints, links. Dá para colar imagem com Ctrl/⌘+V.</p>
        {refs.length > 0 && (
          <ul className="refs">
            {refs.map((r, i) => (
              <li key={r.url}>
                {r.tipo === 'imagem' ? <img src={r.url} alt={`Referência ${i + 1}`} /> : <a href={r.url} target="_blank" rel="noreferrer">{r.url.replace(/^https?:\/\//, '').slice(0, 40)}</a>}
                <button type="button" className="fechar" aria-label="Tirar referência" onClick={() => setRefs((x) => x.filter((_, n) => n !== i))}>×</button>
              </li>
            ))}
          </ul>
        )}
        <div className="refs-acoes">
          <label className="botao-arquivo secundario">
            {subindo ? `Subindo ${subindo}…` : 'Adicionar imagens'}
            <input type="file" accept="image/*" multiple onChange={(e) => { void subir(Array.from(e.target.files ?? [])); e.target.value = '' }} />
          </label>
          <input
            className="refs-link"
            placeholder="Colar um link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
          />
          <button type="button" className="secundario" disabled={!link.trim()} onClick={addLink}>Adicionar</button>
        </div>

        {erro && <p className="aviso">{erro}</p>}
        <div className="acoes">
          <button type="button" className="secundario" onClick={aoFechar}>Cancelar</button>
          <button className="primario" disabled={enviando || subindo > 0}>{enviando ? 'Chamando a equipe…' : 'Pôr a equipe para trabalhar'}</button>
        </div>
      </form>
    </div>
  )
}
