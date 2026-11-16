"use client"

import { useEffect, useMemo, useRef, type ReactNode } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Quaternion, Vector3 } from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { IndustryTwinStationDefinition } from "@/lib/industry-twin-layouts"
import type { FactoryRiskBand } from "@/components/factory-twin-3d"

export type TwinStation = IndustryTwinStationDefinition & {
  band: FactoryRiskBand
  signals: Array<{ key: string; label: string; unit: string; value: string }>
}

export type TwinSceneProps = {
  stations: TwinStation[]
  selectedId: string
  onSelect: (id: string) => void
}

const bandColor: Record<FactoryRiskBand, string> = {
  low: "#43c994",
  moderate: "#e5ae4d",
  high: "#ed6f70",
  offline: "#718496",
}

export function SceneControls() {
  const { camera, gl, invalidate } = useThree()
  const controls = useRef<OrbitControls | null>(null)

  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement)
    const requestFrame = () => invalidate()
    orbit.target.set(0, 0.8, 0)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.075
    orbit.enablePan = false
    orbit.minDistance = 11
    orbit.maxDistance = 25
    orbit.minPolarAngle = Math.PI * 0.18
    orbit.maxPolarAngle = Math.PI * 0.47
    orbit.addEventListener("change", requestFrame)
    orbit.update()
    controls.current = orbit
    return () => {
      orbit.removeEventListener("change", requestFrame)
      orbit.dispose()
      controls.current = null
    }
  }, [camera, gl, invalidate])

  useFrame(() => controls.current?.update())
  return null
}

export function IndustryHall() {
  return (
    <>
      <color attach="background" args={["#0c1822"]} />
      <ambientLight intensity={1.15} />
      <hemisphereLight args={["#9bc7d4", "#13222c", 1.1]} />
      <directionalLight position={[4, 10, 7]} intensity={2.2} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-8, 5, -5]} intensity={0.9} color="#61b9cf" />
      <mesh position={[0, -0.22, 0]} receiveShadow>
        <boxGeometry args={[18, 0.34, 8.6]} />
        <meshStandardMaterial color="#162c38" roughness={0.82} metalness={0.18} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.045, 0]} receiveShadow>
        <planeGeometry args={[17.8, 8.4]} />
        <meshStandardMaterial color="#11232e" roughness={0.9} metalness={0.08} />
      </mesh>
      <gridHelper args={[17, 34, "#345565", "#203946"]} position={[0, -0.035, 0]} />
      <mesh position={[0, 3.35, -3.72]}>
        <boxGeometry args={[16.8, 0.12, 0.12]} />
        <meshStandardMaterial color="#294553" metalness={0.52} roughness={0.45} />
      </mesh>
      {[-7.8, 7.8].map((x) => (
        <mesh key={x} position={[x, 1.6, -3.72]}>
          <boxGeometry args={[0.14, 3.3, 0.14]} />
          <meshStandardMaterial color="#294553" metalness={0.52} roughness={0.45} />
        </mesh>
      ))}
      <mesh position={[0, 0.02, -3.25]}>
        <boxGeometry args={[15.4, 0.035, 0.08]} />
        <meshBasicMaterial color="#36a9bf" transparent opacity={0.45} />
      </mesh>
      <mesh position={[0, 0.02, 3.25]}>
        <boxGeometry args={[15.4, 0.035, 0.08]} />
        <meshBasicMaterial color="#36a9bf" transparent opacity={0.45} />
      </mesh>
    </>
  )
}

export function MachineNode({
  station,
  selected,
  onSelect,
  children,
}: {
  station: TwinStation
  selected: boolean
  onSelect: () => void
  children: ReactNode
}) {
  const signalColor = bandColor[station.band]
  return (
    <group
      position={station.position}
      onClick={(event) => { event.stopPropagation(); onSelect() }}
      onPointerOver={(event) => { event.stopPropagation(); document.body.style.cursor = "pointer" }}
      onPointerOut={() => { document.body.style.cursor = "" }}
    >
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[2.05, 0.22, 1.72]} />
        <meshStandardMaterial color={selected ? "#28667a" : "#1c3947"} metalness={0.52} roughness={0.44} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.245, 0]}>
        <ringGeometry args={[selected ? 0.9 : 0.83, selected ? 0.98 : 0.88, 48]} />
        <meshBasicMaterial color={signalColor} transparent opacity={station.band === "offline" ? 0.28 : 0.72} side={2} />
      </mesh>
      {children}
      <mesh position={[0.78, 2.45, 0.52]}>
        <sphereGeometry args={[0.105, 18, 14]} />
        <meshStandardMaterial color={signalColor} emissive={signalColor} emissiveIntensity={0.65} />
      </mesh>
      <mesh position={[0.78, 2.45, 0.52]} scale={1.55}>
        <sphereGeometry args={[0.16, 16, 12]} />
        <meshBasicMaterial color={signalColor} transparent opacity={0.14} depthWrite={false} />
      </mesh>
    </group>
  )
}

export function TwinMachine({
  scene,
  id,
  children,
}: {
  scene: TwinSceneProps
  id: string
  children: ReactNode
}) {
  const station = scene.stations.find((item) => item.id === id)
  if (!station) return null
  return (
    <MachineNode
      station={station}
      selected={scene.selectedId === id}
      onSelect={() => scene.onSelect(id)}
    >
      {children}
    </MachineNode>
  )
}

export function VerticalVessel({
  radius = 0.53,
  height = 1.3,
  color = "#547a88",
  legs = true,
}: {
  radius?: number
  height?: number
  color?: string
  legs?: boolean
}) {
  const top = 0.48 + height
  return (
    <group>
      <mesh position={[0, 0.48 + height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, height, 28]} />
        <meshStandardMaterial color={color} metalness={0.64} roughness={0.32} />
      </mesh>
      <mesh position={[0, top, 0]} castShadow>
        <sphereGeometry args={[radius, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} metalness={0.68} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.48, 0]} rotation={[Math.PI, 0, 0]} castShadow>
        <sphereGeometry args={[radius, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} metalness={0.62} roughness={0.34} />
      </mesh>
      <mesh position={[0, top + 0.12, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.25, 16]} />
        <meshStandardMaterial color="#8ba9b2" metalness={0.78} roughness={0.26} />
      </mesh>
      <mesh position={[radius * 1.005, 0.95, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.62, 12]} />
        <meshStandardMaterial color="#7bc7d2" emissive="#245b66" emissiveIntensity={0.22} />
      </mesh>
      {legs && [-1, 1].flatMap((x) => [-1, 1].map((z) => (
        <mesh key={`${x}-${z}`} position={[x * radius * 0.66, 0.27, z * radius * 0.66]}>
          <cylinderGeometry args={[0.045, 0.055, 0.44, 10]} />
          <meshStandardMaterial color="#6d8b94" metalness={0.67} roughness={0.32} />
        </mesh>
      )))}
    </group>
  )
}

export function Roller({
  position,
  radius = 0.2,
  width = 1.25,
  color = "#a9c2c8",
}: {
  position: [number, number, number]
  radius?: number
  width?: number
  color?: string
}) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[radius, radius, width, 24]} />
      <meshStandardMaterial color={color} metalness={0.82} roughness={0.25} />
    </mesh>
  )
}

export function HorizontalDrum({
  position,
  radius = 0.42,
  length = 1.15,
  color = "#718f99",
}: {
  position: [number, number, number]
  radius?: number
  length?: number
  color?: string
}) {
  return (
    <mesh position={position} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, length, 28]} />
      <meshStandardMaterial color={color} metalness={0.72} roughness={0.3} />
    </mesh>
  )
}

export function StructuralFrame({
  width = 1.65,
  height = 1.9,
  depth = 1.25,
  color = "#526f7a",
}: {
  width?: number
  height?: number
  depth?: number
  color?: string
}) {
  return (
    <group>
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
        <mesh key={`${x}-${z}`} position={[x * width / 2, height / 2 + 0.22, z * depth / 2]} castShadow>
          <boxGeometry args={[0.11, height, 0.11]} />
          <meshStandardMaterial color={color} metalness={0.7} roughness={0.35} />
        </mesh>
      )))}
      {[0.32, height + 0.22].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[width + 0.12, 0.1, depth + 0.12]} />
          <meshStandardMaterial color={color} metalness={0.68} roughness={0.38} />
        </mesh>
      ))}
    </group>
  )
}

export function PipeSegment({
  start,
  end,
  radius = 0.055,
  color = "#4d9caf",
}: {
  start: [number, number, number]
  end: [number, number, number]
  radius?: number
  color?: string
}) {
  const geometry = useMemo(() => {
    const first = new Vector3(...start)
    const second = new Vector3(...end)
    const direction = second.clone().sub(first)
    return {
      position: first.add(second).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize()),
      length: direction.length(),
    }
  }, [start, end])
  return (
    <mesh position={geometry.position} quaternion={geometry.quaternion} castShadow>
      <cylinderGeometry args={[radius, radius, geometry.length, 12]} />
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.32} />
    </mesh>
  )
}

export function SceneStationName({ label }: { label: string }) {
  return <group name={label} />
}
