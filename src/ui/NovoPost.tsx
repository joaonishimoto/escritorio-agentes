import { useState, type FormEvent } from 'react'
import { chamarApi } from '../lib/api'
import type { Post } from '../lib/dados'

export function NovoPost({ marcaId, aoCriar, aoFechar }: { marcaId: string; aoCriar: (p: Post) => void; aoFechar: () => void }) {
  const [briefing, setBriefing] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      const { post } = await chamarApi<{ post: Post }>('posts', { marca_id: marcaId, briefing })
      aoCriar(post)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não deu para criar o post')
      setEnviando(false)
    }
  }

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <form className="modal" onSubmit={enviar} onClick={(e) => e.stopPropagation()}>
        <h2>Novo post</h2>
        <label htmlFor="briefing">O que você quer postar?</label>
        <textarea
          id="briefing"
          rows={5}
          required
          autoFocus
          placeholder="Ex.: carrossel sobre a história do Negroni, com a receita no final"
          value={briefing}
          onChange={(e) => setBriefing(e.target.value)}
        />
        {erro && <p className="aviso">{erro}</p>}
        <div className="acoes">
          <button type="button" className="secundario" onClick={aoFechar}>Cancelar</button>
          <button className="primario" disabled={enviando}>{enviando ? 'Chamando a equipe…' : 'Pôr a equipe para trabalhar'}</button>
        </div>
      </form>
    </div>
  )
}
