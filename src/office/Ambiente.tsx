// Chão, paredes e alguns objetos de escritório em low-poly feitos com primitivas. Cores, piso e móveis vêm da sala.
import { useMemo } from 'react'
import type { AgenteId } from '../agents/catalogo'
import type { Sala } from './salas'
import { GRADIENTE } from './toon'
import { Moveis, texturaPiso, type Movel } from './Moveis'

type Cores = Sala['cores']
const Toon = ({ cor }: { cor: string }) => <meshToonMaterial gradientMap={GRADIENTE} color={cor} />

function Planta({ posicao, c }: { posicao: [number, number, number]; c: Cores }) {
  return (
    <group position={posicao}>
      <mesh castShadow position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.28, 0.22, 0.5, 8]} />
        <Toon cor={c.vaso} />
      </mesh>
      <mesh castShadow position={[0, 0.85, 0]}>
        <icosahedronGeometry args={[0.45, 0]} />
        <Toon cor={c.planta} />
      </mesh>
    </group>
  )
}

/** Faixa no chão que liga as mesas na ordem em que o post passa por elas, até a porta. */
function Trilha({ sala }: { sala: Sala }) {
  const ordem: AgenteId[] = ['chefe', 'pesquisador', 'redator', 'designer', 'revisor']
  const pontos = [...ordem.map((id) => [sala.mesas[id][0], sala.mesas[id][1] + 1.1] as [number, number]), sala.voce]
  return (
    <>
      {pontos.slice(1).map(([x1, z1], i) => {
        const [x0, z0] = pontos[i]
        const dx = x1 - x0
        const dz = z1 - z0
        return (
          <mesh key={i} receiveShadow rotation={[-Math.PI / 2, 0, -Math.atan2(dz, dx)]} position={[(x0 + x1) / 2, 0.006, (z0 + z1) / 2]}>
            <planeGeometry args={[Math.hypot(dx, dz) + 0.5, 0.5]} />
            <Toon cor={sala.cores.tapete} />
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

/** Janela com caixilho e divisórias. */
function Janela({ x, z, rot, largura, sala }: { x: number; z: number; rot: number; largura: number; sala: Sala }) {
  const c = sala.cores
  return (
    <group position={[x, 1.85, z]} rotation={[0, rot, 0]}>
      <mesh>
        <boxGeometry args={[largura, 1.5, 0.04]} />
        <meshToonMaterial gradientMap={GRADIENTE} color={c.janela} emissive={c.janela} emissiveIntensity={sala.luz < 1 ? 0.7 : 0.3} />
      </mesh>
      {[-largura / 2, 0, largura / 2].map((dx) => (
        <mesh key={dx} position={[dx, 0, 0.03]}>
          <boxGeometry args={[0.07, 1.56, 0.06]} />
          <Toon cor="#1f2330" />
        </mesh>
      ))}
      {[-0.75, 0, 0.75].map((dy) => (
        <mesh key={dy} position={[0, dy, 0.03]}>
          <boxGeometry args={[largura, 0.06, 0.06]} />
          <Toon cor="#1f2330" />
        </mesh>
      ))}
      <mesh position={[0, -0.8, 0.1]}>
        <boxGeometry args={[largura + 0.2, 0.06, 0.2]} />
        <Toon cor={sala.rodape ?? '#1f2330'} />
      </mesh>
    </group>
  )
}

/**
 * Uma sala: piso, parede do fundo e da esquerda (as outras ficam abertas para a câmera), janelas, móveis.
 * `letreiro` troca o texto da placa da parede (o nome da marca); `aoClicar` vem do chão.
 */
export function Ambiente({
  sala,
  largura = 16,
  letreiro,
  aoClicar,
}: {
  sala: Sala
  largura?: number
  letreiro?: string
  aoClicar?: () => void
}) {
  const c = sala.cores
  const meia = largura / 2
  const textura = useMemo(() => (sala.textura ? texturaPiso(sala.textura.tipo, c.chao, sala.textura.linha) : null), [sala, c.chao])
  const moveis = useMemo<Movel[]>(() => {
    const lista = sala.moveis ?? []
    if (!letreiro) return lista
    const temPlaca = lista.some((m) => m.tipo === 'letreiro')
    return temPlaca
      ? lista.map((m) => (m.tipo === 'letreiro' ? { ...m, texto: letreiro } : m))
      : [...lista, { tipo: 'letreiro', x: -meia / 3, z: -4.88, texto: letreiro, cor: sala.rodape ?? '#1e3d66' }]
  }, [sala, letreiro, meia])

  return (
    <group>
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={aoClicar && ((e) => { e.stopPropagation(); aoClicar() })}
      >
        <planeGeometry args={[largura, 10]} />
        <meshToonMaterial gradientMap={GRADIENTE} color={textura ? '#ffffff' : c.chao} map={textura} />
      </mesh>
      {sala.rodape && (
        <>
          <mesh position={[0, 0.08, -4.88]}>
            <boxGeometry args={[largura, 0.16, 0.05]} />
            <Toon cor={sala.rodape} />
          </mesh>
          <mesh position={[-meia + 0.12, 0.08, 0]}>
            <boxGeometry args={[0.05, 0.16, 10]} />
            <Toon cor={sala.rodape} />
          </mesh>
        </>
      )}
      <Moveis itens={moveis} />
      {sala.piso === 'tapete' && (
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <planeGeometry args={[6.2, 2.4]} />
          <Toon cor={c.tapete} />
        </mesh>
      )}
      {sala.piso === 'redondo' && (
        <>
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} scale={[1, 0.82, 1]}>
            <circleGeometry args={[3.1, 48]} />
            <Toon cor={c.tapete} />
          </mesh>
          <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} scale={[1, 0.82, 1]}>
            <ringGeometry args={[5.6, 5.75, 64]} />
            <Toon cor={c.perna} />
          </mesh>
        </>
      )}
      {sala.piso === 'trilha' && <Trilha sala={sala} />}

      <mesh receiveShadow position={[0, 1.5, -5]}>
        <boxGeometry args={[largura, 3, 0.2]} />
        <Toon cor={c.paredeFundo} />
      </mesh>
      <mesh receiveShadow position={[-meia, 1.5, 0]}>
        <boxGeometry args={[0.2, 3, 10]} />
        <Toon cor={c.paredeLado} />
      </mesh>
      {sala.janelas ? (
        sala.janelas.map((j, i) => <Janela key={i} {...j} sala={sala} />)
      ) : (
        <mesh position={[meia * 0.44, 1.9, -4.88]}>
          <boxGeometry args={[3.2, 1.4, 0.05]} />
          <meshToonMaterial gradientMap={GRADIENTE} color={c.janela} emissive={c.janela} emissiveIntensity={sala.luz < 1 ? 0.6 : 0.25} />
        </mesh>
      )}
      {sala.luminarias.map(([x, z], i) => (
        <Luminaria key={i} x={x} z={z} />
      ))}
      {!sala.semPlantas && (
        <>
          <Planta c={c} posicao={[-meia + 0.8, 0, -4.2]} />
          <Planta c={c} posicao={[meia - 0.8, 0, -4.2]} />
          <Planta c={c} posicao={[-meia + 0.8, 0, 4.2]} />
        </>
      )}
    </group>
  )
}
