import { useState } from 'react'
import { agentePorId } from '../agents/catalogo'
import { useEscritorio } from '../store/escritorio'
import { COR_ESTADO } from '../office/EstacaoAgente'
import { AcoesDeErro } from './PostComErro'
import { PedirIdeias } from './PedirIdeias'
import type { Post } from '../lib/dados'

const ROTULO_ESTADO = {
  ocioso: 'Ocioso',
  na_fila: 'Na fila',
  trabalhando: 'Trabalhando',
  concluido: 'Concluído',
  esperando_voce: 'Esperando você',
  erro: 'Erro',
} as const

const MODELO: Record<string, string> = { 'claude-opus-5-5': 'Opus', 'claude-sonnet-5-5': 'Sonnet', 'claude-haiku-5-5': 'Haiku' }
const ATIVOS = ['trabalhando', 'na_fila', 'esperando_voce']

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
function duracao(seg: number) {
  if (seg < 60) return `${Math.max(1, Math.round(seg))}s`
  const m = Math.floor(seg / 60)
  return `${m}min${seg % 60 >= 1 ? ` ${Math.round(seg % 60)}s` : ''}`
}

/** Quebra a saída do agente em campos ("Formato: …", "Ângulo: …") quando ela vem nesse jeito; senão, em parágrafos. */
function emCampos(texto: string) {
  const blocos: { rotulo?: string; texto: string }[] = []
  for (const linha of texto.split('\n')) {
    const m = linha.match(/^\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ ]{1,28}):\s*(.*)$/)
    if (m) blocos.push({ rotulo: m[1], texto: m[2] })
    else if (linha.trim()) {
      const ultimo = blocos[blocos.length - 1]
      if (ultimo) ultimo.texto += (ultimo.texto ? '\n' : '') + linha
      else blocos.push({ texto: linha })
    } else if (blocos.length && blocos[blocos.length - 1].texto) blocos.push({ texto: '' })
  }
  return blocos.filter((b) => b.texto.trim() || b.rotulo)
}

export function PainelAgente({ post, aoMudar, marcaId, aoUsarIdeia }: { post?: Post | null; aoMudar?: () => void; marcaId?: string | null; aoUsarIdeia?: (briefing: string) => void }) {
  const id = useEscritorio((s) => s.selecionado)
  const estado = useEscritorio((s) => (id ? s.estados[id] : 'ocioso'))
  const acao = useEscritorio((s) => (id ? s.acaoAtual[id] : undefined))
  const rascunho = useEscritorio((s) => (id ? s.rascunho[id] : undefined))
  const eventos = useEscritorio((s) => s.eventos)
  const selecionar = useEscritorio((s) => s.selecionar)
  const [tudo, setTudo] = useState(false)
  const [copiado, setCopiado] = useState(false)

  if (!id) return null
  const a = agentePorId(id)
  const meus = eventos.filter((e) => e.agente === id && e.tipo !== 'texto')
  const historico = meus.slice().reverse()
  const visiveis = tudo ? historico : historico.slice(0, 5)
  const ativo = ATIVOS.includes(estado)
  const inicio = meus[0]?.criado_em
  const fim = meus[meus.length - 1]?.criado_em
  const levou = inicio && fim ? (new Date(fim).getTime() - new Date(inicio).getTime()) / 1000 : 0
  const campos = rascunho ? emCampos(rascunho) : []

  const resumo =
    estado === 'concluido' && fim
      ? `Terminou às ${hora(fim)}${levou > 0 ? ` · levou ${duracao(levou)}` : ''}`
      : estado === 'erro'
        ? 'Parou com erro neste post'
        : estado === 'ocioso'
          ? 'Sem tarefa neste post'
          : null

  const copiar = async () => {
    if (!rascunho) return
    try {
      await navigator.clipboard.writeText(rascunho)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // sem permissão de área de transferência: não faz nada
    }
  }

  return (
    <aside className="painel pa" aria-label={`Detalhes do ${a.nome}`} style={{ ['--cor-agente' as string]: a.cor }}>
      <header className="pa-topo">
        <span className="pa-avatar" aria-hidden>{a.nome.charAt(0)}</span>
        <div className="pa-titulo">
          <h2>{a.nome}</h2>
          <p>{a.papel}</p>
        </div>
        <button className="fechar" onClick={() => selecionar(null)} aria-label="Fechar painel">×</button>
      </header>

      <div className="pa-status" style={{ ['--cor-estado' as string]: COR_ESTADO[estado] }}>
        <span className={`pa-pilula ${estado}`}>
          <i />
          {ROTULO_ESTADO[estado]}
        </span>
        <span className="pa-modelo" title={a.modelo ?? undefined}>{a.modelo ? MODELO[a.modelo] ?? a.modelo : 'Sem IA'}</span>
        {resumo && <span className="pa-resumo">{resumo}</span>}
      </div>

      {ativo && acao && (
        <section className="pa-agora">
          <span className="pa-rotulo">Agora</span>
          <p>{acao}</p>
        </section>
      )}
      {estado === 'erro' && post?.status === 'erro' && aoMudar && <AcoesDeErro post={post} agente={id} aoMudar={aoMudar} />}
      {id === 'pesquisador' && marcaId && aoUsarIdeia && <PedirIdeias marcaId={marcaId} aoUsar={aoUsarIdeia} />}

      <section className="pa-bloco">
        <div className="pa-cabeca">
          <span className="pa-rotulo">{ativo ? 'Produzindo' : 'Entrega'}</span>
          {rascunho && (
            <button className="link" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar'}</button>
          )}
        </div>
        {campos.length === 0 ? (
          <p className="pa-vazio">Nada ainda neste post.</p>
        ) : (
          <div className="pa-entrega">
            {campos.map((c, i) =>
              c.rotulo ? (
                <div key={i} className="pa-campo">
                  <span>{c.rotulo}</span>
                  <p>{c.texto}</p>
                </div>
              ) : (
                <p key={i}>{c.texto}</p>
              ),
            )}
          </div>
        )}
      </section>

      <section className="pa-bloco">
        <div className="pa-cabeca">
          <span className="pa-rotulo">Histórico neste post</span>
          {historico.length > 0 && <span className="pa-conta">{historico.length}</span>}
        </div>
        {historico.length === 0 ? (
          <p className="pa-vazio">Sem atividade.</p>
        ) : (
          <>
            <ol className="pa-linha">
              {visiveis.map((e, i) => (
                <li key={e.id} className={`${e.tipo}${i === 0 && ativo ? ' atual' : ''}`}>
                  <time>{new Date(e.criado_em).toLocaleTimeString('pt-BR')}</time>
                  <span>{e.mensagem}</span>
                </li>
              ))}
            </ol>
            {historico.length > 5 && (
              <button className="link pa-mais" onClick={() => setTudo(!tudo)}>{tudo ? 'Mostrar menos' : `Ver tudo (${historico.length})`}</button>
            )}
          </>
        )}
      </section>
    </aside>
  )
}
