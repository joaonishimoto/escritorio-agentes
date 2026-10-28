import { useState } from 'react'
import { chamarApi } from '../lib/api'

interface Ideia {
  titulo: string
  formato: string
  gancho: string
  briefing: string
}

/** No painel do pesquisador: você dá uma linha e ele sugere ideias; escolher uma abre o Novo post já preenchido. */
export function PedirIdeias({ marcaId, aoUsar }: { marcaId: string; aoUsar: (briefing: string) => void }) {
  const [linha, setLinha] = useState('')
  const [ideias, setIdeias] = useState<Ideia[]>([])
  const [pensando, setPensando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const pedir = async () => {
    setPensando(true)
    setErro(null)
    try {
      const r = await chamarApi<{ ideias: Ideia[] }>('ideias', { marca_id: marcaId, linha })
      setIdeias(r.ideias)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu certo')
    } finally {
      setPensando(false)
    }
  }

  return (
    <section className="ideias">
      <h3>Pedir ideias de posts</h3>
      <textarea
        rows={2}
        placeholder="Uma linha para seguir, ex.: drinks com 3 ingredientes para o verão"
        value={linha}
        onChange={(e) => setLinha(e.target.value)}
      />
      <button className="secundario" disabled={pensando} onClick={pedir}>
        {pensando ? 'Pensando…' : ideias.length ? 'Pedir outras ideias' : 'Pedir ideias'}
      </button>
      {erro && <p className="aviso">{erro}</p>}
      {ideias.length > 0 && (
        <ul className="ideias-lista">
          {ideias.map((i) => (
            <li key={i.titulo}>
              <div>
                <strong>{i.titulo}</strong> <span className="chip">{i.formato}</span>
              </div>
              <p className="muted">“{i.gancho}”</p>
              <button className="primario" onClick={() => aoUsar(i.briefing)}>Criar este post</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
