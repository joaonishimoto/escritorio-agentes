import { useEscritorio } from '../store/escritorio'
import type { Post } from '../lib/dados'

function IconeMesa() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 13h16l-1.5-7h-13z" />
      <path d="M4 13v5h16v-5M9 16h6" />
    </svg>
  )
}

const quando = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`
}

/** Sua mesa: tudo que está esperando você, de todas as salas. Você escolhe qual abrir. */
export function SuaMesa({
  pendentes,
  marcas,
  aoAbrirPost,
}: {
  pendentes: Post[]
  marcas: { id: string; nome: string; cor: string }[]
  aoAbrirPost: (p: Post) => void
}) {
  const focar = useEscritorio((s) => s.focar)
  const aprovar = pendentes.filter((p) => p.status !== 'erro')
  const comErro = pendentes.filter((p) => p.status === 'erro')
  const linha = (p: Post) => {
    const m = marcas.find((x) => x.id === p.marca_id)
    const capa = [...(p.slides ?? [])].sort((a, b) => a.ordem - b.ordem)[0]?.url
    return (
      <li key={p.id}>
        <button className="sm-post" onClick={() => aoAbrirPost(p)}>
          <span className="sm-capa" style={{ ['--cor' as string]: m?.cor ?? '#2a5288' }}>{capa ? <img src={capa} alt="" loading="lazy" /> : null}</span>
          <span className="sm-texto">
            <span className="sm-marca"><i style={{ background: m?.cor }} />{m?.nome ?? 'Marca'} · {quando(p.criado_em)}</span>
            <strong>{p.briefing}</strong>
          </span>
          <span className="sm-ir" aria-hidden>›</span>
        </button>
      </li>
    )
  }
  return (
    <aside className="painel ag sm" aria-label="Sua mesa" style={{ ['--cor-agente' as string]: '#d99a1e', ['--cor-estado' as string]: pendentes.length ? '#d99a1e' : '#9aa3b2' }}>
      <header className="ag-capa">
        <button className="ag-fechar" onClick={() => focar(null)} aria-label="Fechar painel">×</button>
        <span className="ag-icone">
          <IconeMesa />
        </span>
        <div className="ag-nome">
          <h2>Sua mesa</h2>
          <p>{pendentes.length ? `${pendentes.length} ${pendentes.length === 1 ? 'post esperando' : 'posts esperando'} você, de todas as salas.` : 'Os posts chegam aqui quando a equipe termina e o revisor aprova.'}</p>
        </div>
      </header>
      <div className="ag-corpo">
        {pendentes.length === 0 ? (
          <div className="ag-vazio">
            <span className="ag-vazio-icone"><IconeMesa /></span>
            <strong>Mesa limpa</strong>
            <p>Nenhum post esperando você agora.</p>
          </div>
        ) : (
          <>
            {aprovar.length > 0 && (
              <section className="sm-grupo">
                <h3>Para aprovar</h3>
                <ul>{aprovar.map(linha)}</ul>
              </section>
            )}
            {comErro.length > 0 && (
              <section className="sm-grupo erro">
                <h3>Pararam com erro</h3>
                <ul>{comErro.map(linha)}</ul>
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
