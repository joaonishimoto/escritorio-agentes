import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Group, Mesh, MeshStandardMaterial } from 'three'
import type { Agente } from '../agents/catalogo'
import { useEscritorio, type Estado } from '../store/escritorio'

export const COR_ESTADO: Record<Estado, string> = {
  ocioso: '#9aa1b0',
  trabalhando: '#e08a2c',
  concluido: '#2fa06a',
  esperando_voce: '#9a52d6',
  erro: '#d63c3c',
}

export function EstacaoAgente({ agente }: { agente: Agente }) {
  const estado = useEscritorio((s) => s.estados[agente.id])
  const acao = useEscritorio((s) => s.acaoAtual[agente.id])
  const selecionado = useEscritorio((s) => s.selecionado === agente.id)
  const selecionar = useEscritorio((s) => s.selecionar)
  const [hover, setHover] = useState(false)

  const corpo = useRef<Group>(null)
  const bracoE = useRef<Mesh>(null)
  const bracoD = useRef<Mesh>(null)
  const tela = useRef<MeshStandardMaterial>(null)
  const anel = useRef<Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const trabalhando = estado === 'trabalhando'
    const esperando = estado === 'esperando_voce'
    if (corpo.current) {
      corpo.current.position.y = trabalhando ? Math.abs(Math.sin(t * 6)) * 0.04 : esperando ? Math.abs(Math.sin(t * 3)) * 0.12 : 0
      corpo.current.rotation.y = trabalhando ? Math.sin(t * 1.3) * 0.08 : 0
    }
    // braços "digitando"
    if (bracoE.current) bracoE.current.rotation.x = trabalhando ? -1.1 + Math.sin(t * 18) * 0.15 : -0.2
    if (bracoD.current) bracoD.current.rotation.x = trabalhando ? -1.1 + Math.sin(t * 18 + 1.5) * 0.15 : -0.2
    if (tela.current) tela.current.emissiveIntensity = trabalhando ? 0.8 + Math.sin(t * 8) * 0.2 : 0.05
    if (anel.current) {
      const s = trabalhando || esperando ? 1 + Math.sin(t * 4) * 0.08 : 1
      anel.current.scale.set(s, s, s)
    }
  })

  const [x, z] = agente.mesa
  const mostrarBalao = (estado === 'trabalhando' || estado === 'esperando_voce') && acao

  return (
    <group
      position={[x, 0, z]}
      rotation={[0, agente.rotacao, 0]}
      onClick={(e) => {
        e.stopPropagation()
        selecionar(agente.id)
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
      {/* anel de estado no chão */}
      <mesh ref={anel} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.55]}>
        <ringGeometry args={[0.55, selecionado || hover ? 0.75 : 0.66, 32]} />
        <meshBasicMaterial color={COR_ESTADO[estado]} transparent opacity={0.85} />
      </mesh>

      {/* mesa */}
      <mesh castShadow receiveShadow position={[0, 0.75, -0.35]}>
        <boxGeometry args={[1.8, 0.08, 0.9]} />
        <meshStandardMaterial color="#c49a6c" flatShading />
      </mesh>
      {[[-0.82, -0.72], [0.82, -0.72], [-0.82, 0.02], [0.82, 0.02]].map(([px, pz], i) => (
        <mesh key={i} castShadow position={[px, 0.37, pz]}>
          <boxGeometry args={[0.06, 0.74, 0.06]} />
          <meshStandardMaterial color="#8a6a48" />
        </mesh>
      ))}
      {/* monitor */}
      <mesh castShadow position={[0, 1.12, -0.6]}>
        <boxGeometry args={[0.9, 0.55, 0.05]} />
        <meshStandardMaterial color="#2a2d36" />
      </mesh>
      <mesh position={[0, 1.12, -0.57]}>
        <planeGeometry args={[0.82, 0.47]} />
        <meshStandardMaterial ref={tela} color="#1a1d24" emissive={agente.cor} emissiveIntensity={0.05} />
      </mesh>
      <mesh position={[0, 0.84, -0.6]}>
        <boxGeometry args={[0.08, 0.14, 0.05]} />
        <meshStandardMaterial color="#2a2d36" />
      </mesh>
      {/* teclado */}
      <mesh position={[0, 0.8, -0.2]}>
        <boxGeometry args={[0.6, 0.02, 0.18]} />
        <meshStandardMaterial color="#e6e8ee" />
      </mesh>

      {/* cadeira */}
      <mesh castShadow position={[0, 0.45, 0.55]}>
        <boxGeometry args={[0.6, 0.08, 0.6]} />
        <meshStandardMaterial color="#3b3f4a" />
      </mesh>
      <mesh castShadow position={[0, 0.8, 0.85]}>
        <boxGeometry args={[0.6, 0.7, 0.08]} />
        <meshStandardMaterial color="#3b3f4a" />
      </mesh>

      {/* boneco */}
      <group ref={corpo} position={[0, 0, 0.5]}>
        <mesh castShadow position={[0, 0.85, 0]}>
          <capsuleGeometry args={[0.24, 0.4, 4, 10]} />
          <meshStandardMaterial color={agente.cor} flatShading />
        </mesh>
        <mesh castShadow position={[0, 1.42, 0]}>
          <sphereGeometry args={[0.22, 16, 12]} />
          <meshStandardMaterial color="#f0c9a4" flatShading />
        </mesh>
        <mesh ref={bracoE} castShadow position={[-0.3, 1.02, 0]}>
          <capsuleGeometry args={[0.07, 0.3, 4, 6]} />
          <meshStandardMaterial color={agente.cor} flatShading />
        </mesh>
        <mesh ref={bracoD} castShadow position={[0.3, 1.02, 0]}>
          <capsuleGeometry args={[0.07, 0.3, 4, 6]} />
          <meshStandardMaterial color={agente.cor} flatShading />
        </mesh>
      </group>

      {/* nome e balão; ficam virados para a câmera */}
      <Html position={[0, 2.1, 0.5]} center distanceFactor={12} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="etiqueta">
          {mostrarBalao && <div className={`balao balao-${estado}`}>{acao}</div>}
          <div className="nome" style={{ borderColor: COR_ESTADO[estado] }}>
            <span className="ponto" style={{ background: COR_ESTADO[estado] }} />
            {agente.nome}
          </div>
        </div>
      </Html>
    </group>
  )
}
