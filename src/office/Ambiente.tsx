// Chão, paredes e alguns objetos de escritório em low-poly feitos com primitivas.

function Planta({ posicao }: { posicao: [number, number, number] }) {
  return (
    <group position={posicao}>
      <mesh castShadow position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.28, 0.22, 0.5, 8]} />
        <meshStandardMaterial color="#c9b49a" flatShading />
      </mesh>
      <mesh castShadow position={[0, 0.85, 0]}>
        <icosahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial color="#4f9a62" flatShading />
      </mesh>
    </group>
  )
}

export function Ambiente() {
  return (
    <group>
      {/* chão */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[16, 10]} />
        <meshStandardMaterial color="#f4f1ec" />
      </mesh>
      {/* tapete central */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[6.2, 2.4]} />
        <meshStandardMaterial color="#dfe3f5" />
      </mesh>
      {/* paredes do fundo */}
      <mesh receiveShadow position={[0, 1.5, -5]}>
        <boxGeometry args={[16, 3, 0.2]} />
        <meshStandardMaterial color="#d9dde6" />
      </mesh>
      <mesh receiveShadow position={[-8, 1.5, 0]}>
        <boxGeometry args={[0.2, 3, 10]} />
        <meshStandardMaterial color="#cfd4de" />
      </mesh>
      {/* quadro de pauta na parede */}
      <mesh position={[-3, 1.8, -4.88]}>
        <boxGeometry args={[3, 1.3, 0.05]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* janela */}
      <mesh position={[3.5, 1.9, -4.88]}>
        <boxGeometry args={[3.2, 1.4, 0.05]} />
        <meshStandardMaterial color="#bcd6f2" emissive="#bcd6f2" emissiveIntensity={0.25} />
      </mesh>
      <Planta posicao={[-7.2, 0, -4.2]} />
      <Planta posicao={[7.2, 0, -4.2]} />
      <Planta posicao={[-7.2, 0, 4.2]} />
    </group>
  )
}
