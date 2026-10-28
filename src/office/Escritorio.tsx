import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import type { OrbitControls as Controles } from 'three-stdlib'
import { AGENTES, type AgenteId } from '../agents/catalogo'
import { useEscritorio } from '../store/escritorio'
import { EstacaoAgente } from './EstacaoAgente'
import { MesaVoce } from './MesaVoce'
import { Pastas } from './Pastas'
import { Ambiente } from './Ambiente'
import { CalendarioParede } from './CalendarioParede'
import { GRADIENTE } from './toon'
import {
  CORREDOR,
  LARGURA_VOCE,
  SALAS,
  SALA_VOCE,
  centroDaSala,
  centroSuaSala,
  estiloDaMarca,
  salvarEstilo,
} from './salas'

export interface MarcaNoAndar {
  id: string
  nome: string
}

const ORDEM_ESTILOS = ['d', 'e', 'f', 'a', 'b', 'c']
const OFFSET_CAMERA = new Vector3(13, 12, 13)

/**
 * O andar do escritório: uma sala por marca lado a lado, o corredor na frente e a sua sala no fim.
 * Só a sala da marca escolhida mostra o trabalho ao vivo; clicar em outra sala troca de marca.
 */
export function Escritorio({
  marcas,
  marcaAtiva,
  aoEscolherMarca,
}: {
  marcas: MarcaNoAndar[]
  marcaAtiva: string | null
  aoEscolherMarca: (id: string) => void
}) {
  const selecionar = useEscritorio((s) => s.selecionar)
  const definirPosicoes = useEscritorio((s) => s.definirPosicoes)
  const foco = useEscritorio((s) => s.foco)
  const [estilos, setEstilos] = useState<Record<string, string>>({})
  const [olhando, setOlhando] = useState<'marca' | 'voce'>('marca')

  const salas = useMemo(
    () => marcas.map((m, i) => ({ marca: m, x: centroDaSala(i), sala: SALAS[estilos[m.id] ?? estiloDaMarca(m.id, i)] })),
    [marcas, estilos],
  )
  const xVoce = centroSuaSala(Math.max(salas.length, 1))
  const voce: [number, number] = [xVoce + SALA_VOCE.voce[0], SALA_VOCE.voce[1]]
  const ativa = salas.find((s) => s.marca.id === marcaAtiva) ?? salas[0]

  // posições do andar para as pastas voarem entre as mesas e até você
  useEffect(() => {
    if (!ativa) return
    const p: Partial<Record<AgenteId | 'voce', [number, number]>> = { voce }
    for (const a of AGENTES) {
      const [x, z] = ativa.sala.mesas[a.id]
      p[a.id] = [ativa.x + x, z]
    }
    definirPosicoes(p)
  }, [ativa, voce[0], definirPosicoes]) // eslint-disable-line react-hooks/exhaustive-deps

  // clicar na sua mesa ou abrir o calendário leva a câmera até a sua sala
  useEffect(() => {
    if (foco) setOlhando('voce')
  }, [foco])
  useEffect(() => {
    setOlhando('marca')
  }, [marcaAtiva])

  const alvo: [number, number] = olhando === 'voce' || !ativa ? [xVoce, 0] : [ativa.x, 0]
  const fimDoAndar = xVoce + LARGURA_VOCE / 2
  const inicioDoAndar = -8

  const trocarEstilo = (marcaId: string, atual: string) => {
    const proximo = ORDEM_ESTILOS[(ORDEM_ESTILOS.indexOf(atual) + 1) % ORDEM_ESTILOS.length]
    salvarEstilo(marcaId, proximo)
    setEstilos((e) => ({ ...e, [marcaId]: proximo }))
  }

  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: [13, 12, 13], fov: 32 }} onPointerMissed={() => selecionar(null)}>
      <color attach="background" args={['#faf9f5']} />
      <hemisphereLight args={['#ffffff', '#e6dfcf', 1.1]} />
      <Sol alvo={alvo} />

      <CameraQueSegue alvo={alvo} />

      {salas.map(({ marca, x, sala }) => {
        const viva = marca.id === ativa?.marca.id
        const estiloAtual = Object.keys(SALAS).find((k) => SALAS[k] === sala) ?? 'd'
        return (
          <group key={marca.id} position={[x, 0, 0]}>
            <Ambiente sala={sala} letreiro={marca.nome} aoClicar={viva ? undefined : () => aoEscolherMarca(marca.id)} />
            {AGENTES.map((a) => (
              <EstacaoAgente
                key={a.id}
                agente={a}
                mesa={sala.mesas[a.id]}
                cores={sala.cores}
                vivo={viva}
                aoClicarParado={() => aoEscolherMarca(marca.id)}
              />
            ))}
            {/* placa da porta, no corredor */}
            <Html position={[0, 0.2, CORREDOR.z0 + 0.4]} center distanceFactor={14} zIndexRange={[20, 0]}>
              <div className={`placa-sala${viva ? ' ativa' : ''}`}>
                <button className="placa-nome" onClick={() => aoEscolherMarca(marca.id)}>
                  {viva && <span className="ao-vivo" />}
                  {marca.nome}
                </button>
                <button className="placa-estilo" title={`Estilo: ${sala.nome}. Clique para trocar`} onClick={() => trocarEstilo(marca.id, estiloAtual)}>
                  🎨
                </button>
              </div>
            </Html>
          </group>
        )
      })}

      {/* sua sala, no fim do corredor */}
      <group position={[xVoce, 0, 0]}>
        <Ambiente sala={SALA_VOCE} largura={LARGURA_VOCE} letreiro="Sua sala" aoClicar={() => setOlhando('voce')} />
        <CalendarioParede x={SALA_VOCE.calendario[0]} z={SALA_VOCE.calendario[1]} rot={SALA_VOCE.calendario[2]} />
        <Html position={[0, 0.2, CORREDOR.z0 + 0.4]} center distanceFactor={14} zIndexRange={[20, 0]}>
          <div className={`placa-sala voce${olhando === 'voce' ? ' ativa' : ''}`}>
            <button className="placa-nome" onClick={() => setOlhando('voce')}>Sua sala</button>
          </div>
        </Html>
      </group>
      <MesaVoce posicao={voce} />

      <Corredor de={inicioDoAndar} ate={fimDoAndar} />
      <Pastas />

      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={9}
        maxDistance={34}
        minPolarAngle={0.5}
        maxPolarAngle={1.15}
      />
    </Canvas>
  )
}

/** Piso do corredor com passadeira e plantas, de ponta a ponta do andar. */
function Corredor({ de, ate }: { de: number; ate: number }) {
  const largura = ate - de
  const meio = (de + ate) / 2
  const fundo = CORREDOR.z1 - CORREDOR.z0
  const plantas = Array.from({ length: Math.floor(largura / 8) + 1 }, (_, i) => de + 1 + i * 8)
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[meio, 0, CORREDOR.z0 + fundo / 2]}>
        <planeGeometry args={[largura, fundo]} />
        <meshToonMaterial gradientMap={GRADIENTE} color="#e4ded2" />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[meio, 0.005, CORREDOR.z0 + fundo / 2]}>
        <planeGeometry args={[largura - 1, 1.1]} />
        <meshToonMaterial gradientMap={GRADIENTE} color="#2a5288" />
      </mesh>
      {/* faixa entre as salas e o corredor */}
      <mesh position={[meio, 0.03, CORREDOR.z0]}>
        <boxGeometry args={[largura, 0.06, 0.12]} />
        <meshToonMaterial gradientMap={GRADIENTE} color="#1f2330" />
      </mesh>
      {plantas.map((x) => (
        <group key={x} position={[x, 0, CORREDOR.z1 - 0.5]}>
          <mesh castShadow position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.26, 0.2, 0.5, 8]} />
            <meshToonMaterial gradientMap={GRADIENTE} color="#ffffff" />
          </mesh>
          <mesh castShadow position={[0, 0.8, 0]}>
            <icosahedronGeometry args={[0.42, 0]} />
            <meshToonMaterial gradientMap={GRADIENTE} color="#3f7650" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Luz do sol que acompanha a sala que você está olhando, para a sombra caber num mapa pequeno. */
function Sol({ alvo }: { alvo: [number, number] }) {
  return (
    <directionalLight
      position={[alvo[0] + 6, 12, 4]}
      intensity={1.5}
      castShadow
      shadow-mapSize={[1024, 1024]}
      shadow-camera-left={-12}
      shadow-camera-right={12}
      shadow-camera-top={12}
      shadow-camera-bottom={-12}
    >
      <object3D attach="target" position={[alvo[0], 0, 0]} />
    </directionalLight>
  )
}

/** Desliza a câmera até a sala escolhida, mantendo o ângulo que você girou. Na abertura, desce girando. */
function CameraQueSegue({ alvo }: { alvo: [number, number] }) {
  const controles = useThree((s) => s.controls) as unknown as Controles | null
  const inicio = useRef<number | null>(null)
  const destino = useRef(new Vector3())

  useFrame(({ camera, clock }, dt) => {
    if (!controles) return
    destino.current.set(alvo[0], 0, alvo[1])
    if (inicio.current === null) {
      inicio.current = clock.elapsedTime
      controles.target.copy(destino.current)
    }
    const p = Math.min((clock.elapsedTime - inicio.current) / 1.6, 1)
    if (p < 1) {
      const e = 1 - Math.pow(1 - p, 3)
      const ang = Math.PI / 4 + (1 - e) * 0.9
      const r = 18.4 + (1 - e) * 10
      camera.position.set(alvo[0] + Math.sin(ang) * r, 12 + (1 - e) * 6, alvo[1] + Math.cos(ang) * r)
      controles.target.copy(destino.current)
      controles.update()
      return
    }
    const passo = destino.current.clone().sub(controles.target).multiplyScalar(Math.min(1, dt * 3.5))
    if (passo.lengthSq() < 1e-6) return
    controles.target.add(passo)
    camera.position.add(passo)
    controles.update()
  })
  void OFFSET_CAMERA
  return null
}
