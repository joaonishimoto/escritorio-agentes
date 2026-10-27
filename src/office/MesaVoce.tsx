import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { MeshStandardMaterial } from 'three'
import { useEscritorio } from '../store/escritorio'

/** Sua mesa de aprovação: pisca quando algum post espera por você. */
export function MesaVoce({ posicao }: { posicao: [number, number] }) {
  const aguardando = useEscritorio((s) => s.aguardandoVoce)
  const tampo = useRef<MeshStandardMaterial>(null)

  useFrame(({ clock }) => {
    if (!tampo.current) return
    tampo.current.emissiveIntensity = aguardando ? 0.35 + Math.sin(clock.elapsedTime * 5) * 0.3 : 0
  })

  return (
    <group position={[posicao[0], 0, posicao[1]]}>
      <mesh castShadow receiveShadow position={[0, 0.75, 0]}>
        <boxGeometry args={[1.4, 0.08, 1]} />
        <meshStandardMaterial ref={tampo} color="#f2eefa" emissive="#9a52d6" emissiveIntensity={0} />
      </mesh>
      <mesh castShadow position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.08, 0.2, 0.74, 8]} />
        <meshStandardMaterial color="#8d8f99" />
      </mesh>
      {/* bandeja de entrada */}
      <mesh position={[0.35, 0.83, 0.1]}>
        <boxGeometry args={[0.5, 0.06, 0.4]} />
        <meshStandardMaterial color="#5d6472" />
      </mesh>
      <Html position={[0, 1.5, 0]} center distanceFactor={12} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="etiqueta">
          {aguardando && <div className="balao balao-esperando_voce">Post esperando sua aprovação</div>}
          <div className="nome" style={{ borderColor: '#9a52d6' }}>
            <span className="ponto" style={{ background: '#9a52d6' }} />
            Você
          </div>
        </div>
      </Html>
    </group>
  )
}
