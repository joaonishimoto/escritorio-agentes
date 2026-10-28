// Chão, paredes e alguns objetos de escritório em low-poly feitos com primitivas. Cores e piso vêm da sala escolhida.
import { AGENTES, MESA_VOCE } from '../agents/catalogo'
import { SALA } from './salas'
import { GRADIENTE } from './toon'

const c = SALA.cores

function Planta({ posicao }: { posicao: [number, number, number] }) {
  return (
    <group position={posicao}>
      <mesh castShadow position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.28, 0.22, 0.5, 8]} />
        <meshToonMaterial gradientMap={GRADIENTE} color={c.vaso} />
      </mesh>
      <mesh castShadow position={[0, 0.85, 0]}>
        <icosahedronGeometry args={[0.45, 0]} />
        <meshToonMaterial gradientMap={GRADIENTE} color={c.planta} />
      </mesh>
    </group>
  )
}

/** Faixa no chão que liga as mesas na ordem em que o post passa por elas. */
function Trilha() {
  const ordem = ['chefe', 'pesquisador', 'redator', 'designer', 'revisor'].map((id) => AGENTES.find((a) => a.id === id)!.mesa)
  const pontos = [...ordem.map(([x, z]) => [x, z + 1.1] as [number, number]), MESA_VOCE]
  return (
    <>
      {pontos.slice(1).map(([x1, z1], i) => {
        const [x0, z0] = pontos[i]
        const dx = x1 - x0
        const dz = z1 - z0
        const comp = Math.hypot(dx, dz)
        return (
          <mesh key={i} receiveShadow rotation={[-Math.PI / 2, 0, -Math.atan2(dz, dx)]} position={[(x0 + x1) / 2, 0.006, (z0 + z1) / 2]}>
            <planeGeometry args={[comp + 0.5, 0.5]} />
            <meshToonMaterial gradientMap={GRADIENTE} color={c.tapete} />
          </mesh>
        )
      })}
    </>
  )
}

/** Luminária pendente com uma luz quente embaixo. */
function Luminaria({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 3.45, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.8]} />
        <meshBasicMaterial color="#0e131c" />
      </mesh>
      <mesh position={[0, 3, 0]}>
        <coneGeometry args={[0.38, 0.32, 16, 1, true]} />
        <meshToonMaterial gradientMap={GRADIENTE} color="#c9a77a" emissive="#f2c27a" emissiveIntensity={0.5} side={2} />
      </mesh>
      <pointLight position={[0, 2.7, 0]} color="#ffd59a" intensity={9} distance={5.5} decay={1.6} />
    </group>
  )
}

export function Ambiente() {
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 10]} />
        <meshToonMaterial gradientMap={GRADIENTE} color={c.chao} />
      </mesh>
      {SALA.piso === 'tapete' && (
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <planeGeometry args={[6.2, 2.4]} />
          <meshToonMaterial gradientMap={GRADIENTE} color={c.tapete} />
        </mesh>
      )}
      {SALA.piso === 'redondo' && (
        <>
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} scale={[1, 0.82, 1]}>
            <circleGeometry args={[3.1, 48]} />
            <meshToonMaterial gradientMap={GRADIENTE} color={c.tapete} />
          </mesh>
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} scale={[1, 0.82, 1]}>
            <ringGeometry args={[5.6, 5.75, 64]} />
            <meshToonMaterial gradientMap={GRADIENTE} color={c.perna} />
          </mesh>
        </>
      )}
      {SALA.piso === 'trilha' && <Trilha />}

      <mesh receiveShadow position={[0, 1.5, -5]}>
        <boxGeometry args={[16, 3, 0.2]} />
        <meshToonMaterial gradientMap={GRADIENTE} color={c.paredeFundo} />
      </mesh>
      <mesh receiveShadow position={[-8, 1.5, 0]}>
        <boxGeometry args={[0.2, 3, 10]} />
        <meshToonMaterial gradientMap={GRADIENTE} color={c.paredeLado} />
      </mesh>
      <mesh position={[3.5, 1.9, -4.88]}>
        <boxGeometry args={[3.2, 1.4, 0.05]} />
        <meshToonMaterial gradientMap={GRADIENTE} color={c.janela} emissive={c.janela} emissiveIntensity={SALA.luz < 1 ? 0.6 : 0.25} />
      </mesh>
      {SALA.luminarias.map(([x, z], i) => (
        <Luminaria key={i} x={x} z={z} />
      ))}
      <Planta posicao={[-7.2, 0, -4.2]} />
      <Planta posicao={[7.2, 0, -4.2]} />
      <Planta posicao={[-7.2, 0, 4.2]} />
    </group>
  )
}
