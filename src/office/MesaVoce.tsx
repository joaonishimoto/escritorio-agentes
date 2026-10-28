import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { MeshStandardMaterial } from 'three'
import { useEscritorio } from '../store/escritorio'

/** Sua mesa de aprovação: pisca quando algum post espera por você. */
export function MesaVoce({ posicao }: { posicao: [number, number] }) {
  const aguardando = useEscritorio((s) => s.aguardandoVoce)
  const focar = useEscritorio((s) => s.focar)
  const aberta = useEscritorio((s) => s.foco === 'voce')
  const [hover, setHover] = useState(false)
  const tampo = useRef<MeshStandardMaterial>(null)

  useFrame(({ clock }) => {
    if (!tampo.current) return
    tampo.current.emissiveIntensity = aguardando ? 0.35 + Math.sin(clock.elapsedTime * 5) * 0.3 : 0
  })

  return (
    <group
      position={[posicao[0], 0, posicao[1]]}
      onClick={(e) => {
        e.stopPropagation()
        focar('voce')
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHover(false)
        document.body.style.cursor = ''
      }}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.8, aberta || hover ? 0.98 : 0.88, 32]} />
        <meshBasicMaterial color="#976822" transparent opacity={aberta || hover || aguardando ? 0.85 : 0.35} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.75, 0]}>
        <boxGeometry args={[1.4, 0.08, 1]} />
        <meshStandardMaterial ref={tampo} color="#faf5eb" emissive="#976822" emissiveIntensity={0} />
      </mesh>
      <mesh castShadow position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.08, 0.2, 0.74, 8]} />
        <meshStandardMaterial color="#8d8f99" />
      </mesh>
      {/* bandeja de entrada */}
      <mesh position={[0.35, 0.83, 0.1]}>
        <boxGeometry args={[0.5, 0.06, 0.4]} />
        <meshStandardMaterial color="#1e3d66" />
      </mesh>
      <Html position={[0, 1.5, 0]} center distanceFactor={12} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="etiqueta">
          {aguardando && <div className="balao balao-esperando_voce">Post esperando sua aprovação</div>}
          <div className="nome" style={{ borderColor: '#976822' }}>
            <span className="ponto" style={{ background: '#976822' }} />
            Você
          </div>
        </div>
      </Html>
    </group>
  )
}
