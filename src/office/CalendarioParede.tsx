import { Html } from '@react-three/drei'
import { useEscritorio } from '../store/escritorio'
import { diasDoMes, MESES, chaveDia } from '../ui/Calendario'
import { GRADIENTE } from './toon'

/** Calendário pendurado na parede do fundo: mostra o mês atual com os posts agendados e publicados. */
export function CalendarioParede({ x, z, rot }: { x: number; z: number; rot: number }) {
  const agenda = useEscritorio((s) => s.agenda)
  const focar = useEscritorio((s) => s.focar)
  const hoje = new Date()
  const dias = diasDoMes(hoje.getFullYear(), hoje.getMonth())
  const porDia = new Map<string, string[]>()
  for (const item of agenda) {
    const k = chaveDia(new Date(item.data))
    porDia.set(k, [...(porDia.get(k) ?? []), item.status])
  }

  return (
    <group
      position={[x, 1.65, z]}
      rotation={[0, rot, 0]}
      onClick={(e) => {
        e.stopPropagation()
        focar('calendario')
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = ''
      }}
    >
      <mesh castShadow>
        <boxGeometry args={[2.9, 2.25, 0.06]} />
        <meshToonMaterial gradientMap={GRADIENTE} color="#1e3d66" />
      </mesh>
      {/* o clique fica na moldura 3D; o HTML é só a folha do calendário */}
      <Html transform position={[0, 0, 0.04]} distanceFactor={2} zIndexRange={[5, 0]} pointerEvents="none">
        <div className="cal-parede" aria-hidden>
          <div className="cal-parede-mes">
            {MESES[hoje.getMonth()]} <span>{hoje.getFullYear()}</span>
          </div>
          <div className="cal-parede-grade">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
              <span key={i} className="cal-sem">{d}</span>
            ))}
            {dias.map((d, i) => {
              const status = d ? porDia.get(chaveDia(d)) ?? [] : []
              const eHoje = d && chaveDia(d) === chaveDia(hoje)
              return (
                <span key={i} className={`cal-dia${eHoje ? ' hoje' : ''}${d ? '' : ' vazio'}`}>
                  {d?.getDate()}
                  {status.length > 0 && (
                    <i className={status.includes('falhou') ? 'falhou' : status.includes('agendado') ? 'agendado' : 'publicado'} />
                  )}
                </span>
              )
            })}
          </div>
        </div>
      </Html>
    </group>
  )
}
