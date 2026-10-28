import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Group, MeshToonMaterial } from 'three'
import { useEscritorio } from '../store/escritorio'
import { Outlines } from '@react-three/drei'
import { CONTORNO, GRADIENTE } from './toon'

/** Sua mesa de aprovação: pisca quando algum post espera por você. */
export function MesaVoce({ posicao }: { posicao: [number, number] }) {
  const aguardando = useEscritorio((s) => s.aguardandoVoce)
  const focar = useEscritorio((s) => s.focar)
  const aberta = useEscritorio((s) => s.foco === 'voce')
  const [hover, setHover] = useState(false)
  const tampo = useRef<MeshToonMaterial>(null)

  const marcador = useRef<Group>(null)
  const voce = useRef<Group>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (voce.current) {
      // você respira e, quando chega post, fica pulando de animação
      voce.current.position.y = aguardando ? Math.abs(Math.sin(t * 5)) * 0.12 : 0
      voce.current.scale.y = 1 + Math.sin(t * 2) * 0.02
    }
    if (marcador.current) {
      marcador.current.visible = aguardando
      marcador.current.position.y = 2.75 + Math.abs(Math.sin(clock.elapsedTime * 4)) * 0.25
      marcador.current.rotation.y = clock.elapsedTime * 2
    }
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
        <meshToonMaterial gradientMap={GRADIENTE} ref={tampo} color="#faf5eb" emissive="#976822" emissiveIntensity={0} />
      </mesh>
      <mesh castShadow position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.08, 0.2, 0.74, 8]} />
        <meshToonMaterial gradientMap={GRADIENTE} color="#8d8f99" />
      </mesh>
      {/* você, sentado atrás da mesa, olhando para a sala */}
      <mesh castShadow position={[0, 0.45, -0.85]}>
        <boxGeometry args={[0.62, 0.1, 0.6]} />
        <meshToonMaterial gradientMap={GRADIENTE} color="#976822" />
      </mesh>
      <mesh castShadow position={[0, 0.85, -1.15]}>
        <boxGeometry args={[0.66, 0.8, 0.1]} />
        <meshToonMaterial gradientMap={GRADIENTE} color="#976822" />
      </mesh>
      <group ref={voce} position={[0, 0, -0.8]}>
        <mesh castShadow position={[0, 0.82, 0]}>
          <capsuleGeometry args={[0.22, 0.26, 4, 10]} />
          <meshToonMaterial gradientMap={GRADIENTE} color="#1e3d66" />
          <Outlines thickness={0.045} color={CONTORNO} />
        </mesh>
        <mesh castShadow position={[0, 1.38, 0]}>
          <sphereGeometry args={[0.32, 18, 14]} />
          <meshToonMaterial gradientMap={GRADIENTE} color="#f3cfa8" />
          <Outlines thickness={0.045} color={CONTORNO} />
        </mesh>
        <mesh position={[0, 1.5, -0.04]} rotation={[-0.35, 0, 0]}>
          <sphereGeometry args={[0.33, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
          <meshToonMaterial gradientMap={GRADIENTE} color="#262820" />
        </mesh>
        {[-0.11, 0.11].map((x) => (
          <mesh key={x} position={[x, 1.4, 0.29]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshBasicMaterial color={CONTORNO} />
          </mesh>
        ))}
      </group>
      {/* bandeja de entrada */}
      <mesh position={[0.35, 0.83, 0.1]}>
        <boxGeometry args={[0.5, 0.06, 0.4]} />
        <meshToonMaterial gradientMap={GRADIENTE} color="#1e3d66" />
      </mesh>
      <group ref={marcador} visible={false} position={[0, 2.75, -0.8]}>
        <mesh position={[0, 0.14, 0]}>
          <boxGeometry args={[0.14, 0.36, 0.14]} />
          <meshBasicMaterial color="#f2b233" />
        </mesh>
        <mesh position={[0, -0.15, 0]}>
          <boxGeometry args={[0.14, 0.14, 0.14]} />
          <meshBasicMaterial color="#f2b233" />
        </mesh>
      </group>
      <Html position={[0, 2.3, -0.8]} center distanceFactor={12} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="etiqueta">
          {aguardando && <div className="balao balao-esperando_voce">Post esperando sua aprovação</div>}
          <div className="nome" style={{ ['--cor' as string]: '#976822' }}>
            <span className="ponto" style={{ background: '#976822' }} />
            Você
          </div>
        </div>
      </Html>
    </group>
  )
}
