import { useState } from 'react'
import { chamarApi } from '../lib/api'
import { useIdeiasGuardadas, type Ideia } from '../lib/ideias'

/**
 * No painel do pesquisador: você dá uma linha e ele sugere ideias; escolher uma abre o Novo post já preenchido.
 * Cada ideia pode ser guardada para usar depois, sem pedir de novo.
 */
export function PedirIdeias({ marcaId, aoUsar }: { marcaId: string; aoUsar: (ideia: Ideia, guardadaId?: string) => void }) {
  const [linha, setLinha] = useState('')
  const [ideias, setIdeias] = useState<Ideia[]>([])
  const [pensando, setPensando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const guardadas = useIdeiasGuardadas(marcaId)

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
      {guardadas.ideias.length > 0 && (
        <>
          <h3>Ideias guardadas</h3>
          <p className="muted">Sugestões que você guardou para usar depois.</p>
          <ul className="ideias-lista">
            {guardadas.ideias.map((i) => (
              <li key={i.id}>
                <div>
                  <strong>{i.titulo}</strong> <span className="chip">{i.formato}</span>
                </div>
                <p className="muted">“{i.gancho}”</p>
                <div className="ideia-acoes">
                  <button className="primario" onClick={() => aoUsar(i, i.id)}>Criar este post</button>
                  <button className="secundario" onClick={() => guardadas.tirar(i.id)}>Tirar</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
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
      {(erro ?? guardadas.erro) && <p className="aviso">{erro ?? guardadas.erro}</p>}
      {ideias.length > 0 && (
        <ul className="ideias-lista">
          {ideias.map((i) => {
            const g = guardadas.guardada(i)
            return (
              <li key={i.titulo}>
                <div>
                  <strong>{i.titulo}</strong> <span className="chip">{i.formato}</span>
                </div>
                <p className="muted">“{i.gancho}”</p>
                <div className="ideia-acoes">
                  <button className="primario" onClick={() => aoUsar(i, g?.id)}>Criar este post</button>
                  <button className="secundario" onClick={() => (g ? guardadas.tirar(g.id) : guardadas.guardar(i))}>{g ? 'Guardada ✓' : 'Guardar para depois'}</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
