"use client"

import { HorizontalDrum, PipeSegment, Roller, StructuralFrame, TwinMachine, type TwinSceneProps, VerticalVessel } from "@/components/industry-twins/shared"

export function FoodBeverageScene(scene: TwinSceneProps) {
  return (
    <>
      <PipeSegment start={[-4.0, 1.75, -0.65]} end={[-2.2, 1.75, -0.35]} color="#56aebb" />
      <PipeSegment start={[-0.45, 1.72, 0.65]} end={[0.6, 1.72, 0.4]} color="#56aebb" />
      <TwinMachine scene={scene} id="feed">
        <mesh position={[0, 1.55, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.65, 1.1, 8]} /><meshStandardMaterial color="#577c87" metalness={0.56} roughness={0.38} /></mesh>
        <mesh position={[0, 2.12, 0]}><cylinderGeometry args={[0.67, 0.67, 0.12, 12]} /><meshStandardMaterial color="#8ba4aa" metalness={0.72} /></mesh>
        <mesh position={[0, 0.88, 0]}><cylinderGeometry args={[0.15, 0.15, 0.3, 12]} /><meshStandardMaterial color="#bdd0cd" metalness={0.72} /></mesh>
        <StructuralFrame width={1.4} height={1.2} depth={1.1} color="#486d7b" />
      </TwinMachine>
      <TwinMachine scene={scene} id="mixing">
        <group position={[-0.42, 0, 0]}><VerticalVessel radius={0.48} height={1.42} color="#4b7886" /></group>
        <group position={[0.42, 0, 0]}><VerticalVessel radius={0.48} height={1.42} color="#5b8892" /></group>
        <mesh position={[0, 2.23, 0]}><boxGeometry args={[1.5, 0.14, 1.24]} /><meshStandardMaterial color="#9bb5b7" metalness={0.72} /></mesh>
        <mesh position={[0, 2.36, 0]}><boxGeometry args={[0.48, 0.18, 0.42]} /><meshStandardMaterial color="#415f6a" metalness={0.62} /></mesh>
      </TwinMachine>
      <TwinMachine scene={scene} id="pasteurizer">
        <StructuralFrame width={1.82} height={1.7} depth={1.32} />
        <HorizontalDrum position={[0, 1.0, 0]} radius={0.44} length={1.32} color="#87a4aa" />
        <mesh position={[0, 1.0, 0.68]}><cylinderGeometry args={[0.48, 0.48, 0.12, 24]} /><meshStandardMaterial color="#4c7280" metalness={0.73} /></mesh>
        <mesh position={[0, 1.0, -0.68]}><cylinderGeometry args={[0.48, 0.48, 0.12, 24]} /><meshStandardMaterial color="#4c7280" metalness={0.73} /></mesh>
        <PipeSegment start={[-0.6, 1.65, 0]} end={[0.6, 1.65, 0]} radius={0.055} color="#d2a74e" />
        <mesh position={[0.54, 1.92, 0.45]}><boxGeometry args={[0.42, 0.36, 0.08]} /><meshStandardMaterial color="#34a5b9" emissive="#124d5c" emissiveIntensity={0.44} /></mesh>
      </TwinMachine>
      <TwinMachine scene={scene} id="filler">
        <StructuralFrame width={1.82} height={2.05} depth={1.35} color="#4f7884" />
        <mesh position={[0, 1.6, 0]}><boxGeometry args={[1.42, 0.22, 1.04]} /><meshStandardMaterial color="#6b8b93" metalness={0.65} /></mesh>
        {[-0.48, 0, 0.48].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.16, 0.18, 0.64, 18]} /><meshStandardMaterial color="#9ec4c6" metalness={0.32} roughness={0.22} /></mesh>
            <mesh position={[0, 0.91, 0]}><cylinderGeometry args={[0.17, 0.17, 0.08, 18]} /><meshStandardMaterial color="#d0aa59" metalness={0.6} /></mesh>
            <mesh position={[0, 1.34, 0]}><cylinderGeometry args={[0.035, 0.035, 0.72, 10]} /><meshStandardMaterial color="#b2c7c7" metalness={0.76} /></mesh>
          </group>
        ))}
        <mesh position={[0, 0.23, 0]}><boxGeometry args={[1.9, 0.08, 1.42]} /><meshStandardMaterial color="#273f4a" /></mesh>
      </TwinMachine>
      <TwinMachine scene={scene} id="conveyor">
        <StructuralFrame width={1.88} height={0.55} depth={1.42} />
        {[-0.58, -0.29, 0, 0.29, 0.58].map((z) => <Roller key={z} position={[0, 0.72, z]} radius={0.12} width={1.65} color="#879da1" />)}
        {[-0.62, 0, 0.62].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 1.06, 0]}><cylinderGeometry args={[0.15, 0.18, 0.54, 18]} /><meshStandardMaterial color="#a9c9c8" metalness={0.26} roughness={0.22} /></mesh>
            <mesh position={[0, 1.36, 0]}><cylinderGeometry args={[0.15, 0.15, 0.08, 18]} /><meshStandardMaterial color="#d3ae5a" metalness={0.58} /></mesh>
          </group>
        ))}
        <mesh position={[0, 1.58, 0]}><boxGeometry args={[1.78, 0.08, 0.12]} /><meshStandardMaterial color="#3f7787" metalness={0.62} /></mesh>
      </TwinMachine>
      <TwinMachine scene={scene} id="packout">
        <StructuralFrame width={1.82} height={1.85} depth={1.36} color="#4b6a78" />
        <mesh position={[0, 0.78, 0]}><boxGeometry args={[1.68, 0.12, 1.18]} /><meshStandardMaterial color="#263e4a" /></mesh>
        {[-0.48, 0, 0.48].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 1.17, 0]}><boxGeometry args={[0.38, 0.7, 0.7]} /><meshStandardMaterial color="#526f7a" metalness={0.48} /></mesh>
            <mesh position={[0, 1.18, 0.37]}><boxGeometry args={[0.25, 0.42, 0.025]} /><meshStandardMaterial color="#45aabe" emissive="#164e5b" emissiveIntensity={0.28} /></mesh>
            <mesh position={[0, 1.62, 0]}><boxGeometry args={[0.4, 0.08, 0.72]} /><meshStandardMaterial color="#d1aa55" metalness={0.48} /></mesh>
          </group>
        ))}
      </TwinMachine>
    </>
  )
}
