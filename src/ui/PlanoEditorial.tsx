import { useMemo, useState } from 'react'
import { paraCampo, rotuloHorario, type NaAgenda } from '../lib/agenda'
import { FORMATOS, lerEspeciais, MAX_VAGAS, montarVagas, paraDia, resumoDoPlano, type ConfigPlano, type FormatoPlano } from '../lib/plano'
import { aprovarPlano, descartarPlano, gerarPlano, pedirOutraIdeia, salvarVaga, type Plano, type Vaga } from '../lib/planos'

const NOME_FORMATO: Record<FormatoPlano, string> = { carrossel: 'Carrossel', foto: 'Foto', reel: 'Reel' }
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const dolar = (n: number) => `US$ ${n.toFixed(2).replace('.', ',')}`
const amanha = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return paraDia(d)
}

/**
 * Plano editorial do Social Media: você escolhe período, ritmo, mix de formatos e linhas; ele monta a grade
 * de temas sem repetir o que a marca já publicou. Você edita, troca ideias, tira vagas e aprova.
 */
export function PlanoEditorial({
  marcaId,
  marcaNome,
  agenda,
  plano,
  aoMudar,
  aoCriarPost,
  aoFechar,
}: {
  marcaId: string
  marcaNome?: string
  agenda: NaAgenda[]
  plano: Plano | null | undefined
  aoMudar: () => Promise<void> | void
  aoCriarPost: (vaga: Vaga) => void
  aoFechar: () => void
}) {
  const [novo, setNovo] = useState(false)
  const mostrandoForm = novo || plano === null
  return (
    // por cima do calendário: o clique fora fecha só o plano
    <div
      className="modal-fundo"
      onClick={(e) => {
        e.stopPropagation()
        aoFechar()
      }}
    >
      <div className="modal plano" role="dialog" aria-label="Plano editorial" onClick={(e) => e.stopPropagation()}>
        <header className="painel-topo">
          <div>
            <h2>Plano editorial{marcaNome ? <small className="cal-marca"> · {marcaNome}</small> : null}</h2>
            <p className="muted">O Social Media monta a grade de temas lendo o que a marca já publicou, para não repetir.</p>
          </div>
          <button className="fechar" onClick={aoFechar} aria-label="Fechar o plano">×</button>
        </header>
        {plano === undefined ? (
          <p className="muted">Carregando…</p>
        ) : mostrandoForm ? (
          <NovoPlano
            marcaId={marcaId}
            agenda={agenda}
            temPlano={!!plano}
            aoCancelar={plano ? () => setNovo(false) : undefined}
            aoCriar={async () => {
              setNovo(false)
              await aoMudar()
            }}
          />
        ) : (
          <Grade marcaId={marcaId} plano={plano!} aoMudar={aoMudar} aoCriarPost={aoCriarPost} aoNovo={() => setNovo(true)} />
        )}
      </div>
    </div>
  )
}

function NovoPlano({ marcaId, agenda, temPlano, aoCancelar, aoCriar }: { marcaId: string; agenda: NaAgenda[]; temPlano: boolean; aoCancelar?: () => void; aoCriar: () => Promise<void> }) {
  const [inicio, setInicio] = useState(amanha)
  const [dias, setDias] = useState(30)
  const [tipoRitmo, setTipoRitmo] = useState<'por_dia' | 'por_semana' | 'dias'>('por_dia')
  const [n, setN] = useState(1)
  const [diasSemana, setDiasSemana] = useState<number[]>([1, 3, 5])
  const [mix, setMix] = useState<Record<FormatoPlano, number>>({ carrossel: 60, foto: 30, reel: 10 })
  const [linhas, setLinhas] = useState('educativo, lista para salvar, bastidor, opinião, novidade da marca')
  const [especiais, setEspeciais] = useState('')
  const [horario, setHorario] = useState<'bons' | 'fixo'>('bons')
  const [hora, setHora] = useState('19:00')
  const [teto, setTeto] = useState('')
  const [pedido, setPedido] = useState('')
  const [montando, setMontando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const config: ConfigPlano = useMemo(() => {
    const t = Number(teto.replace(',', '.'))
    return {
      inicio,
      dias: Math.max(1, Math.min(93, dias || 1)),
      ritmo: tipoRitmo === 'dias' ? { tipo: 'dias', dias: diasSemana } : { tipo: tipoRitmo, n },
      mix,
      linhas: linhas.split(',').map((l) => l.trim()).filter(Boolean).slice(0, 12),
      especiais: lerEspeciais(especiais, inicio),
      horario: horario === 'fixo' ? { modo: 'fixo', hora } : { modo: 'bons' },
      teto_usd: teto.trim() && Number.isFinite(t) && t > 0 ? t : null,
    }
  }, [inicio, dias, tipoRitmo, n, diasSemana, mix, linhas, especiais, horario, hora, teto])
  const vagas = useMemo(() => (/^\d{4}-\d{2}-\d{2}$/.test(inicio) ? montarVagas(config, agenda, marcaId) : []), [config, agenda, marcaId, inicio])
  const resumo = resumoDoPlano(vagas)
  const passaDoTeto = config.teto_usd !== null && resumo.minimo > config.teto_usd

  const montar = async () => {
    if (!vagas.length) return setErro('Nenhuma vaga nesse período: confira o início, o ritmo e os dias já ocupados.')
    if (temPlano && !confirm('Montar um plano novo encerra o plano atual (os posts já criados continuam). Seguir?')) return
    setMontando(true)
    setErro(null)
    try {
      await gerarPlano(marcaId, config, vagas, pedido)
      await aoCriar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'O Social Media não conseguiu montar o plano')
      setMontando(false)
    }
  }

  return (
    <div className="plano-form">
      <div className="plano-campos">
        <label>
          <span>Começa em</span>
          <input type="date" value={inicio} min={paraDia(new Date())} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label>
          <span>Duração (dias)</span>
          <input type="number" min={1} max={93} value={dias} onChange={(e) => setDias(Number(e.target.value))} />
        </label>
        <label>
          <span>Ritmo</span>
          <select value={tipoRitmo} onChange={(e) => setTipoRitmo(e.target.value as typeof tipoRitmo)}>
            <option value="por_dia">Posts por dia</option>
            <option value="por_semana">Posts por semana</option>
            <option value="dias">Dias da semana</option>
          </select>
        </label>
        {tipoRitmo !== 'dias' ? (
          <label>
            <span>{tipoRitmo === 'por_dia' ? 'Quantos por dia' : 'Quantos por semana'}</span>
            <input type="number" min={1} max={tipoRitmo === 'por_dia' ? 3 : 7} value={n} onChange={(e) => setN(Number(e.target.value))} />
          </label>
        ) : (
          <fieldset className="plano-semana">
            <legend>Dias</legend>
            {SEMANA.map((s, i) => (
              <label key={s} className={diasSemana.includes(i) ? 'ativo' : ''}>
                <input type="checkbox" checked={diasSemana.includes(i)} onChange={(e) => setDiasSemana((d) => (e.target.checked ? [...d, i].sort() : d.filter((x) => x !== i)))} />
                {s}
              </label>
            ))}
          </fieldset>
        )}
      </div>

      <fieldset className="plano-mix">
        <legend>Mix de formatos (%)</legend>
        {FORMATOS.map((f) => (
          <label key={f}>
            <span>{NOME_FORMATO[f]}</span>
            <input type="number" min={0} max={100} value={mix[f]} onChange={(e) => setMix((m) => ({ ...m, [f]: Math.max(0, Number(e.target.value) || 0) }))} />
          </label>
        ))}
      </fieldset>

      <label>
        <span>Linhas de conteúdo (separadas por vírgula; o Social Media alterna entre elas)</span>
        <input value={linhas} onChange={(e) => setLinhas(e.target.value)} />
      </label>
      <label>
        <span>Datas especiais (uma por linha, ex.: 27/11 Black Friday)</span>
        <textarea rows={2} value={especiais} onChange={(e) => setEspeciais(e.target.value)} placeholder="27/11 Black Friday" />
      </label>
      <label>
        <span>Algo que este plano precisa ter (opcional)</span>
        <textarea rows={2} value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder="Ex.: puxar o lançamento do app novo na segunda quinzena" />
      </label>

      <div className="plano-campos">
        <label>
          <span>Horário</span>
          <select value={horario} onChange={(e) => setHorario(e.target.value as typeof horario)}>
            <option value="bons">Os horários bons (12h e 19h; fim de semana 11h e 18h)</option>
            <option value="fixo">Sempre no mesmo horário</option>
          </select>
        </label>
        {horario === 'fixo' && (
          <label>
            <span>Hora</span>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </label>
        )}
        <label>
          <span>Teto do plano (US$)</span>
          <input inputMode="decimal" value={teto} onChange={(e) => setTeto(e.target.value)} placeholder="só os tetos da sala" />
        </label>
      </div>

      <p className={`plano-resumo${passaDoTeto ? ' aviso' : ''}`} role="status">
        {vagas.length
          ? `${vagas.length} posts${vagas.length >= MAX_VAGAS ? ' (o máximo por plano)' : ''}: ${FORMATOS.filter((f) => resumo.conta[f]).map((f) => `${resumo.conta[f]} ${f === 'carrossel' ? (resumo.conta[f] > 1 ? 'carrosséis' : 'carrossel') : f === 'foto' ? (resumo.conta[f] > 1 ? 'fotos' : 'foto') : resumo.conta[f] > 1 ? 'Reels' : 'Reel'}`).join(', ')}. Produzir tudo deve custar de ${dolar(resumo.minimo)} a ${dolar(resumo.maximo)}; montar a grade custa uns centavos.${passaDoTeto ? ' Isso passa do teto do plano: a produção para quando bater nele.' : ''}`
          : 'Nenhuma vaga com essas escolhas (dias já ocupados contam).'}
      </p>
      {erro && <p className="aviso">{erro}</p>}
      <div className="acoes">
        {aoCancelar && <button className="secundario" onClick={aoCancelar} disabled={montando}>Voltar ao plano atual</button>}
        <button className="primario" onClick={montar} disabled={montando || !vagas.length}>
          {montando ? 'O Social Media está montando a grade…' : 'Montar a grade de temas'}
        </button>
      </div>
    </div>
  )
}

function Grade({ marcaId, plano, aoMudar, aoCriarPost, aoNovo }: { marcaId: string; plano: Plano; aoMudar: () => Promise<void> | void; aoCriarPost: (v: Vaga) => void; aoNovo: () => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const ativas = plano.vagas.filter((v) => v.status !== 'descartada')
  const resumo = resumoDoPlano(ativas)
  const rascunho = plano.status === 'rascunho'
  const criados = ativas.filter((v) => v.post_id).length

  const agir = async (f: () => Promise<unknown>) => {
    setOcupado(true)
    setErro(null)
    try {
      await f()
      await aoMudar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu certo')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="plano-grade">
      <p className="plano-resumo">
        {rascunho ? 'Rascunho: edite o que quiser e aprove a grade.' : `Aprovado. ${criados} de ${ativas.length} já viraram post.`} {ativas.length} vagas, produção estimada de {dolar(resumo.minimo)} a {dolar(resumo.maximo)}
        {plano.custo_usd > 0 ? ` (a grade custou ${dolar(plano.custo_usd)})` : ''}.
      </p>
      <ol className="plano-vagas">
        {plano.vagas.map((v) => (
          <LinhaDaVaga key={v.id} marcaId={marcaId} vaga={v} aprovado={!rascunho} editavel={!v.post_id} aoMudar={aoMudar} aoCriarPost={rascunho ? undefined : () => aoCriarPost(v)} />
        ))}
      </ol>
      {erro && <p className="aviso">{erro}</p>}
      <div className="acoes">
        <button className="perigo" disabled={ocupado} onClick={() => confirm(rascunho ? 'Jogar fora este rascunho?' : 'Encerrar este plano? As vagas que ainda não viraram post saem do calendário.') && agir(() => descartarPlano(plano))}>
          {rascunho ? 'Descartar rascunho' : 'Encerrar plano'}
        </button>
        <button className="secundario" disabled={ocupado} onClick={aoNovo}>Novo plano</button>
        {rascunho && (
          <button className="primario" disabled={ocupado || !ativas.length} onClick={() => agir(() => aprovarPlano(plano.id))}>
            Aprovar a grade ({ativas.length})
          </button>
        )}
      </div>
    </div>
  )
}

function LinhaDaVaga({ marcaId, vaga, aprovado, editavel, aoMudar, aoCriarPost }: { marcaId: string; vaga: Vaga; aprovado: boolean; editavel: boolean; aoMudar: () => Promise<void> | void; aoCriarPost?: () => void }) {
  const [aberta, setAberta] = useState(false)
  const [titulo, setTitulo] = useState(vaga.titulo)
  const [gancho, setGancho] = useState(vaga.gancho)
  const [briefing, setBriefing] = useState(vaga.briefing)
  const [quando, setQuando] = useState(() => paraCampo(new Date(vaga.quando)))
  const [pensando, setPensando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fora = vaga.status === 'descartada'

  const salvar = async (campos: Parameters<typeof salvarVaga>[1]) => {
    setErro(null)
    try {
      await salvarVaga(vaga.id, campos)
      await aoMudar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para salvar')
    }
  }
  const outra = async () => {
    setPensando(true)
    setErro(null)
    try {
      const { vaga: nova } = await pedirOutraIdeia(marcaId, vaga.id)
      setTitulo(nova.titulo)
      setGancho(nova.gancho)
      setBriefing(nova.briefing)
      await aoMudar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'O Social Media não respondeu')
    } finally {
      setPensando(false)
    }
  }

  return (
    <li className={`plano-vaga${fora ? ' fora' : ''}${vaga.post_id ? ' feita' : ''}`}>
      <button className="plano-vaga-linha" onClick={() => setAberta(!aberta)} aria-expanded={aberta}>
        <span className="plano-vaga-dia mono">{rotuloHorario(new Date(vaga.quando))}</span>
        <span className="plano-vaga-texto">
          <strong>{pensando ? 'Pensando em outra ideia…' : titulo || 'Sem tema'}</strong>
          {gancho && <span className="muted">“{gancho}”</span>}
        </span>
        <span className="plano-vaga-chips">
          <span className="chip">{NOME_FORMATO[vaga.formato]}</span>
          {vaga.linha && <span className="chip">{vaga.linha}</span>}
          {vaga.novidade === 'angulo_novo' && <span className="chip status-agendado" title={vaga.parecido_com ?? undefined}>ângulo novo</span>}
          {vaga.post_id && <span className="chip status-publicado">virou post</span>}
          {fora && <span className="chip">fora do plano</span>}
        </span>
      </button>
      {aberta && (
        <div className="plano-vaga-detalhe">
          {vaga.tema_obrigatorio && <p className="pm-dica">Data especial: {vaga.tema_obrigatorio}</p>}
          {vaga.novidade === 'angulo_novo' && vaga.parecido_com && <p className="pm-dica">Parecido com um post antigo: {vaga.parecido_com}</p>}
          <label>
            <span>Tema</span>
            <input value={titulo} disabled={!editavel} onChange={(e) => setTitulo(e.target.value)} onBlur={() => titulo !== vaga.titulo && salvar({ titulo })} />
          </label>
          <label>
            <span>Gancho</span>
            <input value={gancho} disabled={!editavel} onChange={(e) => setGancho(e.target.value)} onBlur={() => gancho !== vaga.gancho && salvar({ gancho })} />
          </label>
          <label>
            <span>Pedido para a equipe</span>
            <textarea rows={3} value={briefing} disabled={!editavel} onChange={(e) => setBriefing(e.target.value)} onBlur={() => briefing !== vaga.briefing && salvar({ briefing })} />
          </label>
          <div className="plano-campos">
            <label>
              <span>Quando</span>
              <input
                type="datetime-local"
                value={quando}
                disabled={!editavel}
                onChange={(e) => setQuando(e.target.value)}
                onBlur={() => quando && quando !== paraCampo(new Date(vaga.quando)) && salvar({ quando: new Date(quando).toISOString() })}
              />
            </label>
            <label>
              <span>Formato</span>
              <select value={vaga.formato} disabled={!editavel} onChange={(e) => salvar({ formato: e.target.value as FormatoPlano })}>
                {FORMATOS.map((f) => <option key={f} value={f}>{NOME_FORMATO[f]}</option>)}
              </select>
            </label>
          </div>
          {erro && <p className="aviso">{erro}</p>}
          {editavel && (
            <div className="acoes">
              {fora ? (
                <button className="secundario" onClick={() => salvar({ status: aprovado ? 'aprovada' : 'proposta' })}>Pôr de volta</button>
              ) : (
                <>
                  <button className="secundario" onClick={() => salvar({ status: 'descartada' })}>Tirar do plano</button>
                  <button className="secundario" disabled={pensando} onClick={outra}>{pensando ? 'Pensando…' : 'Outra ideia'}</button>
                  {aoCriarPost && <button className="primario" onClick={aoCriarPost}>Criar este post</button>}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  )
}
