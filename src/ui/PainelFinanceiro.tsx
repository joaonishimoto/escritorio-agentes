import { useState } from 'react'
import { agentePorId, AGENTES, type AgenteId } from '../agents/catalogo'
import { chamarApi } from '../lib/api'

export interface NumerosFin {
  total_usd: number
  total_30_dias_antes_usd: number
  mes_atual_usd: number
  projecao_mes_usd: number
  posts: number
  publicados: number
  perdidos: number
  custo_medio_post_usd: number
  custo_por_publicado_usd: number
  desperdicio_usd: number
  retrabalho_usd: number
  voltas_revisao_media: number
  por_agente: { agente: string; custo: number; execucoes: number; media: number; segundos: number; erros: number }[]
  por_marca: { marca: string; custo: number; posts: number }[]
  por_formato: { formato: string; custo: number; posts: number; medio: number }[]
  mais_caros: { id: string; briefing: string; marca: string; custo: number; status: string; formato: string; voltas: number }[]
  por_dia: { dia: string; custo: number }[]
}
export interface AnaliseFin {
  id: string
  criado_em: string
  custo_usd: number
  analise: {
    resumo: string
    saude: 'boa' | 'atencao' | 'critica'
    alertas: { titulo: string; detalhe: string; acao: string; economia_usd_mes: number; gravidade: 'alta' | 'media' | 'baixa' }[]
    elogios: string[]
  }
}
export interface DadosFin {
  numeros: NumerosFin | null
  ultima: AnaliseFin | null
}

const usd = (n: number) => `US$ ${n.toFixed(2).replace('.', ',')}`
const SAUDE = { boa: 'Gastos saudáveis', atencao: 'Pede atenção', critica: 'Precisa de ação' } as const
const GRAVIDADE = { alta: 'Importante', media: 'Vale olhar', baixa: 'Detalhe' } as const
const nomeAgente = (id: string) => (AGENTES.some((a) => a.id === id) ? agentePorId(id as AgenteId).nome : id)
const corAgente = (id: string) => (AGENTES.some((a) => a.id === id) ? agentePorId(id as AgenteId).cor : '#8a8f98')

function IconeFin() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  )
}

/** A mesa do Financeiro: o que ele achou dos gastos e os números por trás. */
export function PainelFinanceiro({
  dados,
  aoAtualizar,
  aoFechar,
  aoAbrirPost,
}: {
  dados: DadosFin | null
  aoAtualizar: (d: DadosFin) => void
  aoFechar: () => void
  aoAbrirPost?: (id: string) => void
}) {
  const [aba, setAba] = useState<'dicas' | 'numeros'>('dicas')
  const [analisando, setAnalisando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const n = dados?.numeros
  const a = dados?.ultima

  const analisar = async () => {
    setAnalisando(true)
    setErro(null)
    try {
      aoAtualizar(await chamarApi<DadosFin>('financeiro', { acao: 'analisar' }))
      setAba('dicas')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para analisar')
    } finally {
      setAnalisando(false)
    }
  }

  // OK numa dica: some na hora e o servidor tira da análise salva
  const dispensar = (indice: number) => {
    if (!dados || !a) return
    const titulo = a.analise.alertas[indice].titulo
    aoAtualizar({ ...dados, ultima: { ...a, analise: { ...a.analise, alertas: a.analise.alertas.filter((_, i) => i !== indice) } } })
    chamarApi<DadosFin>('financeiro', { acao: 'dispensar', indice, titulo }).then(aoAtualizar).catch(() => {})
  }

  const variacao = n && n.total_30_dias_antes_usd > 0 ? Math.round(((n.total_usd - n.total_30_dias_antes_usd) / n.total_30_dias_antes_usd) * 100) : null
  const maxDia = Math.max(0.0001, ...(n?.por_dia.map((d) => d.custo) ?? [0]))
  const maxAgente = Math.max(0.0001, ...(n?.por_agente.map((x) => x.custo) ?? [0]))
  const economia = a?.analise.alertas.reduce((s, x) => s + (x.economia_usd_mes || 0), 0) ?? 0

  return (
    <aside className="painel ag fin" aria-label="Financeiro" style={{ ['--cor-agente' as string]: '#3f7650', ['--cor-estado' as string]: a ? (a.analise.saude === 'boa' ? '#3f7650' : a.analise.saude === 'atencao' ? '#976822' : '#b74e45') : '#a2a39a' }}>
      <header className="ag-capa">
        <button className="ag-fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
        <span className="ag-icone">
          <IconeFin />
        </span>
        <div className="ag-nome">
          <h2>Financeiro</h2>
          <p>Analisa os gastos de todas as salas e aponta onde dá para gastar menos.</p>
        </div>
      </header>

      {!dados ? (
        <div className="ag-corpo">
          <p className="ag-vazio">Carregando os números…</p>
        </div>
      ) : !n ? (
        <div className="ag-corpo">
          <div className="ag-vazio">
            <strong>Sem números ainda</strong>
            <p>Quando a equipe fizer posts, os gastos aparecem aqui.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="ag-fatos">
            <div>
              <span>30 dias</span>
              <strong>{usd(n.total_usd)}</strong>
            </div>
            <div>
              <span>Projeção do mês</span>
              <strong>{usd(n.projecao_mes_usd)}</strong>
            </div>
            <div>
              <span>Por publicado</span>
              <strong>{n.publicados ? usd(n.custo_por_publicado_usd) : '—'}</strong>
            </div>
            <div>
              <span>Sem resultado</span>
              <strong className={n.desperdicio_usd > 0 ? 'fin-ruim' : ''}>{usd(n.desperdicio_usd)}</strong>
            </div>
          </div>

          <nav className="ag-abas" role="tablist">
            <button role="tab" aria-selected={aba === 'dicas'} className={aba === 'dicas' ? 'ativo' : ''} onClick={() => setAba('dicas')}>
              Dicas{a?.analise.alertas.length ? <span>{a.analise.alertas.length}</span> : null}
            </button>
            <button role="tab" aria-selected={aba === 'numeros'} className={aba === 'numeros' ? 'ativo' : ''} onClick={() => setAba('numeros')}>
              Números
            </button>
          </nav>

          <div className="ag-corpo">
            {aba === 'dicas' && (
              <>
                {a ? (
                  <>
                    <section className={`fin-saude ${a.analise.saude}`}>
                      <div className="fin-saude-topo">
                        <strong>{SAUDE[a.analise.saude]}</strong>
                        <small>{new Date(a.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
                      </div>
                      <p>{a.analise.resumo}</p>
                      {economia > 0 && <p className="fin-economia">Dá para economizar cerca de {usd(economia)} por mês.</p>}
                    </section>
                    {a.analise.alertas.length === 0 && <p className="ag-vazio">Nada para corrigir agora.</p>}
                    <ol className="fin-dicas">
                      {a.analise.alertas.map((x, i) => (
                        <li key={`${i}-${x.titulo}`} className={x.gravidade}>
                          <div className="fin-dica-topo">
                            <span className="fin-tag">{GRAVIDADE[x.gravidade]}</span>
                            {x.economia_usd_mes > 0 && <span className="fin-ganho">−{usd(x.economia_usd_mes)}/mês</span>}
                          </div>
                          <h3>{x.titulo}</h3>
                          <p>{x.detalhe}</p>
                          <p className="fin-acao">
                            <span>O que fazer</span>
                            {x.acao}
                          </p>
                          <button className="fin-ok" onClick={() => dispensar(i)} aria-label={`OK, dispensar a dica: ${x.titulo}`}>
                            OK
                          </button>
                        </li>
                      ))}
                    </ol>
                    {a.analise.elogios.length > 0 && (
                      <ul className="fin-elogios">
                        {a.analise.elogios.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    )}
                  </>
                ) : (
                  <div className="ag-vazio">
                    <span className="ag-vazio-icone"><IconeFin /></span>
                    <strong>Nenhuma análise ainda</strong>
                    <p>Ele lê os gastos dos últimos 30 dias e te diz o que melhorar.</p>
                  </div>
                )}
                {erro && <p className="aviso">{erro}</p>}
                <button className="primario fin-analisar" disabled={analisando || n.posts === 0} onClick={analisar}>
                  {analisando ? 'Analisando os gastos…' : a ? 'Analisar de novo' : 'Analisar meus gastos'}
                </button>
                <p className="fin-nota">Cada análise custa poucos centavos e olha os últimos 30 dias.</p>
              </>
            )}

            {aba === 'numeros' && (
              <>
                <section className="fin-bloco">
                  <header>
                    <h3>Gasto por dia</h3>
                    {variacao !== null && <span className={variacao > 0 ? 'fin-ruim' : 'fin-bom'}>{variacao > 0 ? '+' : ''}{variacao}% vs. 30 dias antes</span>}
                  </header>
                  <div className="fin-barras" role="img" aria-label="Gasto por dia nos últimos 30 dias">
                    {n.por_dia.map((d) => (
                      <i key={d.dia} style={{ height: `${Math.max(2, (d.custo / maxDia) * 100)}%` }} title={`${new Date(`${d.dia}T12:00:00`).toLocaleDateString('pt-BR')}: ${usd(d.custo)}`} />
                    ))}
                  </div>
                </section>

                <section className="fin-bloco">
                  <header><h3>Por agente</h3></header>
                  <ul className="fin-lista">
                    {n.por_agente.map((x) => (
                      <li key={x.agente}>
                        <span className="fin-rotulo"><i style={{ background: corAgente(x.agente) }} />{nomeAgente(x.agente)}</span>
                        <span className="fin-trilho"><b style={{ width: `${(x.custo / maxAgente) * 100}%`, background: corAgente(x.agente) }} /></span>
                        <span className="fin-valor">{usd(x.custo)}</span>
                        <small>{x.execucoes}× · {usd(x.media)} cada{x.erros ? ` · ${x.erros} erro${x.erros > 1 ? 's' : ''}` : ''}</small>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="fin-bloco fin-grade">
                  <div><span>Posts</span><strong>{n.posts}</strong></div>
                  <div><span>Publicados</span><strong>{n.publicados}</strong></div>
                  <div><span>Com erro ou reprovados</span><strong>{n.perdidos}</strong></div>
                  <div><span>Retrabalho</span><strong>{usd(n.retrabalho_usd)}</strong></div>
                  <div><span>Voltas de revisão</span><strong>{n.voltas_revisao_media} por post</strong></div>
                  <div><span>Média por post</span><strong>{usd(n.custo_medio_post_usd)}</strong></div>
                </section>

                {n.por_marca.length > 1 && (
                  <section className="fin-bloco">
                    <header><h3>Por sala</h3></header>
                    <ul className="fin-simples">
                      {n.por_marca.map((m) => <li key={m.marca}><span>{m.marca}</span><span>{m.posts} posts</span><strong>{usd(m.custo)}</strong></li>)}
                    </ul>
                  </section>
                )}

                {n.mais_caros.length > 0 && (
                  <section className="fin-bloco">
                    <header><h3>Posts mais caros</h3></header>
                    <ul className="fin-caros">
                      {n.mais_caros.map((p) => (
                        <li key={p.id}>
                          <button onClick={() => aoAbrirPost?.(p.id)} disabled={!aoAbrirPost}>
                            <span>{p.briefing}</span>
                            <small>{p.marca} · {p.formato} · {p.status}{p.voltas ? ` · ${p.voltas} volta${p.voltas > 1 ? 's' : ''} de revisão` : ''}</small>
                          </button>
                          <strong>{usd(p.custo)}</strong>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
        </>
      )}
    </aside>
  )
}
