import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { useEscritorio, type Entrega } from '../store/escritorio'
import { Outlines } from '@react-three/drei'
import { CONTORNO, GRADIENTE } from './toon'

const DURACAO_MS = 1400

/** Pasta que voa em arco de uma mesa para a outra quando um agente entrega o trabalho. */
function Pasta({ entrega }: { entrega: Entrega }) {
  const ref = useRef<Group>(null)
  const posicoes = useEscritorio((s) => s.posicoes)
  const [x0, z0] = posicoes[entrega.de] ?? [0, 0]
  const [x1, z1] = posicoes[entrega.para] ?? [0, 0]
  // viagens longas (atravessando o corredor) demoram mais e sobem mais alto
  const distancia = Math.hypot(x1 - x0, z1 - z0)
  const duracao = DURACAO_MS * Math.max(1, distancia / 7)
  const altura = 2.2 + Math.min(distancia / 6, 3)

  useFrame(() => {
    if (!ref.current) return
    const p = Math.min((performance.now() - entrega.inicio) / duracao, 1)
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
    ref.current.visible = p < 1
    ref.current.position.set(x0 + (x1 - x0) * e, 1 + Math.sin(Math.PI * e) * altura, z0 + (z1 - z0) * e)
    ref.current.rotation.y = e * Math.PI * 2
    ref.current.rotation.z = Math.sin(p * Math.PI * 4) * 0.25
    // estica na subida, achata na chegada
    const estica = 1 + Math.sin(Math.PI * p) * 0.35
    ref.current.scale.set(1 / Math.sqrt(estica), estica, 1 / Math.sqrt(estica))
  })

  return (
    <group ref={ref}>
      <mesh castShadow>
        <boxGeometry args={[0.56, 0.1, 0.42]} />
        <meshToonMaterial gradientMap={GRADIENTE} color="#f2b233" />
        <Outlines thickness={0.02} color={CONTORNO} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.46, 0.03, 0.34]} />
        <meshToonMaterial gradientMap={GRADIENTE} color="#ffffff" />
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
