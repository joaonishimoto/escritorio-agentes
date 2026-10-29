import { useState } from 'react'
import { AGENTES } from '../agents/catalogo'
import { chamarApi } from '../lib/api'
import { decidirRegra, moverRegra, useRegrasDaMarca, type Regra } from '../lib/dados'

/** Acima disso o mural avisa: cada regra ativa entra no prompt do agente em todo post. */
const MUITAS = 15

interface Proposta {
  novas: { regra: string; motivo: string; substitui: string[] }[]
  ficam: string[]
}

const GRUPOS = [...AGENTES.map((a) => ({ id: a.id as string, nome: a.nome })), { id: 'todos', nome: 'Toda a equipe' }]
const CONHECIDOS = new Set(GRUPOS.map((g) => g.id))

/** Mural de regras da sala: o que a equipe aprendeu com as suas correções, por agente. */
export function RegrasDaMarca({ marcaId, nomeMarca, aoFechar, aoMudar }: { marcaId: string; nomeMarca: string; aoFechar: () => void; aoMudar: () => void }) {
  const [versao, setVersao] = useState(0)
  const regras = useRegrasDaMarca(marcaId, versao)
  const [busca, setBusca] = useState('')
  const recarregar = () => {
    setVersao((v) => v + 1)
    aoMudar()
  }
  const decidir = async (id: string, status: 'ativa' | 'arquivada') => {
    await decidirRegra(id, status)
    recarregar()
  }
  const mover = async (id: string, agente: string) => {
    await moverRegra(id, agente)
    recarregar()
  }

  const termo = busca.trim().toLowerCase()
  const visiveis = (regras ?? []).filter((r) => !termo || `${r.regra} ${r.motivo ?? ''}`.toLowerCase().includes(termo))
  const perdidas = visiveis.filter((r) => !CONHECIDOS.has(r.agente))
  const grupos = GRUPOS.map((g) => ({ ...g, itens: (regras ?? []).filter((r) => r.agente === g.id) })).filter((g) => g.itens.length)
  const ativas = (regras ?? []).filter((r) => r.status === 'ativa').length
  const propostas = (regras ?? []).length - ativas

  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div className="modal modal-largo" onClick={(e) => e.stopPropagation()}>
        <h2>Regras de {nomeMarca}</h2>
        <p className="muted">O que a equipe aprendeu com as suas correções. As ativas valem em todo post; as propostas esperam o seu ok.</p>
        {regras === null && <p className="muted">Carregando…</p>}
        {regras?.length === 0 && <p className="muted">Nenhuma regra ainda. Quando você pedir um ajuste, o curador transforma em regra aqui.</p>}
        {!!regras?.length && (
          <div className="regras-topo">
            <span className="muted">
              {ativas} ativa{ativas === 1 ? '' : 's'}
              {propostas > 0 && ` · ${propostas} esperando o seu ok`}
            </span>
            <input type="search" placeholder="Buscar regra" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        )}
        {termo && !visiveis.length && <p className="muted">Nenhuma regra com “{busca.trim()}”.</p>}

        {perdidas.length > 0 && (
          <section>
            <h3>Sem agente certo</h3>
            <p className="muted">O curador anotou estas para um agente que não existe, então nenhum agente lê. Passe para o agente certo.</p>
            <ul className="regras">
              {perdidas.map((r) => (
                <li key={r.id}>
                  <span className="chip">{r.agente}</span>
                  <p>{r.regra}</p>
                  {r.motivo && <p className="muted">{r.motivo}</p>}
                  <div className="acoes">
                    <button className="secundario" onClick={() => decidir(r.id, 'arquivada')}>Arquivar</button>
                    <select aria-label="Passar para" value="" onChange={(e) => e.target.value && mover(r.id, e.target.value)}>
                      <option value="">Passar para…</option>
                      {GRUPOS.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {grupos.map((g) => (
          <GrupoDeRegras key={g.id} marcaId={marcaId} agente={g.id} nome={g.nome} todas={g.itens} termo={termo} aoDecidir={decidir} aoJuntar={recarregar} />
        ))}
        <div className="acoes">
          <button className="primario" onClick={aoFechar}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

function GrupoDeRegras(props: {
  marcaId: string
  agente: string
  nome: string
  /** todas as regras do agente (a busca filtra aqui dentro, para não perder a proposta aberta) */
  todas: Regra[]
  termo: string
  aoDecidir: (id: string, status: 'ativa' | 'arquivada') => void
  aoJuntar: () => void
}) {
  const { marcaId, agente, nome, todas, termo, aoDecidir, aoJuntar } = props
  const buscando = !!termo
  const itens = todas.filter((r) => !termo || `${r.regra} ${r.motivo ?? ''}`.toLowerCase().includes(termo))
  const ativas = todas.filter((r) => r.status === 'ativa').length
  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [ocupado, setOcupado] = useState<'pensando' | 'gravando' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const texto = new Map(todas.map((r) => [r.id, r.regra]))

  const juntar = async () => {
    setOcupado('pensando')
    setErro(null)
    try {
      const r = await chamarApi<{ proposta: Proposta }>('marcas', { acao: 'juntar_regras', id: marcaId, agente })
      setProposta(r.proposta)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu certo')
    } finally {
      setOcupado(null)
    }
  }
  const aplicar = async () => {
    if (!proposta) return
    setOcupado('gravando')
    setErro(null)
    try {
      await chamarApi('marcas', { acao: 'aplicar_regras', id: marcaId, agente, novas: proposta.novas })
      setProposta(null)
      aoJuntar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu certo')
    } finally {
      setOcupado(null)
    }
  }
  const antes = proposta ? proposta.novas.reduce((n, x) => n + x.substitui.length, 0) : 0
  if (!itens.length && !proposta) return null

  return (
    <section>
      <div className="regras-cabeca">
        <h3>
          {nome} <span className={`chip${ativas > MUITAS ? ' chip-alerta' : ''}`}>{ativas} ativa{ativas === 1 ? '' : 's'}</span>
        </h3>
        {ativas >= 3 && !proposta && !buscando && (
          <button className="secundario" disabled={!!ocupado} onClick={juntar}>
            {ocupado === 'pensando' ? 'Juntando…' : 'Juntar parecidas'}
          </button>
        )}
      </div>
      {ativas > MUITAS && !proposta && (
        <p className="muted">São muitas regras para um agente só: todas entram em cada post e deixam o trabalho mais lento e caro. Junte as parecidas.</p>
      )}
      {erro && <p className="aviso">{erro}</p>}
      {proposta && (
        <div className="regras-proposta">
          {proposta.novas.length === 0 ? (
            <p>Não achei regras parecidas para juntar. Está tudo como deveria.</p>
          ) : (
            <>
              <p>
                <strong>
                  {antes} regras viram {proposta.novas.length}.
                </strong>{' '}
                {proposta.ficam.length > 0 && <span className="muted">As outras {proposta.ficam.length} ficam como estão.</span>}
              </p>
              <ul className="regras">
                {proposta.novas.map((n, i) => (
                  <li key={i}>
                    <p>{n.regra}</p>
                    <details>
                      <summary className="muted">Junta {n.substitui.length === 1 ? '1 regra' : `${n.substitui.length} regras`}</summary>
                      <ul className="regras-antigas">
                        {n.substitui.map((id) => (
                          <li key={id}>{texto.get(id) ?? 'regra que não está mais na lista'}</li>
                        ))}
                      </ul>
                    </details>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="acoes">
            <button className="secundario" disabled={!!ocupado} onClick={() => setProposta(null)}>
              {proposta.novas.length ? 'Deixar como está' : 'Fechar'}
            </button>
            {proposta.novas.length > 0 && (
              <button className="primario" disabled={!!ocupado} onClick={aplicar}>
                {ocupado === 'gravando' ? 'Gravando…' : 'Usar estas regras'}
              </button>
            )}
          </div>
          {proposta.novas.length > 0 && <p className="muted">As regras antigas vão para o arquivo, não somem.</p>}
        </div>
      )}
      <ul className="regras">
        {itens.map((r) => (
          <li key={r.id}>
            {r.status === 'proposta' && <span className="chip">proposta</span>}
            <p>{r.regra}</p>
            {r.motivo && <p className="muted">{r.motivo}</p>}
            <div className="acoes">
              {r.status === 'proposta' ? (
                <>
                  <button className="secundario" onClick={() => aoDecidir(r.id, 'arquivada')}>Descartar</button>
                  <button className="primario" onClick={() => aoDecidir(r.id, 'ativa')}>Aceitar</button>
                </>
              ) : (
                <button className="secundario" onClick={() => aoDecidir(r.id, 'arquivada')}>Arquivar</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
