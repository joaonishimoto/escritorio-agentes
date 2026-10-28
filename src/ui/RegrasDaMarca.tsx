import { useState } from 'react'
import { AGENTES } from '../agents/catalogo'
import { decidirRegra, useRegrasDaMarca } from '../lib/dados'

/** Mural de regras da sala: o que a equipe aprendeu com as suas correções, por agente. */
export function RegrasDaMarca({ marcaId, nomeMarca, aoFechar, aoMudar }: { marcaId: string; nomeMarca: string; aoFechar: () => void; aoMudar: () => void }) {
  const [versao, setVersao] = useState(0)
  const regras = useRegrasDaMarca(marcaId, versao)
  const decidir = async (id: string, status: 'ativa' | 'arquivada') => {
    await decidirRegra(id, status)
    setVersao((v) => v + 1)
    aoMudar()
  }
  const grupos = [...AGENTES.map((a) => ({ id: a.id as string, nome: a.nome })), { id: 'todos', nome: 'Toda a equipe' }]
    .map((g) => ({ ...g, itens: (regras ?? []).filter((r) => r.agente === g.id) }))
    .filter((g) => g.itens.length)

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal modal-largo" onClick={(e) => e.stopPropagation()}>
        <h2>Regras de {nomeMarca}</h2>
        <p className="muted">O que a equipe aprendeu com as suas correções. As ativas valem em todo post; as propostas esperam o seu ok.</p>
        {regras === null && <p className="muted">Carregando…</p>}
        {regras?.length === 0 && <p className="muted">Nenhuma regra ainda. Quando você pedir um ajuste, o curador transforma em regra aqui.</p>}
        {grupos.map((g) => (
          <section key={g.id}>
            <h3>{g.nome}</h3>
            <ul className="regras">
              {g.itens.map((r) => (
                <li key={r.id}>
                  {r.status === 'proposta' && <span className="chip">proposta</span>}
                  <p>{r.regra}</p>
                  {r.motivo && <p className="muted">{r.motivo}</p>}
                  <div className="acoes">
                    {r.status === 'proposta' ? (
                      <>
                        <button className="secundario" onClick={() => decidir(r.id, 'arquivada')}>Descartar</button>
                        <button className="primario" onClick={() => decidir(r.id, 'ativa')}>Aceitar</button>
                      </>
                    ) : (
                      <button className="secundario" onClick={() => decidir(r.id, 'arquivada')}>Arquivar</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <div className="acoes">
          <button className="primario" onClick={aoFechar}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
