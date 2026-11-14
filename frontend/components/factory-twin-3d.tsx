"use client"

import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { Quaternion, Vector3 } from "three"

export type FactoryRiskBand = "low" | "moderate" | "high" | "offline"
export type FactoryStation = {
  id: string
  label: string
  field: string
  value: string
  band: FactoryRiskBand
  position: [number, number, number]
  description: string
}

const bandColors: Record<FactoryRiskBand, string> = {
  low: "#43c994",
  moderate: "#e5ae4d",
  high: "#ed6f70",
  offline: "#718496",
}

function OrbitRig() {
  const { camera, gl, invalidate } = useThree()
  const controls = useRef<OrbitControls | null>(null)

  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement)
    const requestFrame = () => invalidate()
    orbit.target.set(0, 0.4, 0)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.08
    orbit.enablePan = false
    orbit.minDistance = 6.5
    orbit.maxDistance = 15
    orbit.minPolarAngle = Math.PI * 0.22
    orbit.maxPolarAngle = Math.PI * 0.49
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

function Pipe({ start, end, color = "#598b9c" }: { start: Vector3; end: Vector3; color?: string }) {
  const geometry = useMemo(() => {
    const direction = end.clone().sub(start)
    const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize())
    return {
      position: start.clone().add(end).multiplyScalar(0.5),
      quaternion,
      length: direction.length(),
    }
  }, [end, start])

  return (
    <mesh position={geometry.position} quaternion={geometry.quaternion} castShadow>
      <cylinderGeometry args={[0.055, 0.055, geometry.length, 10]} />
      <meshStandardMaterial color={color} metalness={0.65} roughness={0.32} />
    </mesh>
  )
}

function SignalZone({ station, selected, onSelect }: { station: FactoryStation; selected: boolean; onSelect: () => void }) {
  const color = bandColors[station.band]
  return (
    <group position={station.position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]} onClick={onSelect}>
        <cylinderGeometry args={[selected ? 0.9 : 0.72, selected ? 0.9 : 0.72, 0.025, 40]} />
        <meshBasicMaterial color={color} transparent opacity={station.band === "offline" ? 0.08 : 0.22} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.38, 0]} onClick={onSelect}>
        <sphereGeometry args={[0.12, 16, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[0, 1.38, 0]} scale={selected ? 1.5 : 1}>
        <sphereGeometry args={[0.22, 16, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.14} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Equipment({ station, selected, onSelect }: { station: FactoryStation; selected: boolean; onSelect: () => void }) {
  const material = selected ? "#4ca9bc" : "#25495b"
  const sideMaterial = selected ? "#28738a" : "#173443"
  const onHover = (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    document.body.style.cursor = "pointer"
  }
  const onLeave = () => {
    document.body.style.cursor = ""
  }

  return (
    <group position={station.position} onClick={(event) => { event.stopPropagation(); onSelect() }} onPointerOver={onHover} onPointerOut={onLeave}>
      {station.id === "feed" && (
        <>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow><cylinderGeometry args={[0.48, 0.32, 0.9, 6]} /><meshStandardMaterial color={material} metalness={0.45} roughness={0.38} /></mesh>
          <mesh position={[0, 0.96, 0]} castShadow><cylinderGeometry args={[0.52, 0.52, 0.12, 6]} /><meshStandardMaterial color={sideMaterial} metalness={0.6} /></mesh>
          <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.12, 0.12, 0.12, 12]} /><meshStandardMaterial color="#d5aa60" metalness={0.45} /></mesh>
        </>
      )}
      {station.id === "extruder" && (
        <>
          <mesh position={[0, 0.42, 0]} castShadow receiveShadow><boxGeometry args={[1.65, 0.78, 0.92]} /><meshStandardMaterial color={material} metalness={0.48} roughness={0.34} /></mesh>
          <mesh position={[0.15, 0.91, 0]} castShadow><cylinderGeometry args={[0.19, 0.19, 0.22, 12]} /><meshStandardMaterial color="#d7a254" metalness={0.58} /></mesh>
          <mesh position={[0.86, 0.42, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.18, 0.18, 0.75, 12]} /><meshStandardMaterial color="#7c9ba5" metalness={0.72} roughness={0.28} /></mesh>
          <mesh position={[-0.22, 0.42, 0.475]}><boxGeometry args={[0.45, 0.3, 0.025]} /><meshStandardMaterial color="#69c8d2" emissive="#276b78" emissiveIntensity={0.45} /></mesh>
        </>
      )}
      {station.id === "cooling" && (
        <>
          <mesh position={[0, 0.54, 0]} castShadow receiveShadow><boxGeometry args={[1.25, 1.05, 0.86]} /><meshStandardMaterial color={material} metalness={0.42} roughness={0.38} /></mesh>
          {[-0.37, 0, 0.37].map((x) => <mesh key={x} position={[x, 0.57, 0.445]}><circleGeometry args={[0.13, 16]} /><meshStandardMaterial color="#58bed0" emissive="#155a6d" emissiveIntensity={0.4} /></mesh>)}
          <mesh position={[0, 1.1, 0]}><boxGeometry args={[1.3, 0.08, 0.92]} /><meshStandardMaterial color="#547e8b" metalness={0.5} /></mesh>
        </>
      )}
      {station.id === "output" && (
        <>
          <mesh position={[0, 0.32, 0]} castShadow><boxGeometry args={[0.9, 0.5, 0.8]} /><meshStandardMaterial color={material} metalness={0.45} roughness={0.34} /></mesh>
          {[-0.24, 0.24].map((z) => <mesh key={z} position={[0, 0.78, z]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[0.16, 0.16, 0.12, 16]} /><meshStandardMaterial color="#a8bdc2" metalness={0.76} roughness={0.22} /></mesh>)}
          <mesh position={[0, 1.15, 0]}><boxGeometry args={[0.11, 0.62, 0.11]} /><meshStandardMaterial color="#638491" metalness={0.6} /></mesh>
          <mesh position={[0, 1.49, 0]}><boxGeometry args={[0.48, 0.22, 0.12]} /><meshStandardMaterial color="#d6aa59" emissive="#624618" emissiveIntensity={0.24} /></mesh>
        </>
      )}
      <mesh position={[0, 0.04, 0]}><boxGeometry args={[station.id === "extruder" ? 1.9 : 1.5, 0.08, 1.12]} /><meshStandardMaterial color={sideMaterial} metalness={0.34} /></mesh>
    </group>
  )
}

function FactoryScene({ stations, selectedId, onSelect }: { stations: FactoryStation[]; selectedId: string; onSelect: (id: string) => void }) {
  const mainPipePoints = [
    new Vector3(-3.65, 0.8, -1.2),
    new Vector3(-2.45, 0.85, -0.85),
    new Vector3(-0.75, 0.83, -0.45),
    new Vector3(1.95, 0.8, 0.05),
    new Vector3(3.55, 0.76, 0.52),
  ]

  return (
    <>
      <color attach="background" args={["#0c1822"]} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[4, 8, 5]} intensity={2.2} />
      <directionalLight position={[-5, 4, -4]} intensity={0.8} color="#61b9cf" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]} receiveShadow>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial color="#142b38" roughness={0.84} metalness={0.08} />
      </mesh>
      <gridHelper args={[12, 24, "#356071", "#203d4b"]} position={[0, 0, 0]} />
      <mesh position={[0, -0.11, -2.96]}><boxGeometry args={[12, 0.18, 0.12]} /><meshStandardMaterial color="#1a3442" /></mesh>
      {mainPipePoints.slice(0, -1).map((point, index) => <Pipe key={index} start={point} end={mainPipePoints[index + 1]} color={index === 2 ? "#55b8c5" : "#527f8e"} />)}
      <Pipe start={new Vector3(-3.65, 0.8, -1.2)} end={new Vector3(-3.65, 1.8, -1.2)} />
      <Pipe start={new Vector3(1.95, 0.8, 0.05)} end={new Vector3(1.95, 1.75, 0.05)} color="#4c9caf" />
      {stations.map((station) => (
        <group key={station.id}>
          <SignalZone station={station} selected={selectedId === station.id} onSelect={() => onSelect(station.id)} />
          <Equipment station={station} selected={selectedId === station.id} onSelect={() => onSelect(station.id)} />
        </group>
      ))}
      <mesh position={[-2.15, 0.7, 1.65]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.08, 0.08, 2.4, 10]} /><meshStandardMaterial color="#407081" metalness={0.6} /></mesh>
      <OrbitRig />
    </>
  )
}

class SceneErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function FactoryTwin3D({ stations }: { stations: FactoryStation[] }) {
  const [selectedId, setSelectedId] = useState(stations[0]?.id ?? "extruder")
  const selected = stations.find((station) => station.id === selectedId) ?? stations[0]

  return (
    <div className="factory-twin">
      <div className="factory-canvas-wrap" role="img" aria-label="Interactive simulated extrusion factory schematic. Use the equipment selector below to select a station.">
        <SceneErrorBoundary fallback={<p className="twin-fallback-message">3D rendering is unavailable. The SVG process illustration is shown instead.</p>}>
          <Canvas frameloop="demand" camera={{ position: [7.6, 6.8, 9.2], fov: 40 }} dpr={[1, 1.4]} gl={{ antialias: true, powerPreference: "low-power" }}>
            <FactoryScene stations={stations} selectedId={selected?.id ?? selectedId} onSelect={setSelectedId} />
          </Canvas>
        </SceneErrorBoundary>
        <span className="factory-view-hint">Drag to rotate · scroll to zoom</span>
      </div>
      <div className="factory-details">
        <div className="factory-station-selector" role="group" aria-label="Select simulated equipment">
          {stations.map((station) => (
            <button key={station.id} className={station.id === selected?.id ? "selected" : ""} type="button" aria-pressed={station.id === selected?.id} onClick={() => setSelectedId(station.id)}>
              <i style={{ backgroundColor: bandColors[station.band] }} />{station.label}
            </button>
          ))}
        </div>
        {selected && (
          <div className="factory-selected-detail" aria-live="polite">
            <div><span className="micro-label">SELECTED SIMULATED EQUIPMENT</span><strong>{selected.label}</strong><small>{selected.description}</small></div>
            <span className={`tag tag-${selected.band}`}>{selected.band === "offline" ? "Unavailable" : `${selected.band} signal`}</span>
            <b>{selected.value}</b>
          </div>
        )}
      </div>
      <p className="factory-safety-note">Illustrative simulator signals only · zones are not safety-rated alarms or facility locations.</p>
    </div>
  )
}
