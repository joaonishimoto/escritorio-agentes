// Controles próprios (no lugar do select, do datalist e do calendário do navegador), com as cores do app nos dois temas.
// A lista abre num balão por cima de tudo (portal), para não ser cortada por áreas com rolagem.
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import './Controles.css'

type Lugar = { top: number; left: number; minWidth: number; acima: boolean }

/** Abre um balão colado no gatilho; fecha ao clicar fora, rolar a página ou mudar o tamanho da janela. */
function useBalao(gatilho: RefObject<HTMLElement | null>, altura: number) {
  const [aberto, setAberto] = useState(false)
  const [lugar, setLugar] = useState<Lugar | null>(null)
  const balao = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!aberto || !gatilho.current) return
    const r = gatilho.current.getBoundingClientRect()
    const acima = r.bottom + altura + 8 > window.innerHeight && r.top > altura + 8
    const left = Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 240) - 8))
    setLugar({ top: acima ? r.top - 6 : r.bottom + 6, left, minWidth: r.width, acima })
  }, [aberto, gatilho, altura])
  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => {
      const t = e.target as Node
      if (!balao.current?.contains(t) && !gatilho.current?.contains(t)) setAberto(false)
    }
    const fechar = (e: Event) => {
      if (e.type === 'scroll' && balao.current?.contains(e.target as Node)) return
      setAberto(false)
    }
    document.addEventListener('pointerdown', fora, true)
    window.addEventListener('resize', fechar)
    window.addEventListener('scroll', fechar, true)
    return () => {
      document.removeEventListener('pointerdown', fora, true)
      window.removeEventListener('resize', fechar)
      window.removeEventListener('scroll', fechar, true)
    }
  }, [aberto, gatilho])
  const render = (filhos: ReactNode, extra?: { id?: string; role?: string; label?: string }) =>
    aberto && lugar
      ? createPortal(
          <div
            ref={balao}
            id={extra?.id}
            role={extra?.role}
            aria-label={extra?.label}
            className={`ct-balao${lugar.acima ? ' acima' : ''}`}
            style={{ top: lugar.top, left: lugar.left, minWidth: lugar.minWidth }}
            onClick={(e) => e.stopPropagation()}
          >
            {filhos}
          </div>,
          document.body,
        )
      : null
  return { aberto, setAberto, render }
}

const Seta = () => (
  <svg className="ct-seta" viewBox="0 0 16 16" width="14" height="14" aria-hidden>
    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const Visto = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export interface Opcao {
  valor: string
  nome: string
  cor?: string
}

/** Lista de escolha (no lugar do <select>): bolinha de cor, item marcado, setas do teclado e Enter. */
export function Escolha({ valor, opcoes, aoMudar, rotulo, travado, dica }: { valor: string; opcoes: Opcao[]; aoMudar: (v: string) => void; rotulo: string; travado?: boolean; dica?: string }) {
  const gatilho = useRef<HTMLButtonElement>(null)
  const id = useId()
  const b = useBalao(gatilho, Math.min(opcoes.length, 8) * 36 + 12)
  const atual = opcoes.find((o) => o.valor === valor) ?? opcoes[0]
  const [foco, setFoco] = useState(0)
  useEffect(() => {
    if (b.aberto) setFoco(Math.max(0, opcoes.findIndex((o) => o.valor === valor)))
  }, [b.aberto]) // eslint-disable-line react-hooks/exhaustive-deps
  const escolher = (v: string) => {
    aoMudar(v)
    b.setAberto(false)
    gatilho.current?.focus()
  }
  const tecla = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!b.aberto) return b.setAberto(true)
      setFoco((f) => (f + (e.key === 'ArrowDown' ? 1 : opcoes.length - 1)) % opcoes.length)
    } else if ((e.key === 'Enter' || e.key === ' ') && b.aberto) {
      e.preventDefault()
      escolher(opcoes[foco].valor)
    } else if (e.key === 'Escape' && b.aberto) {
      e.preventDefault()
      b.setAberto(false)
    }
  }
  return (
    <>
      <button
        ref={gatilho}
        type="button"
        className={`ct-gatilho${b.aberto ? ' aberto' : ''}${travado ? ' auto' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={b.aberto}
        aria-controls={id}
        aria-label={`${rotulo}: ${atual?.nome}`}
        title={travado ? dica : undefined}
        disabled={travado}
        onClick={() => b.setAberto(!b.aberto)}
        onKeyDown={tecla}
      >
        {atual?.cor && <i className="ct-ponto" style={{ background: atual.cor }} />}
        <span className="ct-texto">{atual?.nome}</span>
        {travado ? <small className="ct-auto">auto</small> : <Seta />}
      </button>
      {b.render(
        <ul className="ct-lista">
          {opcoes.map((o, i) => (
            <li key={o.valor} role="option" aria-selected={o.valor === valor} className={i === foco ? 'foco' : ''} onPointerEnter={() => setFoco(i)} onClick={() => escolher(o.valor)}>
              {o.cor && <i className="ct-ponto" style={{ background: o.cor }} />}
              <span className="ct-texto">{o.nome}</span>
              {o.valor === valor && <Visto />}
            </li>
          ))}
        </ul>,
        { id, role: 'listbox', label: rotulo },
      )}
    </>
  )
}

/** Campo com sugestões (no lugar do <datalist>): mostra os tópicos que já existem e oferece criar um novo. */
export function CampoComSugestoes({
  valor,
  aoMudar,
  sugestoes,
  corDe,
  rotulo,
  placeholder,
  travado,
  dica,
}: {
  valor: string
  aoMudar: (v: string) => void
  sugestoes: string[]
  corDe?: (s: string) => string
  rotulo: string
  placeholder?: string
  travado?: boolean
  dica?: string
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const id = useId()
  const b = useBalao(caixa, 8 * 34 + 12)
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const filtradas = sugestoes.filter((s) => !valor.trim() || norm(s).includes(norm(valor))).slice(0, 8)
  const novo = valor.trim() && !sugestoes.some((s) => norm(s) === norm(valor)) ? valor.trim() : null
  const itens = [...filtradas, ...(novo ? [novo] : [])]
  const [foco, setFoco] = useState(-1)
  const escolher = (s: string) => {
    aoMudar(s)
    b.setAberto(false)
  }
  const tecla = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      b.setAberto(true)
      if (itens.length) setFoco((f) => (e.key === 'ArrowDown' ? (f + 1) % itens.length : (f - 1 + itens.length) % itens.length))
    } else if (e.key === 'Enter' && b.aberto && foco >= 0 && itens[foco]) {
      e.preventDefault()
      escolher(itens[foco])
    } else if (e.key === 'Escape' && b.aberto) {
      e.preventDefault()
      b.setAberto(false)
    }
  }
  return (
    <div ref={caixa} className={`ct-gatilho ct-campo${b.aberto ? ' aberto' : ''}${travado ? ' auto' : ''}`} title={travado ? dica : undefined} onClick={() => campo.current?.focus()}>
      <i className="ct-ponto" style={{ background: valor.trim() && corDe ? corDe(valor.trim()) : 'var(--input-border-hover)' }} />
      <input
        ref={campo}
        value={valor}
        onChange={(e) => {
          aoMudar(e.target.value)
          setFoco(-1)
          b.setAberto(true)
        }}
        onFocus={() => b.setAberto(true)}
        onKeyDown={tecla}
        placeholder={placeholder}
        aria-label={rotulo}
        role="combobox"
        aria-expanded={b.aberto}
        aria-controls={id}
        aria-autocomplete="list"
        maxLength={40}
        disabled={travado}
      />
      {travado && <small className="ct-auto">auto</small>}
      {itens.length > 0 &&
        b.render(
          <ul className="ct-lista">
            {itens.map((s, i) => (
              <li key={s} role="option" aria-selected={norm(s) === norm(valor)} className={i === foco ? 'foco' : ''} onPointerEnter={() => setFoco(i)} onPointerDown={(e) => e.preventDefault()} onClick={() => escolher(s)}>
                {s === novo ? <span className="ct-mais">+</span> : <i className="ct-ponto" style={{ background: corDe?.(s) }} />}
                <span className="ct-texto">{s === novo ? <>Criar “{s}”</> : s}</span>
                {s !== novo && norm(s) === norm(valor) && <Visto />}
              </li>
            ))}
          </ul>,
          { id, role: 'listbox', label: rotulo },
        )}
    </div>
  )
}

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const deIso = (s: string) => {
  const [a, m, d] = s.split('-').map(Number)
  return new Date(a, m - 1, d)
}

/** Escolha de dia (no lugar do <input type=date>): atalhos (hoje, amanhã, próxima segunda) e um mês com as semanas. */
export function EscolhaDeData({ valor, aoMudar, rotulo, texto, travado, dica }: { valor: string | null; aoMudar: (v: string | null) => void; rotulo: string; texto: (v: string) => string; travado?: boolean; dica?: string }) {
  const gatilho = useRef<HTMLButtonElement>(null)
  const b = useBalao(gatilho, 360)
  const hoje = new Date()
  const base = valor ? deIso(valor) : hoje
  const [mes, setMes] = useState({ a: base.getFullYear(), m: base.getMonth() })
  useEffect(() => {
    if (!b.aberto) return
    const d = valor ? deIso(valor) : new Date()
    setMes({ a: d.getFullYear(), m: d.getMonth() })
  }, [b.aberto]) // eslint-disable-line react-hooks/exhaustive-deps
  const escolher = (v: string | null) => {
    aoMudar(v)
    b.setAberto(false)
    gatilho.current?.focus()
  }
  const somar = (n: number) => iso(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + n))
  const proximaSegunda = somar(((1 - hoje.getDay() + 7) % 7) || 7)
  const atalhos: [string, string][] = [
    ['Hoje', somar(0)],
    ['Amanhã', somar(1)],
    ['Próx. segunda', proximaSegunda],
    ['Em 1 semana', somar(7)],
  ]
  const primeiro = new Date(mes.a, mes.m, 1).getDay()
  const total = new Date(mes.a, mes.m + 1, 0).getDate()
  const dias: (number | null)[] = [...Array(primeiro).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]
  while (dias.length % 7) dias.push(null)
  const hojeIso = iso(hoje)
  const mudarMes = (n: number) => setMes(({ a, m }) => ({ a: a + Math.floor((m + n) / 12), m: (m + n + 12) % 12 }))

  return (
    <>
      <button
        ref={gatilho}
        type="button"
        className={`ct-gatilho${b.aberto ? ' aberto' : ''}${travado ? ' auto' : ''}${valor ? '' : ' sem-valor'}`}
        aria-haspopup="dialog"
        aria-expanded={b.aberto}
        aria-label={`${rotulo}: ${valor ? texto(valor) : 'sem prazo'}`}
        title={travado ? dica : undefined}
        disabled={travado}
        onClick={() => b.setAberto(!b.aberto)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && b.aberto) {
            e.preventDefault()
            b.setAberto(false)
          }
        }}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden className="ct-icone">
          <rect x="2.5" y="3.5" width="11" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="ct-texto">{valor ? texto(valor) : 'Prazo'}</span>
        {travado ? <small className="ct-auto">auto</small> : <Seta />}
      </button>
      {b.render(
        <div
          className="ct-data"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              b.setAberto(false)
              gatilho.current?.focus()
            }
          }}
        >
          <div className="ct-atalhos">
            {atalhos.map(([nome, v]) => (
              <button key={nome} type="button" className={valor === v ? 'ativo' : ''} onClick={() => escolher(v)}>{nome}</button>
            ))}
          </div>
          <div className="ct-mes">
            <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior">‹</button>
            <strong>{MESES[mes.m]} {mes.a !== hoje.getFullYear() ? mes.a : ''}</strong>
            <button type="button" onClick={() => mudarMes(1)} aria-label="Próximo mês">›</button>
          </div>
          <div className="ct-grade" role="grid">
            {SEMANA.map((s, i) => (
              <span key={i} className="ct-sem">{s}</span>
            ))}
            {dias.map((d, i) => {
              if (!d) return <span key={i} />
              const v = iso(new Date(mes.a, mes.m, d))
              return (
                <button key={i} type="button" className={`${v === valor ? 'escolhido' : ''}${v === hojeIso ? ' hoje' : ''}${v < hojeIso ? ' passado' : ''}`} onClick={() => escolher(v)} aria-label={`${d} de ${MESES[mes.m]}`} aria-pressed={v === valor}>
                  {d}
                </button>
              )
            })}
          </div>
          {valor && (
            <button type="button" className="ct-limpar" onClick={() => escolher(null)}>Tirar prazo</button>
          )}
        </div>,
        { role: 'dialog', label: rotulo },
      )}
    </>
  )
}

/** Chave liga/desliga (no lugar do checkbox). */
export function Chave({ ligada, aoMudar, children }: { ligada: boolean; aoMudar: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={ligada} className={`ct-chave${ligada ? ' ligada' : ''}`} onClick={() => aoMudar(!ligada)}>
      <span className="ct-chave-trilho"><span /></span>
      {children}
    </button>
  )
}
