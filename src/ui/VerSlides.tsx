import { useEffect, useState } from 'react'

/** Slides em tela cheia: setas do teclado ou botões passam, Esc fecha. */
export function VerSlides({ urls, inicial, aoFechar }: { urls: string[]; inicial: number; aoFechar: () => void }) {
  const [i, setI] = useState(inicial)
  const ir = (n: number) => setI((atual) => (atual + n + urls.length) % urls.length)

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') ir(1)
      else if (e.key === 'ArrowLeft') ir(-1)
      else if (e.key === 'Escape') aoFechar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="ver-slides" role="dialog" aria-label={`Slide ${i + 1} de ${urls.length}`} onClick={aoFechar}>
      <button className="ver-fechar" onClick={aoFechar} aria-label="Fechar">×</button>
      {urls.length > 1 && (
        <button className="ver-seta esquerda" onClick={(e) => { e.stopPropagation(); ir(-1) }} aria-label="Slide anterior">‹</button>
      )}
      <img src={urls[i]} alt={`Slide ${i + 1}`} onClick={(e) => e.stopPropagation()} />
      {urls.length > 1 && (
        <button className="ver-seta direita" onClick={(e) => { e.stopPropagation(); ir(1) }} aria-label="Próximo slide">›</button>
      )}
      <div className="ver-pontos" onClick={(e) => e.stopPropagation()}>
        {urls.map((_, n) => (
          <button key={n} className={n === i ? 'ativo' : ''} onClick={() => setI(n)} aria-label={`Ir para o slide ${n + 1}`} />
        ))}
      </div>
      <span className="ver-contador mono">{i + 1} / {urls.length}</span>
    </div>
  )
}
