"use client"

import { HorizontalDrum, PipeSegment, Roller, StructuralFrame, TwinMachine, type TwinSceneProps, VerticalVessel } from "@/components/industry-twins/shared"

export function PaperPulpScene(scene: TwinSceneProps) {
  return (
    <>
      <PipeSegment start={[-5.5, 1.4, -0.65]} end={[-4.0, 1.4, -0.1]} color="#3e9ba8" />
      <PipeSegment start={[-3.4, 1.5, 0.65]} end={[-2.2, 1.5, 0.0]} color="#3e9ba8" />
      <PipeSegment start={[0.9, 2.25, -0.65]} end={[2.7, 2.25, -0.6]} color="#66a4ac" />
      <TwinMachine scene={scene} id="stock-prep">
        <group position={[-0.42, 0, 0]}><VerticalVessel radius={0.48} height={1.32} color="#416a78" /></group>
        <group position={[0.48, 0, 0]}><VerticalVessel radius={0.48} height={1.32} color="#527987" /></group>
        <mesh position={[0, 2.12, 0]}><boxGeometry args={[1.58, 0.12, 1.32]} /><meshStandardMaterial color="#91aab0" metalness={0.75} /></mesh>
      </TwinMachine>
      <TwinMachine scene={scene} id="refiner">
        <StructuralFrame width={1.55} height={1.4} depth={1.05} />
        <HorizontalDrum position={[0, 1.05, 0]} radius={0.46} length={1.05} color="#718c93" />
        <mesh position={[-0.7, 0.85, 0]}><boxGeometry args={[0.38, 0.62, 0.7]} /><meshStandardMaterial color="#344f5b" metalness={0.63} /></mesh>
        <mesh position={[0.68, 0.85, 0]}><cylinderGeometry args={[0.22, 0.22, 0.34, 18]} /><meshStandardMaterial color="#8da9af" metalness={0.78} /></mesh>
        <PipeSegment start={[-0.6, 1.55, -0.3]} end={[0.55, 1.55, -0.3]} radius={0.045} />
      </TwinMachine>
      <TwinMachine scene={scene} id="forming">
        <StructuralFrame width={1.7} height={1.52} depth={1.3} color="#426779" />
        {[0.52, 0.9, 1.28].map((y) => <Roller key={y} position={[0, y, 0.04]} radius={0.19} width={1.24} color="#a9c4c9" />)}
        <mesh position={[0, 1.72, 0]}><boxGeometry args={[1.78, 0.24, 1.3]} /><meshStandardMaterial color="#647f89" metalness={0.56} /></mesh>
        <mesh position={[0, 1.91, 0.1]}><boxGeometry args={[1.38, 0.11, 0.42]} /><meshStandardMaterial color="#39a4b7" emissive="#124b59" emissiveIntensity={0.3} /></mesh>
      </TwinMachine>
      <TwinMachine scene={scene} id="press">
        <StructuralFrame width={1.62} height={1.76} depth={1.25} />
        {[0.72, 1.18, 1.64].map((y) => <Roller key={y} position={[0, y, 0]} radius={0.27} width={1.24} />)}
        <mesh position={[0, 1.96, 0]}><boxGeometry args={[1.28, 0.1, 1.08]} /><meshStandardMaterial color="#5a7c87" metalness={0.58} /></mesh>
      </TwinMachine>
      <TwinMachine scene={scene} id="dryers">
        <StructuralFrame width={1.7} height={2.05} depth={1.32} color="#506d79" />
        {[-0.48, 0, 0.48].map((x) => <HorizontalDrum key={x} position={[x, 1.06, 0]} radius={0.44} length={1.15} color="#b4c6c7" />)}
        <mesh position={[0, 2.08, 0]}><boxGeometry args={[1.8, 0.12, 1.4]} /><meshStandardMaterial color="#405f6b" metalness={0.6} /></mesh>
        <mesh position={[0, 2.22, 0]}><boxGeometry args={[1.35, 0.035, 1.0]} /><meshBasicMaterial color="#e5ae4d" transparent opacity={0.5} /></mesh>
      </TwinMachine>
      <TwinMachine scene={scene} id="reel">
        <StructuralFrame width={1.65} height={1.75} depth={1.3} />
        <HorizontalDrum position={[0, 1.28, 0]} radius={0.57} length={1.1} color="#d3d5ca" />
        <mesh position={[0, 1.28, 0.58]}><cylinderGeometry args={[0.68, 0.68, 0.1, 28]} /><meshStandardMaterial color="#557987" metalness={0.68} /></mesh>
        <mesh position={[0, 1.28, -0.58]}><cylinderGeometry args={[0.68, 0.68, 0.1, 28]} /><meshStandardMaterial color="#557987" metalness={0.68} /></mesh>
        <mesh position={[0, 2.08, 0]} rotation={[0, 0, -0.15]}><boxGeometry args={[1.28, 0.045, 0.82]} /><meshStandardMaterial color="#d4d0bb" roughness={0.75} /></mesh>
      </TwinMachine>
    </>
  )
}
