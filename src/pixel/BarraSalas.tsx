// Barra no alto do escritório com uma entrada por sala: clicar leva a câmera até a sala, arrastar muda a ordem.
// É a mesma barra na vista em pixel art e na vista 3D.
import { useEffect, useRef, useState } from 'react'
import { AGENTES } from '../agents/catalogo'
import type { Estado } from '../store/escritorio'
import type { MarcaNoAndar } from './EscritorioPixel'

export type AlvoDaBarra = { marca: string } | 'equipe' | 'voce' | 'financeiro'

export function BarraSalas({
  marcas,
  indiceAtivo,
  estados,
  porSala,
  naSuaMesa,
  aoReordenar,
  irPara,
  corDe,
}: {
  marcas: MarcaNoAndar[]
  indiceAtivo: number
  estados: Record<string, Estado>
  porSala?: Record<string, Partial<Record<string, Estado>>>
  naSuaMesa: number
  aoReordenar?: (ids: string[]) => void
  irPara: (alvo: AlvoDaBarra) => void
  corDe: (m: MarcaNoAndar) => string
}) {
  // arrastar um nome da barra para o lado troca a sala de lugar
  const [arrastandoSala, setArrastandoSala] = useState<{ id: string; ids: string[]; x: number; moveu: boolean } | null>(null)
  const arrasteRef = useRef(arrastandoSala)
  arrasteRef.current = arrastandoSala
  useEffect(() => {
    if (!arrastandoSala) return
    const mover = (e: PointerEvent) => {
      const a = arrasteRef.current!
      if (!a.moveu && Math.abs(e.clientX - a.x) < 6) return
      const alvo = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-sala]')?.dataset.sala
      const ids = [...a.ids]
      if (alvo && alvo !== a.id) {
        ids.splice(ids.indexOf(a.id), 1)
        ids.splice(a.ids.indexOf(alvo), 0, a.id)
      }
      setArrastandoSala({ ...a, ids, moveu: true })
    }
    const soltar = () => {
      const a = arrasteRef.current!
      setArrastandoSala(null)
      if (a.moveu && a.ids.join() !== marcas.map((m) => m.id).join()) aoReordenar?.(a.ids)
      if (!a.moveu) irPara({ marca: a.id })
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar, { once: true })
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
    }
  }, [!!arrastandoSala]) // eslint-disable-line react-hooks/exhaustive-deps
  const naBarra = arrastandoSala ? arrastandoSala.ids.map((id) => marcas.find((m) => m.id === id)!).filter(Boolean) : marcas
  const situacao = (m: MarcaNoAndar, i: number) => {
    const lista = Object.values(i === indiceAtivo ? estados : porSala?.[m.id] ?? {})
    return lista.includes('erro') ? 'erro' : lista.some((e) => e === 'trabalhando' || e === 'na_fila') ? 'trabalhando' : lista.includes('esperando_voce') ? 'voce' : null
  }

  return (
    <nav className="pixel-salas" aria-label="Ir para a sala">
      {naBarra.map((m) => {
        const i = marcas.indexOf(m)
        const sit = situacao(m, i)
        return (
          <button
            key={m.id}
            data-sala={m.id}
            className={`${i === indiceAtivo ? 'ativo' : ''}${arrastandoSala?.moveu && arrastandoSala.id === m.id ? ' arrastando' : ''}`}
            style={{ ['--cor' as string]: corDe(m) }}
            title={aoReordenar ? 'Clique para ir até a sala. Arraste para mudar a ordem.' : undefined}
            onPointerDown={(e) => {
              if (e.button !== 0) return
              if (!aoReordenar) return
              e.preventDefault()
              setArrastandoSala({ id: m.id, ids: marcas.map((x) => x.id), x: e.clientX, moveu: false })
            }}
            onClick={(e) => (!aoReordenar || e.detail === 0) && irPara({ marca: m.id })}
            onKeyDown={(e) => {
              if (!aoReordenar || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
              const ids = marcas.map((x) => x.id)
              const de = ids.indexOf(m.id)
              const para = Math.max(0, Math.min(ids.length - 1, de + (e.key === 'ArrowLeft' ? -1 : 1)))
              if (de === para) return
              ids.splice(de, 1)
              ids.splice(para, 0, m.id)
              aoReordenar(ids)
            }}
          >
            <i aria-hidden />
            {m.nome}
            {sit && <span className={`pixel-salas-sit ${sit}`} title={sit === 'erro' ? 'Parou com erro' : sit === 'trabalhando' ? 'Trabalhando agora' : 'Esperando você'} />}
          </button>
        )
      })}
      <button style={{ ['--cor' as string]: '#2a5288' }} onClick={() => irPara('equipe')}>
        <i aria-hidden />
        Equipe
        {AGENTES.some((a) => estados[a.id] === 'trabalhando' || Object.values(porSala ?? {}).some((p) => p[a.id] === 'trabalhando')) && (
          <span className="pixel-salas-sit trabalhando" title="Trabalhando agora" />
        )}
      </button>
      <button style={{ ['--cor' as string]: '#f2b233' }} onClick={() => irPara('voce')}>
        <i aria-hidden />
        Sua sala
        {naSuaMesa > 0 && <span className="pixel-salas-conta">{naSuaMesa}</span>}
      </button>
      <button style={{ ['--cor' as string]: '#3f8f5b' }} onClick={() => irPara('financeiro')}>
        <i aria-hidden />
        Financeiro
      </button>
    </nav>
  )
}
