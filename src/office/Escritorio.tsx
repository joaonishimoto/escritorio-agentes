import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { AGENTES, MESA_VOCE } from '../agents/catalogo'
import { useEscritorio } from '../store/escritorio'
import { EstacaoAgente } from './EstacaoAgente'
import { MesaVoce } from './MesaVoce'
import { Pastas } from './Pastas'
import { Ambiente } from './Ambiente'
import { CalendarioParede } from './CalendarioParede'
import { SALA } from './salas'

export function Escritorio() {
  const selecionar = useEscritorio((s) => s.selecionar)

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [13, 12, 13], fov: 32 }}
      onPointerMissed={() => { selecionar(null) }}
    >
      <color attach="background" args={[SALA.cores.fundo]} />
      <hemisphereLight args={[SALA.cores.ceu, SALA.cores.solo, SALA.luz < 1 ? 0.55 : 1.15]} />
      <directionalLight
        position={[6, 12, 4]}
        intensity={SALA.luz}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      <Entrada />
      <Ambiente />
      <CalendarioParede />
      {AGENTES.map((a) => (
        <EstacaoAgente key={a.id} agente={a} />
      ))}
      <MesaVoce posicao={MESA_VOCE} />
      <Pastas />

      <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={20} blur={2.2} far={4} />
      <OrbitControls
        target={[0, 0, 0]}
        enablePan={false}
        minDistance={9}
        maxDistance={26}
        minPolarAngle={0.5}
        maxPolarAngle={1.15}
      />
    </Canvas>
  )
}

/** Câmera desce girando até a posição normal quando o escritório abre. */
function Entrada() {
  const inicio = useRef<number | null>(null)
  useFrame(({ camera, clock }) => {
    if (inicio.current === null) inicio.current = clock.elapsedTime
    const p = Math.min((clock.elapsedTime - inicio.current) / 1.6, 1)
    if (p >= 1) return
    const e = 1 - Math.pow(1 - p, 3)
    const ang = Math.PI / 4 + (1 - e) * 0.9
    const r = 18.4 + (1 - e) * 10
    camera.position.set(Math.sin(ang) * r, 12 + (1 - e) * 6, Math.cos(ang) * r)
    camera.lookAt(0, 0, 0)
  })
  return null
}
