import { Suspense } from 'react'
import { Escritorio } from './office/Escritorio'
import { PainelAgente } from './ui/PainelAgente'
import { LinhaDoTempo } from './ui/LinhaDoTempo'
import { useEscritorio } from './store/escritorio'
import { rodarDemo, pararDemo } from './lib/simulacao'
import { modoDemo } from './lib/supabase'

export default function App() {
  const aplicar = useEscritorio((s) => s.aplicar)
  const reiniciar = useEscritorio((s) => s.reiniciar)

  const demo = () => {
    pararDemo()
    reiniciar()
    rodarDemo(aplicar)
  }

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          <h1>Escritório de Agentes</h1>
          <span className="chip">Drinfy</span>
          {modoDemo && <span className="chip chip-demo">modo demonstração</span>}
        </div>
        <button className="primario" onClick={demo}>Rodar demonstração</button>
      </header>

      <main className="palco">
        <Suspense fallback={<p className="carregando">Montando o escritório…</p>}>
          <Escritorio />
        </Suspense>
        <PainelAgente />
      </main>

      <footer className="rodape">
        <LinhaDoTempo />
      </footer>
    </div>
  )
}
