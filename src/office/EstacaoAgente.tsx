import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Outlines } from '@react-three/drei'
import type { Group, Mesh, MeshToonMaterial } from 'three'
import type { Agente } from '../agents/catalogo'
import { useEscritorio, type Estado } from '../store/escritorio'
import { SALA } from './salas'
import { CONTORNO, GRADIENTE } from './toon'

export const COR_ESTADO: Record<Estado, string> = {
  ocioso: '#a2a39a',
  trabalhando: '#3969a8',
  concluido: '#3f7650',
  esperando_voce: '#976822',
  erro: '#b74e45',
}

const PELE = '#f3cfa8'
const N_BITS = 4
const N_ESTRELAS = 8

/** Contorno fino que dá o visual de desenho; só nas peças grandes, para não pesar. */
const Contorno = () => <Outlines thickness={0.045} color={CONTORNO} />

export function EstacaoAgente({ agente }: { agente: Agente }) {
  const estado = useEscritorio((s) => s.estados[agente.id])
  const acao = useEscritorio((s) => s.acaoAtual[agente.id])
  const selecionado = useEscritorio((s) => s.selecionado === agente.id)
  const selecionar = useEscritorio((s) => s.selecionar)
  const [hover, setHover] = useState(false)

  const raiz = useRef<Group>(null)
  const corpo = useRef<Group>(null)
  const cabeca = useRef<Group>(null)
  const olhos = useRef<Group>(null)
  const bracoE = useRef<Mesh>(null)
  const bracoD = useRef<Mesh>(null)
  const tela = useRef<MeshToonMaterial>(null)
  const anel = useRef<Mesh>(null)
  const marcador = useRef<Group>(null)
  const bits = useRef<(Mesh | null)[]>([])
  const estrelas = useRef<(Mesh | null)[]>([])
  // quando o estado mudou: o pulo de comemoração e as estrelas contam a partir daqui
  const mudouEm = useRef(0)
  const fase = useRef(Math.random() * 10)

  useEffect(() => {
    mudouEm.current = performance.now()
  }, [estado])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + fase.current
    const desde = (performance.now() - mudouEm.current) / 1000
    const trabalhando = estado === 'trabalhando'
    const esperando = estado === 'esperando_voce'

    // tamanho com mola ao passar o mouse ou selecionar
    if (raiz.current) {
      const alvo = hover || selecionado ? 1.08 : 1
      const s = raiz.current.scale.x + (alvo - raiz.current.scale.x) * Math.min(1, dt * 12)
      raiz.current.scale.setScalar(s)
    }

    if (corpo.current) {
      let y = 0
      let giro = 0
      let x = 0
      if (estado === 'concluido' && desde < 0.9) {
        // pulinho com giro quando termina
        const p = desde / 0.9
        y = Math.sin(p * Math.PI) * 0.55
        giro = p * Math.PI * 2
      } else if (trabalhando) {
        y = Math.abs(Math.sin(t * 7)) * 0.035
      } else if (esperando) {
        y = Math.abs(Math.sin(t * 3)) * 0.1
      } else if (estado === 'erro') {
        x = desde < 0.6 ? Math.sin(desde * 60) * 0.06 : 0
      }
      corpo.current.position.set(x, y, 0.5)
      corpo.current.rotation.y = giro
      // respiração
      corpo.current.scale.y = 1 + Math.sin(t * 2.2) * 0.025
    }

    if (cabeca.current) {
      cabeca.current.rotation.x = trabalhando ? -0.18 + Math.sin(t * 7) * 0.05 : 0
      cabeca.current.rotation.y = estado === 'ocioso' ? Math.sin(t * 0.7) * 0.5 : 0
      cabeca.current.rotation.z = estado === 'erro' ? 0.25 : esperando ? Math.sin(t * 2) * 0.12 : 0
    }

    // piscar a cada ~3,5 s
    if (olhos.current) olhos.current.scale.y = t % 3.5 < 0.12 ? 0.1 : 1

    // braços digitando
    if (bracoE.current) bracoE.current.rotation.x = trabalhando ? -1.2 + Math.sin(t * 20) * 0.2 : -0.15
    if (bracoD.current) bracoD.current.rotation.x = trabalhando ? -1.2 + Math.sin(t * 20 + 1.5) * 0.2 : -0.15
    if (tela.current) tela.current.emissiveIntensity = trabalhando ? 0.9 + Math.sin(t * 8) * 0.25 : 0.08

    if (anel.current) {
      const s = trabalhando || esperando ? 1 + Math.sin(t * 4) * 0.08 : 1
      anel.current.scale.set(s, s, s)
      anel.current.rotation.z = t * 0.6
    }

    // "!" de missão sobre a cabeça quando espera você
    if (marcador.current) {
      marcador.current.visible = esperando || estado === 'erro'
      marcador.current.position.y = 2.25 + Math.sin(t * 4) * 0.08
      marcador.current.rotation.y = t * 2
    }

    // pedacinhos subindo do monitor enquanto trabalha
    bits.current.forEach((b, i) => {
      if (!b) return
      const p = (t * 0.9 + i / N_BITS) % 1
      b.visible = trabalhando
      b.position.set(Math.sin(i * 2.1 + t) * 0.3, 1.45 + p * 0.9, -0.6)
      b.scale.setScalar(0.09 * (1 - p))
      b.rotation.set(t * 3 + i, t * 2, 0)
    })

    // estrelas explodindo quando termina
    estrelas.current.forEach((e, i) => {
      if (!e) return
      const ativo = estado === 'concluido' && desde < 1.1
      e.visible = ativo
      if (!ativo) return
      const a = (i / N_ESTRELAS) * Math.PI * 2
      const r = desde * 1.6
      e.position.set(Math.cos(a) * r, 1.4 + Math.sin(desde * 3) * 0.6, 0.5 + Math.sin(a) * r)
      e.scale.setScalar(0.11 * (1 - desde / 1.1))
      e.rotation.y = desde * 8
    })
  })

  const [x, z] = agente.mesa
  const mostrarBalao = (estado === 'trabalhando' || estado === 'esperando_voce') && acao
  const toon = (cor: string) => <meshToonMaterial color={cor} gradientMap={GRADIENTE} />

  return (
    <group
      ref={raiz}
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
      {/* anel de estado no chão, tracejado e girando */}
      <mesh ref={anel} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.55]}>
        <ringGeometry args={[0.55, selecionado || hover ? 0.78 : 0.68, 12]} />
        <meshBasicMaterial color={COR_ESTADO[estado]} transparent opacity={0.9} />
      </mesh>

      {/* mesa */}
      <mesh castShadow receiveShadow position={[0, 0.75, -0.35]}>
        <boxGeometry args={[1.8, 0.12, 0.9]} />
        {toon(SALA.cores.mesa)}
        <Contorno />
      </mesh>
      {[[-0.8, -0.7], [0.8, -0.7], [-0.8, 0], [0.8, 0]].map(([px, pz], i) => (
        <mesh key={i} castShadow position={[px, 0.37, pz]}>
          <cylinderGeometry args={[0.05, 0.05, 0.74, 6]} />
          {toon(SALA.cores.perna)}
        </mesh>
      ))}
      {/* monitor */}
      <mesh castShadow position={[0, 1.14, -0.6]}>
        <boxGeometry args={[0.9, 0.56, 0.07]} />
        {toon('#2a2d36')}
        <Contorno />
      </mesh>
      <mesh position={[0, 1.14, -0.56]}>
        <planeGeometry args={[0.8, 0.46]} />
        <meshToonMaterial ref={tela} color="#1a1d24" emissive={agente.cor} emissiveIntensity={0.08} gradientMap={GRADIENTE} />
      </mesh>
      <mesh position={[0, 0.86, -0.6]}>
        <boxGeometry args={[0.1, 0.14, 0.06]} />
        {toon('#2a2d36')}
      </mesh>
      <mesh position={[0, 0.82, -0.2]}>
        <boxGeometry args={[0.6, 0.03, 0.18]} />
        {toon('#e6e8ee')}
      </mesh>
      {/* caneca, para dar vida à mesa */}
      <mesh position={[0.65, 0.88, -0.35]}>
        <cylinderGeometry args={[0.07, 0.06, 0.14, 8]} />
        {toon(agente.cor)}
      </mesh>

      {/* cadeira */}
      <mesh castShadow position={[0, 0.45, 0.6]}>
        <boxGeometry args={[0.62, 0.1, 0.6]} />
        {toon(SALA.cores.cadeira)}
      </mesh>
      <mesh castShadow position={[0, 0.82, 0.88]}>
        <boxGeometry args={[0.62, 0.66, 0.1]} />
        {toon(SALA.cores.cadeira)}
      </mesh>

      {/* boneco: cabeça grande, corpo pequeno */}
      <group ref={corpo} position={[0, 0, 0.5]}>
        <mesh castShadow position={[0, 0.82, 0]}>
          <capsuleGeometry args={[0.22, 0.26, 4, 10]} />
          {toon(agente.cor)}
          <Contorno />
        </mesh>
        <group ref={cabeca} position={[0, 1.38, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.32, 18, 14]} />
            {toon(PELE)}
            <Contorno />
          </mesh>
          {/* cabelo / boné na cor do agente */}
          <mesh position={[0, 0.12, 0.04]} rotation={[0.35, 0, 0]}>
            <sphereGeometry args={[0.33, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
            {toon(agente.cor)}
          </mesh>
          <group ref={olhos} position={[0, 0.02, -0.29]}>
            <mesh position={[-0.11, 0, 0]}>
              <sphereGeometry args={[0.045, 8, 8]} />
              <meshBasicMaterial color={CONTORNO} />
            </mesh>
            <mesh position={[0.11, 0, 0]}>
              <sphereGeometry args={[0.045, 8, 8]} />
              <meshBasicMaterial color={CONTORNO} />
            </mesh>
          </group>
        </group>
        <mesh ref={bracoE} castShadow position={[-0.3, 0.98, 0]}>
          <capsuleGeometry args={[0.07, 0.26, 4, 6]} />
          {toon(agente.cor)}
        </mesh>
        <mesh ref={bracoD} castShadow position={[0.3, 0.98, 0]}>
          <capsuleGeometry args={[0.07, 0.26, 4, 6]} />
          {toon(agente.cor)}
        </mesh>
      </group>

      {/* "!" de missão */}
      <group ref={marcador} position={[0, 2.25, 0.5]} visible={false}>
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[0.11, 0.3, 0.11]} />
          <meshBasicMaterial color={estado === 'erro' ? '#e05a4f' : '#f2b233'} />
        </mesh>
        <mesh position={[0, -0.12, 0]}>
          <boxGeometry args={[0.11, 0.11, 0.11]} />
          <meshBasicMaterial color={estado === 'erro' ? '#e05a4f' : '#f2b233'} />
        </mesh>
      </group>

      {Array.from({ length: N_BITS }, (_, i) => (
        <mesh key={`b${i}`} ref={(m) => { bits.current[i] = m }} visible={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={agente.cor} />
        </mesh>
      ))}
      {Array.from({ length: N_ESTRELAS }, (_, i) => (
        <mesh key={`e${i}`} ref={(m) => { estrelas.current[i] = m }} visible={false}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={i % 2 ? '#f2b233' : '#ffffff'} />
        </mesh>
      ))}

      {/* nome e balão; ficam virados para a câmera */}
      <Html position={[0, 2.3, 0.5]} center distanceFactor={12} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="etiqueta">
          {mostrarBalao && <div key={acao} className={`balao balao-${estado}`}>{acao}</div>}
          <div className={`nome nome-${estado}`} style={{ ['--cor' as string]: agente.cor }}>
            <span className="ponto" style={{ background: COR_ESTADO[estado] }} />
            {agente.nome}
          </div>
        </div>
      </Html>
    </group>
  )
}
