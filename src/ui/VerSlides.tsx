import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** Slides em tela cheia: setas do teclado ou botões passam, Esc fecha. Clique, roda do mouse ou +/− dão zoom. */
export function VerSlides({ urls, inicial, aoFechar }: { urls: string[]; inicial: number; aoFechar: () => void }) {
  const [i, setI] = useState(inicial)
  const [zoom, setZoom] = useState(1)
  const [origem, setOrigem] = useState('50% 50%')
  const ir = (n: number) => {
    setZoom(1)
    setI((atual) => (atual + n + urls.length) % urls.length)
  }
  const ajustar = (fator: number) => setZoom((z) => Math.min(4, Math.max(1, Math.round(z * fator * 100) / 100)))
  // com zoom, a posição do mouse na tela escolhe que parte do slide aparece: mover o mouse percorre o slide
  const mirar = (e: React.MouseEvent) => {
    const x = (e.clientX / window.innerWidth) * 100
    const y = (e.clientY / window.innerHeight) * 100
    setOrigem(`${x.toFixed(1)}% ${y.toFixed(1)}%`)
  }

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') ir(1)
      else if (e.key === 'ArrowLeft') ir(-1)
      else if (e.key === 'Escape') {
        if (zoom > 1) setZoom(1)
        else aoFechar()
      }
      else if (e.key === '+' || e.key === '=') ajustar(1.5)
      else if (e.key === '-') ajustar(1 / 1.5)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  // vai direto para o <body>: fica por cima de painéis, pílulas e etiquetas, seja de onde for aberto
  return createPortal(
    <div className="ver-slides" role="dialog" aria-label={`Slide ${i + 1} de ${urls.length}`} onClick={aoFechar}>
      <button className="ver-fechar" onClick={aoFechar} aria-label="Fechar">×</button>
      {urls.length > 1 && (
        <button className="ver-seta esquerda" onClick={(e) => { e.stopPropagation(); ir(-1) }} aria-label="Slide anterior">‹</button>
      )}
      <img
        src={urls[i]}
        alt={`Slide ${i + 1}`}
        className={zoom > 1 ? 'ampliado' : ''}
        style={{ transform: `scale(${zoom})`, transformOrigin: origem }}
        onClick={(e) => {
          e.stopPropagation()
          mirar(e)
          setZoom((z) => (z > 1 ? 1 : 2.5))
        }}
        onMouseMove={(e) => zoom > 1 && mirar(e)}
        onWheel={(e) => {
          mirar(e)
          ajustar(e.deltaY < 0 ? 1.15 : 1 / 1.15)
        }}
      />
      {urls.length > 1 && (
        <button className="ver-seta direita" onClick={(e) => { e.stopPropagation(); ir(1) }} aria-label="Próximo slide">›</button>
      )}
      <div className="ver-pontos" onClick={(e) => e.stopPropagation()}>
        {urls.map((_, n) => (
          <button key={n} className={n === i ? 'ativo' : ''} onClick={() => setI(n)} aria-label={`Ir para o slide ${n + 1}`} />
        ))}
      </div>
      <span className="ver-contador mono">
        {i + 1} / {urls.length}
        {zoom > 1 ? ` · ${Math.round(zoom * 100)}%` : ' · clique para ampliar'}
      </span>
    </div>,
    document.body,
  )
}
