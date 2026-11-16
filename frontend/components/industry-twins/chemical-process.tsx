"use client"

import { PipeSegment, StructuralFrame, TwinMachine, type TwinSceneProps, VerticalVessel } from "@/components/industry-twins/shared"

export function ChemicalProcessScene(scene: TwinSceneProps) {
  return (
    <>
      <PipeSegment start={[-6.0, 2.5, 0.65]} end={[6.1, 2.5, 0.65]} radius={0.075} color="#4aa5b7" />
      <PipeSegment start={[-3.72, 2.5, 0.65]} end={[-3.72, 2.1, -0.65]} radius={0.06} />
      <PipeSegment start={[1.24, 2.5, 0.65]} end={[1.24, 1.7, -0.65]} radius={0.06} />
      <PipeSegment start={[3.72, 2.5, 0.65]} end={[3.72, 1.4, 0.65]} radius={0.06} />
      <TwinMachine scene={scene} id="storage">
        <group position={[-0.4, 0, 0]}><VerticalVessel radius={0.43} height={1.55} color="#476a78" /></group>
        <group position={[0.44, 0, 0]}><VerticalVessel radius={0.43} height={1.55} color="#537c89" /></group>
        <mesh position={[0, 2.3, 0]}><boxGeometry args={[1.62, 0.12, 1.22]} /><meshStandardMaterial color="#75939b" metalness={0.7} /></mesh>
      </TwinMachine>
      <TwinMachine scene={scene} id="reactor">
        <VerticalVessel radius={0.68} height={1.48} color="#4f7887" />
        <mesh position={[0, 2.4, 0]}><cylinderGeometry args={[0.19, 0.19, 0.28, 16]} /><meshStandardMaterial color="#9ab4b7" metalness={0.8} /></mesh>
        <mesh position={[0, 1.9, 0]}><cylinderGeometry args={[0.06, 0.06, 1.5, 12]} /><meshStandardMaterial color="#c1d0cc" metalness={0.82} /></mesh>
        <mesh position={[0, 1.15, 0]} rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[0.72, 0.08, 0.12]} /><meshStandardMaterial color="#cfaa55" metalness={0.58} /></mesh>
        <PipeSegment start={[0.62, 1.5, 0]} end={[0.9, 1.5, 0]} radius={0.045} color="#cfaa55" />
      </TwinMachine>
      <TwinMachine scene={scene} id="mixer">
        <VerticalVessel radius={0.61} height={1.34} color="#456d7d" />
        <mesh position={[0, 2.25, 0]}><boxGeometry args={[0.62, 0.24, 0.5]} /><meshStandardMaterial color="#839ba2" metalness={0.72} /></mesh>
        <mesh position={[0, 2.0, 0]}><cylinderGeometry args={[0.055, 0.055, 1.4, 12]} /><meshStandardMaterial color="#b9c9c8" metalness={0.8} /></mesh>
        {[-0.33, 0.33].map((x) => <mesh key={x} position={[x, 1.35, 0]} rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[0.44, 0.06, 0.08]} /><meshStandardMaterial color="#d0aa58" metalness={0.6} /></mesh>)}
        <mesh position={[0.5, 1.16, 0.58]}><boxGeometry args={[0.36, 0.28, 0.07]} /><meshStandardMaterial color="#39a4b7" emissive="#155263" emissiveIntensity={0.42} /></mesh>
      </TwinMachine>
      <TwinMachine scene={scene} id="exchanger">
        <StructuralFrame width={1.74} height={1.65} depth={1.32} />
        <mesh position={[0, 1.14, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.45, 0.45, 1.3, 28]} /><meshStandardMaterial color="#657f88" metalness={0.72} roughness={0.3} /></mesh>
        {[-0.45, -0.15, 0.15, 0.45].map((z) => <mesh key={z} position={[0, 1.14, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.31, 0.31, 1.38, 20]} /><meshStandardMaterial color="#397e8e" metalness={0.62} /></mesh>)}
        <PipeSegment start={[-0.75, 1.7, 0]} end={[-0.75, 0.7, 0]} radius={0.055} />
        <PipeSegment start={[0.75, 0.7, 0]} end={[0.75, 1.7, 0]} radius={0.055} color="#d3a650" />
      </TwinMachine>
      <TwinMachine scene={scene} id="pump">
        <mesh position={[-0.1, 0.56, 0]}><boxGeometry args={[1.35, 0.52, 0.86]} /><meshStandardMaterial color="#375b6b" metalness={0.6} /></mesh>
        <mesh position={[0.02, 1.13, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.35, 0.35, 0.45, 24]} /><meshStandardMaterial color="#80a1a8" metalness={0.76} /></mesh>
        <mesh position={[0.53, 1.12, 0]}><cylinderGeometry args={[0.2, 0.2, 0.24, 22]} /><meshStandardMaterial color="#b4c3c4" metalness={0.82} /></mesh>
        <StructuralFrame width={1.25} height={1.25} depth={1.0} color="#385b69" />
        <PipeSegment start={[0.52, 1.12, 0]} end={[0.9, 1.12, 0]} radius={0.08} color="#4bb0c0" />
      </TwinMachine>
      <TwinMachine scene={scene} id="valves">
        <StructuralFrame width={1.65} height={1.8} depth={1.28} color="#466d7a" />
        <PipeSegment start={[-0.65, 0.65, 0]} end={[-0.65, 1.95, 0]} radius={0.075} />
        <PipeSegment start={[0, 0.65, 0]} end={[0, 1.95, 0]} radius={0.075} color="#d1a751" />
        <PipeSegment start={[0.65, 0.65, 0]} end={[0.65, 1.95, 0]} radius={0.075} />
        {[-0.65, 0, 0.65].map((x) => (
          <group key={x} position={[x, 1.4, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.21, 0.21, 0.23, 18]} /><meshStandardMaterial color="#78959c" metalness={0.76} /></mesh>
            <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.14, 0.55, 0.14]} /><meshStandardMaterial color="#c6a754" metalness={0.62} /></mesh>
            <mesh position={[0, 0.62, 0]}><boxGeometry args={[0.45, 0.12, 0.12]} /><meshStandardMaterial color="#c6a754" metalness={0.62} /></mesh>
          </group>
        ))}
      </TwinMachine>
    </>
  )
}
