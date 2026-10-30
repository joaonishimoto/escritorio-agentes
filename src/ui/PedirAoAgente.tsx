import { useEffect, useState } from 'react'
import type { AgenteId } from '../agents/catalogo'
import { chamarApi } from '../lib/api'
import { EXEMPLO_DE_PEDIDO } from '../lib/pedidos'

interface Troca {
  pedido: string
  resposta: string
  custo_usd?: number
}

// a última conversa com cada funcionário fica neste navegador, para não perder ao fechar o painel
const chave = (marcaId: string, agente: string) => `pedido-avulso:${marcaId}:${agente}`
function lerConversa(marcaId: string, agente: string): Troca[] {
  try {
    const x = JSON.parse(localStorage.getItem(chave(marcaId, agente)) ?? '[]')
    return Array.isArray(x) ? x : []
  } catch {
    return []
  }
}
function gravarConversa(marcaId: string, agente: string, trocas: Troca[]) {
  try {
    if (trocas.length) localStorage.setItem(chave(marcaId, agente), JSON.stringify(trocas))
    else localStorage.removeItem(chave(marcaId, agente))
  } catch {
    // sem armazenamento no navegador: a conversa vale só enquanto o painel está aberto
  }
}

const dinheiro = (usd: number) => (usd < 0.01 ? '< US$ 0,01' : `US$ ${usd.toFixed(2).replace('.', ',')}`)

/**
 * No painel de cada funcionário: você pede uma tarefa avulsa (ex.: uma copy de anúncio ao copywriter) sem abrir um post.
 * Ele responde usando o perfil e as regras da marca; dá para pedir ajustes na mesma conversa.
 */
export function PedirAoAgente({ marcaId, agente, nome }: { marcaId: string; agente: AgenteId; nome: string }) {
  const [trocas, setTrocas] = useState<Troca[]>(() => lerConversa(marcaId, agente))
  const [pedido, setPedido] = useState('')
  const [pensando, setPensando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<number | null>(null)

  useEffect(() => {
    setTrocas(lerConversa(marcaId, agente))
    setPedido('')
    setErro(null)
  }, [marcaId, agente])

  const mudar = (novas: Troca[]) => {
    setTrocas(novas)
    gravarConversa(marcaId, agente, novas)
  }

  const pedir = async () => {
    if (!pedido.trim()) return
    setPensando(true)
    setErro(null)
    try {
      const r = await chamarApi<{ resposta: string; custo_usd: number }>('ideias', {
        marca_id: marcaId,
        agente,
        pedido,
        anteriores: trocas.map(({ pedido, resposta }) => ({ pedido, resposta })),
      })
      mudar([...trocas, { pedido: pedido.trim(), resposta: r.resposta, custo_usd: r.custo_usd }])
      setPedido('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu certo')
    } finally {
      setPensando(false)
    }
  }

  const copiar = async (i: number) => {
    try {
      await navigator.clipboard.writeText(trocas[i].resposta)
      setCopiado(i)
      setTimeout(() => setCopiado(null), 1500)
    } catch {
      // sem permissão de área de transferência
    }
  }

  return (
    <section className="ideias pedido-avulso">
      <h3>Pedir ao {nome.toLowerCase()}</h3>
      <p className="muted">Uma tarefa só dele, sem passar pelo fluxo do post. Ele segue o tom de voz e as regras da marca.</p>

      {trocas.map((t, i) => (
        <div key={i} className="pa-troca">
          <p className="pa-pedido">{t.pedido}</p>
          <section className="ag-entrega">
            <header>
              <h3>Resposta{t.custo_usd !== undefined ? <small className="muted"> · {dinheiro(t.custo_usd)}</small> : null}</h3>
              <button className="link" onClick={() => copiar(i)}>{copiado === i ? 'Copiado' : 'Copiar'}</button>
            </header>
            <div className="ag-texto">{t.resposta}</div>
          </section>
        </div>
      ))}

      <textarea
        rows={3}
        placeholder={trocas.length ? 'Peça um ajuste, ex.: deixe mais curto e mais direto' : EXEMPLO_DE_PEDIDO[agente]}
        value={pedido}
        onChange={(e) => setPedido(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) pedir()
        }}
      />
      <div className="ideia-acoes">
        <button className="primario" disabled={pensando || !pedido.trim()} onClick={pedir}>
          {pensando ? 'Trabalhando…' : trocas.length ? 'Pedir ajuste' : 'Pedir'}
        </button>
        {trocas.length > 0 && !pensando && (
          <button className="secundario" onClick={() => mudar([])}>Novo pedido</button>
        )}
      </div>
      {erro && <p className="aviso">{erro}</p>}
    </section>
  )
}
