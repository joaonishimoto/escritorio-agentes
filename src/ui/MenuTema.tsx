import { useTema, type Tema } from '../lib/tema'

const OPCOES: { tema: Tema; rotulo: string }[] = [
  { tema: 'claro', rotulo: 'Claro' },
  { tema: 'escuro', rotulo: 'Escuro' },
  { tema: 'automatico', rotulo: 'Automático' },
]

/** Escolha do tema dentro do menu ⋯ do escritório (salva no aparelho). */
export function MenuTema() {
  const { tema, escolher } = useTema()
  return (
    <div className="menu-tema" role="group" aria-label="Tema">
      <span>Tema</span>
      {OPCOES.map((o) => (
        <button key={o.tema} role="menuitemradio" aria-checked={tema === o.tema} onClick={() => escolher(o.tema)}>
          <i aria-hidden>{tema === o.tema ? '●' : ''}</i>
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}
