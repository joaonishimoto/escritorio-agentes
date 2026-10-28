// Móveis e decoração das salas "profissionais". Tudo com primitivas e material de tons, para continuar leve.
import { useMemo } from 'react'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { Outlines } from '@react-three/drei'
import { CONTORNO, GRADIENTE } from './toon'

export type Movel =
  | { tipo: 'estante'; x: number; z: number; rot?: number; largura?: number }
  | { tipo: 'sofa'; x: number; z: number; rot?: number; cor: string }
  | { tipo: 'cafe'; x: number; z: number; rot?: number }
  | { tipo: 'quadro'; x: number; z: number; rot?: number }
  | { tipo: 'arte'; x: number; z: number; rot?: number; cores: string[] }
  | { tipo: 'vidro'; x: number; z: number; rot?: number; largura: number }
  | { tipo: 'reuniao'; x: number; z: number; rot?: number; cor: string }
  | { tipo: 'plantaAlta'; x: number; z: number }
  | { tipo: 'puff'; x: number; z: number; cor: string }
  | { tipo: 'tapete'; x: number; z: number; largura: number; fundo: number; cor: string; rot?: number }
  | { tipo: 'letreiro'; x: number; z: number; rot?: number; texto: string; cor: string }

const Toon = ({ cor, emissivo, forca }: { cor: string; emissivo?: string; forca?: number }) => (
  <meshToonMaterial color={cor} gradientMap={GRADIENTE} emissive={emissivo ?? '#000000'} emissiveIntensity={forca ?? 0} />
)
const Linha = () => <Outlines thickness={0.03} color={CONTORNO} />

const LIVROS = ['#2a5288', '#b74e45', '#976822', '#3f7650', '#f2b233', '#52738a', '#e6e8ee']

function Estante({ largura = 2.2 }: { largura?: number }) {
  const livros = useMemo(
    () =>
      [0, 1, 2].flatMap((prateleira) => {
        const itens: { x: number; y: number; h: number; w: number; cor: string }[] = []
        let x = -largura / 2 + 0.15
        let i = prateleira * 3
        while (x < largura / 2 - 0.3) {
          const w = 0.08 + ((i * 37) % 5) * 0.02
          const h = 0.32 + ((i * 13) % 4) * 0.04
          itens.push({ x: x + w / 2, y: 0.45 + prateleira * 0.62 + h / 2, h, w, cor: LIVROS[i % LIVROS.length] })
          x += w + 0.015 + (i % 6 === 5 ? 0.25 : 0)
          i++
        }
        return itens
      }),
    [largura],
  )
  return (
    <group>
      <mesh castShadow position={[0, 1.1, 0]}>
        <boxGeometry args={[largura, 2.2, 0.42]} />
        <Toon cor="#6b4f36" />
        <Linha />
      </mesh>
      {[0, 1, 2].map((p) => (
        <mesh key={p} position={[0, 0.66 + p * 0.62 - 0.22, 0.03]}>
          <boxGeometry args={[largura - 0.12, 0.6, 0.4]} />
          <Toon cor="#3d2c1e" />
        </mesh>
      ))}
      {livros.map((l, i) => (
        <mesh key={i} position={[l.x, l.y, 0.08]}>
          <boxGeometry args={[l.w, l.h, 0.3]} />
          <Toon cor={l.cor} />
        </mesh>
      ))}
    </group>
  )
}

function Sofa({ cor }: { cor: string }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.3, 0]}>
        <boxGeometry args={[2.4, 0.42, 0.95]} />
        <Toon cor={cor} />
        <Linha />
      </mesh>
      <mesh castShadow position={[0, 0.72, -0.38]}>
        <boxGeometry args={[2.4, 0.6, 0.22]} />
        <Toon cor={cor} />
        <Linha />
      </mesh>
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} castShadow position={[x, 0.52, 0]}>
          <boxGeometry args={[0.22, 0.6, 0.95]} />
          <Toon cor={cor} />
        </mesh>
      ))}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.58, 0.02]}>
          <boxGeometry args={[0.95, 0.14, 0.8]} />
          <Toon cor="#ffffff" />
        </mesh>
      ))}
      {/* mesinha de centro */}
      <mesh castShadow position={[0, 0.25, 1.05]}>
        <cylinderGeometry args={[0.45, 0.45, 0.06, 20]} />
        <Toon cor="#3d2c1e" />
        <Linha />
      </mesh>
      <mesh position={[0, 0.12, 1.05]}>
        <cylinderGeometry args={[0.05, 0.05, 0.24, 8]} />
        <Toon cor="#3d2c1e" />
      </mesh>
      <mesh position={[0.15, 0.33, 1.05]}>
        <boxGeometry args={[0.3, 0.06, 0.22]} />
        <Toon cor="#b74e45" />
      </mesh>
    </group>
  )
}

function Cafe() {
  return (
    <group>
      <mesh castShadow position={[0, 0.48, 0]}>
        <boxGeometry args={[2, 0.96, 0.62]} />
        <Toon cor="#f4efe4" />
        <Linha />
      </mesh>
      <mesh position={[0, 0.98, 0]}>
        <boxGeometry args={[2.06, 0.06, 0.66]} />
        <Toon cor="#3d2c1e" />
      </mesh>
      {/* máquina de café */}
      <mesh castShadow position={[-0.5, 1.26, -0.05]}>
        <boxGeometry args={[0.42, 0.5, 0.36]} />
        <Toon cor="#2a2d36" />
        <Linha />
      </mesh>
      <mesh position={[-0.5, 1.2, 0.14]}>
        <boxGeometry args={[0.22, 0.08, 0.04]} />
        <Toon cor="#f2b233" emissivo="#f2b233" forca={0.6} />
      </mesh>
      {[0.1, 0.3, 0.5].map((x, i) => (
        <mesh key={x} position={[x, 1.07, 0.1]}>
          <cylinderGeometry args={[0.06, 0.05, 0.12, 8]} />
          <Toon cor={LIVROS[i]} />
        </mesh>
      ))}
      {/* armário de cima */}
      <mesh position={[0, 2.2, -0.12]}>
        <boxGeometry args={[2, 0.6, 0.38]} />
        <Toon cor="#f4efe4" />
        <Linha />
      </mesh>
    </group>
  )
}

function Quadro() {
  const notas = ['#f2b233', '#9fd3a8', '#f3a6a0', '#a9c4ef', '#f2b233', '#a9c4ef']
  return (
    <group position={[0, 1.75, 0]}>
      <mesh>
        <boxGeometry args={[2.4, 1.3, 0.05]} />
        <Toon cor="#ffffff" />
        <Linha />
      </mesh>
      {notas.map((cor, i) => (
        <mesh key={i} position={[-0.85 + (i % 3) * 0.55, 0.28 - Math.floor(i / 3) * 0.5, 0.04]} rotation={[0, 0, ((i * 7) % 5 - 2) * 0.04]}>
          <boxGeometry args={[0.38, 0.38, 0.01]} />
          <meshBasicMaterial color={cor} />
        </mesh>
      ))}
      <mesh position={[0.95, -0.1, 0.04]}>
        <boxGeometry args={[0.04, 0.8, 0.01]} />
        <meshBasicMaterial color="#2a5288" />
      </mesh>
    </group>
  )
}

function Arte({ cores }: { cores: string[] }) {
  return (
    <group position={[0, 1.8, 0]}>
      <mesh>
        <boxGeometry args={[1.1, 1.4, 0.05]} />
        <Toon cor="#1f2330" />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[0.95, 1.25]} />
        <meshBasicMaterial color={cores[0]} />
      </mesh>
      <mesh position={[0.1, 0.15, 0.035]}>
        <circleGeometry args={[0.3, 24]} />
        <meshBasicMaterial color={cores[1]} />
      </mesh>
      <mesh position={[-0.15, -0.35, 0.036]}>
        <planeGeometry args={[0.55, 0.3]} />
        <meshBasicMaterial color={cores[2]} />
      </mesh>
    </group>
  )
}

function Vidro({ largura }: { largura: number }) {
  return (
    <group>
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[largura, 2.4, 0.04]} />
        <meshBasicMaterial color="#bcd4ee" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      {[-largura / 2, largura / 2].map((x) => (
        <mesh key={x} position={[x, 1.2, 0]}>
          <boxGeometry args={[0.07, 2.4, 0.07]} />
          <Toon cor="#1f2330" />
        </mesh>
      ))}
      {[0.02, 2.4].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[largura, 0.07, 0.07]} />
          <Toon cor="#1f2330" />
        </mesh>
      ))}
      <mesh position={[0, 1.05, 0.03]}>
        <boxGeometry args={[largura, 0.1, 0.01]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

function Reuniao({ cor }: { cor: string }) {
  const cadeiras: [number, number, number][] = [[-0.7, -0.85, 0], [0.7, -0.85, 0], [-0.7, 0.85, Math.PI], [0.7, 0.85, Math.PI], [-1.55, 0, Math.PI / 2], [1.55, 0, -Math.PI / 2]]
  return (
    <group>
      <mesh castShadow position={[0, 0.74, 0]}>
        <boxGeometry args={[2.4, 0.08, 1.2]} />
        <Toon cor={cor} />
        <Linha />
      </mesh>
      <mesh position={[0, 0.37, 0]}>
        <boxGeometry args={[1.6, 0.7, 0.12]} />
        <Toon cor="#1f2330" />
      </mesh>
      {cadeiras.map(([x, z, r], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, r, 0]}>
          <mesh castShadow position={[0, 0.45, 0]}>
            <boxGeometry args={[0.48, 0.08, 0.48]} />
            <Toon cor="#1f2330" />
          </mesh>
          <mesh castShadow position={[0, 0.72, -0.22]}>
            <boxGeometry args={[0.48, 0.5, 0.07]} />
            <Toon cor="#1f2330" />
          </mesh>
        </group>
      ))}
      <mesh position={[0.3, 0.8, 0.1]}>
        <boxGeometry args={[0.45, 0.02, 0.32]} />
        <Toon cor="#d9dde6" />
      </mesh>
    </group>
  )
}

function PlantaAlta() {
  return (
    <group>
      <mesh castShadow position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.3, 0.24, 0.6, 10]} />
        <Toon cor="#e9e4dc" />
        <Linha />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.8, 5]} />
        <Toon cor="#6b4f36" />
      </mesh>
      {[[0, 1.45, 0, 0.45], [0.22, 1.15, 0.1, 0.32], [-0.2, 1.2, -0.08, 0.3], [0.05, 1.8, 0.05, 0.3]].map(([x, y, z, r], i) => (
        <mesh key={i} castShadow position={[x, y, z]}>
          <icosahedronGeometry args={[r, 0]} />
          <Toon cor={i % 2 ? '#4d8a57' : '#3f7650'} />
        </mesh>
      ))}
    </group>
  )
}

function Puff({ cor }: { cor: string }) {
  return (
    <mesh castShadow position={[0, 0.28, 0]} scale={[1, 0.62, 1]}>
      <sphereGeometry args={[0.46, 16, 12]} />
      <Toon cor={cor} />
      <Linha />
    </mesh>
  )
}

function Letreiro({ texto, cor }: { texto: string; cor: string }) {
  const textura = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 192
    const g = c.getContext('2d')!
    g.fillStyle = cor
    g.font = '700 130px Fredoka, Inter, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(texto, 512, 104)
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    return t
  }, [texto, cor])
  return (
    <mesh position={[0, 2.68, 0.02]}>
      <planeGeometry args={[2.6, 0.48]} />
      <meshBasicMaterial map={textura} transparent />
    </mesh>
  )
}

export function Moveis({ itens }: { itens: Movel[] }) {
  return (
    <>
      {itens.map((m, i) => {
        const rot = 'rot' in m ? m.rot ?? 0 : 0
        const pos: [number, number, number] = [m.x, 0, m.z]
        const filho = (() => {
          switch (m.tipo) {
            case 'estante': return <Estante largura={m.largura} />
            case 'sofa': return <Sofa cor={m.cor} />
            case 'cafe': return <Cafe />
            case 'quadro': return <Quadro />
            case 'arte': return <Arte cores={m.cores} />
            case 'vidro': return <Vidro largura={m.largura} />
            case 'reuniao': return <Reuniao cor={m.cor} />
            case 'plantaAlta': return <PlantaAlta />
            case 'puff': return <Puff cor={m.cor} />
            case 'letreiro': return <Letreiro texto={m.texto} cor={m.cor} />
            case 'tapete':
              return (
                <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
                  <planeGeometry args={[m.largura, m.fundo]} />
                  <Toon cor={m.cor} />
                </mesh>
              )
          }
        })()
        return (
          <group key={i} position={pos} rotation={[0, rot, 0]}>
            {filho}
          </group>
        )
      })}
    </>
  )
}

/** Textura de piso desenhada no navegador: tábuas de madeira, ladrilhos ou concreto. */
export function texturaPiso(tipo: 'madeira' | 'ladrilho' | 'concreto', base: string, linha: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = base
  g.fillRect(0, 0, 512, 512)
  g.strokeStyle = linha
  if (tipo === 'madeira') {
    g.lineWidth = 3
    for (let y = 0; y < 512; y += 64) {
      g.globalAlpha = 0.08 + ((y / 64) % 3) * 0.04
      g.fillStyle = linha
      g.fillRect(0, y, 512, 64)
      g.globalAlpha = 1
      g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke()
      const corte = ((y / 64) * 197) % 512
      g.beginPath(); g.moveTo(corte, y); g.lineTo(corte, y + 64); g.stroke()
    }
  } else if (tipo === 'ladrilho') {
    g.lineWidth = 4
    for (let i = 0; i <= 512; i += 128) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke()
      g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke()
    }
  } else {
    g.globalAlpha = 0.12
    for (let i = 0; i < 400; i++) {
      g.fillStyle = i % 2 ? linha : '#ffffff'
      g.fillRect((i * 97) % 512, (i * 211) % 512, 3 + (i % 5), 3 + (i % 3))
    }
    g.globalAlpha = 0.5
    g.lineWidth = 2
    for (let i = 0; i <= 512; i += 256) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke()
      g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke()
    }
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(4, 2.5)
  t.colorSpace = SRGBColorSpace
  return t
}
