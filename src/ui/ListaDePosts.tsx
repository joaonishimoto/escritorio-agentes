import type { Post } from '../lib/dados'

const GRUPOS: [string, string[]][] = [
  ['Esperando você', ['aguardando_aprovacao']],
  ['Em produção', ['em_producao', 'rascunho', 'aprovado']],
  ['Agendados', ['agendado']],
  ['Na gaveta', ['guardado']],
  ['Com erro', ['erro']],
  ['Publicados', ['publicado']],
  ['Reprovados', ['reprovado']],
]

function quando(p: Post) {
  const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  if (p.status === 'agendado' && p.agendado_para) return `sai ${fmt(p.agendado_para)}`
  if (p.status === 'publicado' && p.publicado_em) return `saiu ${fmt(p.publicado_em)}`
  return `criado ${fmt(p.criado_em)}`
}

/** Barra lateral com os posts da marca: clicar num post põe o escritório para mostrar esse post. */
export function ListaDePosts({
  posts,
  postId,
  emDemo,
  aberta,
  aoEscolher,
  aoNovo,
  aoFechar,
  aoAbrir,
}: {
  posts: Post[]
  postId: string | null
  emDemo: boolean
  aberta: boolean
  aoEscolher: (id: string) => void
  aoNovo?: () => void
  aoFechar: () => void
  aoAbrir: () => void
}) {
  return (
    <aside className={`lista-posts${aberta ? ' aberta' : ''}`} aria-label="Posts da marca">
      {/* recolhida: só as capas, uma embaixo da outra; clicar abre o post */}
      <div className="lista-trilho" aria-hidden={aberta}>
        {aoNovo && (
          <button className="trilho-novo" onClick={aoNovo} aria-label="Novo post" title="Novo post" tabIndex={aberta ? -1 : 0}>+</button>
        )}
        {posts.slice(0, 30).map((p) => {
          const capa = [...(p.slides ?? [])].sort((a, b) => a.ordem - b.ordem)[0]?.url
          return (
            <button
              key={p.id}
              className={`trilho-post${p.id === postId && !emDemo ? ' ativo' : ''}`}
              onClick={() => aoEscolher(p.id)}
              title={p.briefing}
              aria-label={p.briefing}
              tabIndex={aberta ? -1 : 0}
            >
              {capa ? <img src={capa} alt="" loading="lazy" /> : <span />}
              <i className={`ponto-status status-${p.status}`} />
            </button>
          )
        })}
        <button className="trilho-abrir" onClick={aoAbrir} aria-label="Abrir lista de posts" title="Abrir lista" tabIndex={aberta ? -1 : 0}>›</button>
      </div>
      <div className="lista-cheia" aria-hidden={!aberta}>
      <header className="lista-posts-topo">
        <h2>Posts</h2>
        {aoNovo && <button className="primario" onClick={aoNovo}>Novo post</button>}
        <button className="icone lista-posts-fechar" onClick={aoFechar} aria-label="Recolher lista de posts" title="Recolher">‹</button>
      </header>
      <div className="lista-posts-corpo">
        {emDemo && <p className="muted lista-posts-vazio">Na demonstração, o escritório mostra um post de exemplo.</p>}
        {!emDemo && posts.length === 0 && <p className="muted lista-posts-vazio">Nenhum post nesta sala ainda.</p>}
        {GRUPOS.map(([titulo, status]) => {
          const doGrupo = posts.filter((p) => status.includes(p.status))
          if (!doGrupo.length) return null
          return (
            <section key={titulo} className="lista-posts-grupo">
              <h3>
                {titulo} <span>{doGrupo.length}</span>
              </h3>
              {doGrupo.map((p) => {
                const capa = [...(p.slides ?? [])].sort((a, b) => a.ordem - b.ordem)[0]?.url
                const aoVivo = p.status === 'em_producao' || p.status === 'aprovado'
                return (
                  <button
                    key={p.id}
                    className={`lista-post${p.id === postId && !emDemo ? ' ativo' : ''}`}
                    onClick={() => aoEscolher(p.id)}
                    aria-current={p.id === postId && !emDemo}
                  >
                    {capa ? <img src={capa} alt="" loading="lazy" /> : <span className="lista-post-capa" />}
                    <span className="lista-post-texto">
                      <span className="lista-post-titulo">{p.briefing}</span>
                      <small className="muted">
                        {aoVivo && <i className="ao-vivo" aria-label="trabalhando agora" />}
                        {aoVivo ? 'equipe trabalhando' : quando(p)}
                      </small>
                    </span>
                  </button>
                )
              })}
            </section>
          )
        })}
      </div>
      </div>
    </aside>
  )
}
