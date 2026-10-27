import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { agentePorId, MESA_VOCE, type AgenteId } from '../agents/catalogo'
import { useEscritorio, type Entrega } from '../store/escritorio'

const DURACAO_MS = 1400

const posicaoDe = (id: AgenteId | 'voce'): [number, number] => {
  if (id === 'voce') return MESA_VOCE
  const [x, z] = agentePorId(id).mesa
  return [x, z]
}

/** Pasta que voa em arco de uma mesa para a outra quando um agente entrega o trabalho. */
function Pasta({ entrega }: { entrega: Entrega }) {
  const ref = useRef<Group>(null)
  const [x0, z0] = posicaoDe(entrega.de)
  const [x1, z1] = posicaoDe(entrega.para)

  useFrame(() => {
    if (!ref.current) return
    const p = Math.min((performance.now() - entrega.inicio) / DURACAO_MS, 1)
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
    ref.current.visible = p < 1
    ref.current.position.set(x0 + (x1 - x0) * e, 1 + Math.sin(Math.PI * e) * 2.2, z0 + (z1 - z0) * e)
    ref.current.rotation.y = e * Math.PI * 2
  })

  return (
    <group ref={ref}>
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.06, 0.36]} />
        <meshStandardMaterial color="#f2c14e" flatShading />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.42, 0.02, 0.3]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

export function Pastas() {
  const entregas = useEscritorio((s) => s.entregas)
  return (
    <>
      {entregas.map((e) => (
        <Pasta key={e.id} entrega={e} />
      ))}
    </>
  )
}
