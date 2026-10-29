import { ESTILOS, ORDEM_ESTILOS, PISOS, estiloDaSala, pisos, type AreaSala, type Piso, type SalaCustom } from '../pixel/mapa'

// a sala da marca é uma recepção só (a equipe fica na sala dela): um piso
const AREAS: { id: AreaSala; nome: string }[] = [{ id: 'hall', nome: 'Sala' }]

function Cor({ valor, rotulo, aoMudar }: { valor: string; rotulo: string; aoMudar: (cor: string) => void }) {
  return (
    <label className="sl-cor" title={rotulo}>
      <span className="sl-amostra" style={{ background: valor }} />
      <span className="sl-hex">{valor.toUpperCase()}</span>
      <input type="color" value={valor} onChange={(e) => aoMudar(e.target.value)} aria-label={rotulo} />
    </label>
  )
}

function IconeSala() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 4l9 6.5V20H3z" />
      <path d="M9 20v-5h6v5" />
    </svg>
  )
}

/** Decorar a sala: estilo base, cor da marca, paredes, pisos de cada área e móveis. Muda na hora no escritório. */
export function PainelSala({
  marcaNome,
  padrao,
  cor,
  sala,
  estado,
  aoMudar,
  aoFechar,
}: {
  marcaNome?: string
  /** estilo que a sala usa quando ninguém escolheu */
  padrao: string
  cor: string
  sala: SalaCustom
  estado: 'salvo' | 'salvando' | 'erro' | 'local' | null
  aoMudar: (sala: SalaCustom, cor: string) => void
  aoFechar: () => void
}) {
  const base = sala.base ?? padrao
  const e = estiloDaSala(padrao, cor, sala)
  const p = pisos(e)
  const mudar = (campos: Partial<SalaCustom>) => aoMudar({ ...sala, ...campos }, cor)
  const mudarPiso = (area: AreaSala, campos: { cor?: string; padrao?: Piso }) =>
    mudar({ pisos: { ...sala.pisos, [area]: { ...sala.pisos?.[area], ...campos } } })
  const personalizada = Object.keys(sala).some((k) => k !== 'base')

  return (
    <aside className="painel ag sl" aria-label="Editar sala" style={{ ['--cor-agente' as string]: cor, ['--cor-estado' as string]: cor }}>
      <header className="ag-capa">
        <button className="ag-fechar" onClick={aoFechar} aria-label="Fechar painel">×</button>
        <span className="ag-icone">
          <IconeSala />
        </span>
        <div className="ag-nome">
          <h2>Sala{marcaNome ? ` da ${marcaNome}` : ''}</h2>
          <p>Troque pisos, paredes, cores e móveis. Muda na hora no escritório.</p>
        </div>
      </header>

      <div className="ag-corpo">
        <section className="sl-secao">
          <h3>Estilo de partida</h3>
          <div className="sl-estilos">
            {ORDEM_ESTILOS.map((id) => {
              const x = ESTILOS[id]
              return (
                <button key={id} className={base === id ? 'ativo' : ''} onClick={() => aoMudar(id === padrao ? {} : { base: id }, cor)} aria-pressed={base === id}>
                  <span className="sl-mini" aria-hidden>
                    <i style={{ background: x.parede }} />
                    <i style={{ background: cor }} />
                    <i style={{ background: x.piso }} />
                  </span>
                  {x.nome}
                </button>
              )
            })}
          </div>
          <p className="sl-dica">Escolher um estilo desfaz o que você trocou abaixo.</p>
        </section>

        <section className="sl-secao">
          <h3>Cor da marca</h3>
          <p className="sl-dica">Faixa da parede, placa com o nome e tapete do hall.</p>
          <Cor valor={cor} rotulo="Cor da marca" aoMudar={(c) => aoMudar(sala, c)} />
        </section>

        <section className="sl-secao">
          <h3>Paredes</h3>
          <div className="sl-linha">
            <Cor valor={e.parede} rotulo="Cor das paredes" aoMudar={(c) => mudar({ parede: c })} />
            <div className="sl-segmento" role="group" aria-label="Acabamento da parede">
              <button className={!e.tijolo ? 'ativo' : ''} onClick={() => mudar({ tijolo: false })}>Lisa</button>
              <button className={e.tijolo ? 'ativo' : ''} onClick={() => mudar({ tijolo: true })}>Tijolinho</button>
            </div>
          </div>
        </section>

        <section className="sl-secao">
          <h3>Pisos</h3>
          <ul className="sl-pisos">
            {AREAS.map((a) => (
              <li key={a.id}>
                <span className="sl-area">{a.nome}</span>
                <Cor valor={p[a.id].estilo.piso} rotulo={`Cor do piso: ${a.nome}`} aoMudar={(c) => mudarPiso(a.id, { cor: c })} />
                <div className="sl-padroes" role="group" aria-label={`Desenho do piso: ${a.nome}`}>
                  {PISOS.map((x) => (
                    <button
                      key={x.id}
                      className={`sl-padrao ${x.id}${p[a.id].padrao === x.id ? ' ativo' : ''}`}
                      style={{ ['--piso' as string]: p[a.id].estilo.piso, ['--linha' as string]: p[a.id].estilo.pisoLinha }}
                      onClick={() => mudarPiso(a.id, { padrao: x.id })}
                      title={x.nome}
                      aria-label={x.nome}
                      aria-pressed={p[a.id].padrao === x.id}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="sl-secao">
          <h3>Móveis</h3>
          <div className="sl-moveis">
            <div><span>Mesas</span><Cor valor={e.mesa} rotulo="Cor das mesas" aoMudar={(c) => mudar({ mesa: c })} /></div>
            <div><span>Cadeiras</span><Cor valor={e.cadeira} rotulo="Cor das cadeiras" aoMudar={(c) => mudar({ cadeira: c })} /></div>
            <div><span>Tapetes</span><Cor valor={e.tapete} rotulo="Cor dos tapetes" aoMudar={(c) => mudar({ tapete: c })} /></div>
          </div>
        </section>
      </div>

      <footer className="sl-rodape">
        <span className={`sl-estado ${estado ?? ''}`} role="status">
          {estado === 'salvando' ? 'Salvando…' : estado === 'salvo' ? 'Salvo nesta sala' : estado === 'erro' ? 'Não deu para salvar' : estado === 'local' ? 'Não fica salvo' : ' '}
        </span>
        <button className="secundario" onClick={() => aoMudar({}, cor)} disabled={!personalizada && !sala.base}>Voltar ao padrão</button>
        <button className="primario" onClick={aoFechar}>Pronto</button>
      </footer>
    </aside>
  )
}
