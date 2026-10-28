import { useEffect, useState, type ReactNode } from 'react'
import { AGENTES, agentePorId, type AgenteId } from '../agents/catalogo'
import { useEscritorio } from '../store/escritorio'
import { COR_ESTADO } from '../office/EstacaoAgente'
import { AcoesDeErro } from './PostComErro'
import { PedirIdeias } from './PedirIdeias'
import type { Post } from '../lib/dados'

const ROTULO_ESTADO = {
  ocioso: 'Livre',
  na_fila: 'Na fila',
  trabalhando: 'Trabalhando',
  concluido: 'Concluído',
  esperando_voce: 'Esperando você',
  erro: 'Erro',
} as const

const MODELO: Record<string, string> = { 'claude-opus-5-5': 'Opus', 'claude-sonnet-5-5': 'Sonnet', 'claude-haiku-5-5': 'Haiku' }
const ATIVOS = ['trabalhando', 'na_fila', 'esperando_voce']
// ordem do fluxo de um post, para mostrar onde o agente entra
const FLUXO: AgenteId[] = ['chefe', 'pesquisador', 'redator', 'designer', 'cinegrafista', 'revisor', 'publicador']

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
function duracao(seg: number) {
  if (seg < 60) return `${Math.max(1, Math.round(seg))}s`
  const m = Math.floor(seg / 60)
  const s = Math.round(seg % 60)
  return s ? `${m}min ${s}s` : `${m}min`
}
const dinheiro = (usd: number) => (usd < 0.01 ? '< US$ 0,01' : `US$ ${usd.toFixed(2).replace('.', ',')}`)

/** Ícone do ofício de cada agente. */
function Icone({ id }: { id: string }) {
  const p = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  const caminhos: Record<string, ReactNode> = {
    chefe: (<><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M8.5 10h7M8.5 14h7M8.5 18h4" /></>),
    pesquisador: (<><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>),
    redator: (<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>),
    designer: (<><path d="M12 3a9 9 0 1 0 0 18c1.3 0 2-.7 2-1.6 0-1.2-1-1.5-1-2.6 0-1 .8-1.6 1.8-1.6H17c2.3 0 4-1.6 4-4.2C21 6.7 17 3 12 3Z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10.5" cy="7.2" r="1" /><circle cx="15" cy="8" r="1" /></>),
    cinegrafista: (<><rect x="3" y="7" width="13" height="11" rx="2" /><path d="m16 11 5-3v9l-5-3" /></>),
    revisor: (<><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.7 2.7L16.5 9.5" /></>),
    publicador: (<><path d="M21 3 3 10.5l7 2.5 2.5 7z" /><path d="m10 13 4-4" /></>),
    curador: (<><path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h10" /></>),
  }
  return <svg {...p}>{caminhos[id] ?? <circle cx="12" cy="12" r="8" />}</svg>
}

/** Quebra a saída do agente em campos ("Formato: …", "Ângulo: …") quando ela vem nesse jeito; senão, em parágrafos. */
function emCampos(texto: string) {
  const blocos: { rotulo?: string; texto: string }[] = []
  for (const linha of texto.split('\n')) {
    const m = linha.match(/^\s*(?:[-*]\s*)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ ]{1,28}):\s*(.*)$/)
    if (m) blocos.push({ rotulo: m[1], texto: m[2] })
    else if (linha.trim()) {
      const ultimo = blocos[blocos.length - 1]
      if (ultimo) ultimo.texto += (ultimo.texto ? '\n' : '') + linha
      else blocos.push({ texto: linha })
    } else if (blocos.length && blocos[blocos.length - 1].texto) blocos.push({ texto: '' })
  }
  return blocos.filter((b) => b.texto.trim() || b.rotulo)
}

type Aba = 'agora' | 'historico' | 'ideias'

export function PainelAgente({
  post,
  aoMudar,
  marcaId,
  aoUsarIdeia,
  porAgente,
}: {
  post?: Post | null
  aoMudar?: () => void
  marcaId?: string | null
  aoUsarIdeia?: (briefing: string) => void
  porAgente?: { agente: string; custo: number; segundos: number }[]
}) {
  const id = useEscritorio((s) => s.selecionado)
  const estados = useEscritorio((s) => s.estados)
  const acao = useEscritorio((s) => (id ? s.acaoAtual[id] : undefined))
  const rascunho = useEscritorio((s) => (id ? s.rascunho[id] : undefined))
  const eventos = useEscritorio((s) => s.eventos)
  const selecionar = useEscritorio((s) => s.selecionar)
  const [aba, setAba] = useState<Aba>('agora')
  const [copiado, setCopiado] = useState(false)

  // trocou de agente: volta para a primeira aba
  useEffect(() => setAba('agora'), [id])

  if (!id) return null
  const a = agentePorId(id)
  const estado = estados[id] ?? 'ocioso'
  const meus = eventos.filter((e) => e.agente === id && e.tipo !== 'texto')
  const historico = meus.slice().reverse()
  const ativo = ATIVOS.includes(estado)
  const inicio = meus[0]?.criado_em
  const fim = meus[meus.length - 1]?.criado_em
  const uso = porAgente?.find((u) => u.agente === id)
  const levou = uso?.segundos ?? (inicio && fim ? (new Date(fim).getTime() - new Date(inicio).getTime()) / 1000 : 0)
  const fluxo = FLUXO.filter((f) => AGENTES.some((x) => x.id === f) && (f !== 'cinegrafista' || estados.cinegrafista !== 'ocioso' || id === 'cinegrafista'))
  const noFluxo = fluxo.includes(id)
  const anterior = noFluxo ? fluxo[fluxo.indexOf(id) - 1] : undefined

  const copiar = async () => {
    if (!rascunho) return
    try {
      await navigator.clipboard.writeText(rascunho)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // sem permissão de área de transferência
    }
  }

  const abas: { id: Aba; nome: string; conta?: number }[] = [
    { id: 'agora', nome: ativo ? 'Agora' : 'Neste post' },
    { id: 'historico', nome: 'Histórico', conta: historico.length },
    ...(id === 'pesquisador' && marcaId && aoUsarIdeia ? [{ id: 'ideias' as Aba, nome: 'Ideias de posts' }] : []),
  ]

  return (
    <aside className="painel ag" aria-label={`Detalhes do ${a.nome}`} style={{ ['--cor-agente' as string]: a.cor, ['--cor-estado' as string]: COR_ESTADO[estado] }}>
      <header className="ag-capa">
        <button className="ag-fechar" onClick={() => selecionar(null)} aria-label="Fechar painel">×</button>
        <span className={`ag-icone ${estado}`}>
          <Icone id={id} />
        </span>
        <div className="ag-nome">
          <h2>{a.nome}</h2>
          <p>{a.papel}</p>
        </div>
      </header>

      <div className="ag-fatos">
        <div>
          <span>Status</span>
          <strong className="ag-estado">
            <i />
            {ROTULO_ESTADO[estado]}
          </strong>
        </div>
        <div>
          <span>Tempo</span>
          <strong>{levou > 0 ? duracao(levou) : '—'}</strong>
        </div>
        <div>
          <span>Custo</span>
          <strong>{uso ? dinheiro(uso.custo) : '—'}</strong>
        </div>
        <div>
          <span>Modelo</span>
          <strong>{a.modelo ? MODELO[a.modelo] ?? a.modelo : 'Sem IA'}</strong>
        </div>
      </div>

      {noFluxo && (
        <ol className="ag-fluxo" aria-label="Onde ele entra no post">
          {fluxo.map((f) => (
            <li key={f} className={`${estados[f] ?? 'ocioso'}${f === id ? ' eu' : ''}`} title={`${agentePorId(f).nome}: ${ROTULO_ESTADO[estados[f] ?? 'ocioso']}`}>
              <button onClick={() => selecionar(f)} aria-label={agentePorId(f).nome}>
                <Icone id={f} />
              </button>
            </li>
          ))}
        </ol>
      )}

      {estado === 'erro' && post?.status === 'erro' && aoMudar && (
        <div className="ag-erro">
          <AcoesDeErro post={post} agente={id} aoMudar={aoMudar} />
        </div>
      )}

      <nav className="ag-abas" role="tablist">
        {abas.map((x) => (
          <button key={x.id} role="tab" aria-selected={aba === x.id} className={aba === x.id ? 'ativo' : ''} onClick={() => setAba(x.id)}>
            {x.nome}
            {x.conta ? <span>{x.conta}</span> : null}
          </button>
        ))}
      </nav>

      <div className="ag-corpo">
        {aba === 'agora' && (
          <>
            {ativo && (
              <div className="ag-ao-vivo">
                <span className="ag-pulso" aria-hidden />
                <div>
                  <small>{estado === 'na_fila' ? 'Na fila' : estado === 'esperando_voce' ? 'Esperando você' : 'Fazendo agora'}</small>
                  <p>{acao || 'Começando…'}</p>
                </div>
              </div>
            )}
            {!ativo && estado === 'concluido' && fim && (
              <p className="ag-linha-fim">
                <span>✓</span> Entregou às {hora(fim)}
              </p>
            )}
            {rascunho ? (
              <section className="ag-entrega">
                <header>
                  <h3>{ativo ? 'Rascunho em andamento' : 'O que ele entregou'}</h3>
                  <button className="link" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar'}</button>
                </header>
                <div className="ag-texto">
                  {emCampos(rascunho).map((c, i) =>
                    c.rotulo ? (
                      <div key={i} className="ag-campo">
                        <span>{c.rotulo}</span>
                        <p>{c.texto}</p>
                      </div>
                    ) : (
                      <p key={i}>{c.texto}</p>
                    ),
                  )}
                </div>
              </section>
            ) : (
              !ativo && (
                <div className="ag-vazio">
                  <span className="ag-vazio-icone"><Icone id={id} /></span>
                  <strong>{estado === 'ocioso' ? 'Sem tarefa neste post' : 'Nada entregue ainda'}</strong>
                  <p>
                    {estado === 'ocioso' && anterior
                      ? `Entra depois do ${agentePorId(anterior).nome.toLowerCase()}.`
                      : id === 'curador'
                        ? 'Entra quando você corrige um post, para virar regra.'
                        : 'Quando ele trabalhar, o resultado aparece aqui.'}
                  </p>
                </div>
              )
            )}
          </>
        )}

        {aba === 'historico' &&
          (historico.length === 0 ? (
            <div className="ag-vazio">
              <strong>Sem atividade neste post</strong>
            </div>
          ) : (
            <ol className="ag-tempo">
              {historico.map((e, i) => (
                <li key={e.id} className={`${e.tipo}${i === 0 && ativo ? ' atual' : ''}`}>
                  <span className="ag-tempo-ponto" aria-hidden />
                  <div>
                    <p>{e.mensagem}</p>
                    <time>{new Date(e.criado_em).toLocaleTimeString('pt-BR')}</time>
                  </div>
                </li>
              ))}
            </ol>
          ))}

        {aba === 'ideias' && marcaId && aoUsarIdeia && <PedirIdeias marcaId={marcaId} aoUsar={aoUsarIdeia} />}
      </div>
    </aside>
  )
}
