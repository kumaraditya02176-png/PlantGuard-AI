"use client"

import { HorizontalDrum, Roller, StructuralFrame, TwinMachine, type TwinSceneProps } from "@/components/industry-twins/shared"

export function SteelMetalsScene(scene: TwinSceneProps) {
  return (
    <>
      <TwinMachine scene={scene} id="slab">
        <mesh position={[0, 0.62, 0]} castShadow receiveShadow><boxGeometry args={[1.72, 0.48, 1.05]} /><meshStandardMaterial color="#cc6746" emissive="#7d2918" emissiveIntensity={0.42} metalness={0.45} roughness={0.38} /></mesh>
        <mesh position={[0, 0.88, 0]}><boxGeometry args={[1.34, 0.035, 0.8]} /><meshBasicMaterial color="#ff9a55" transparent opacity={0.6} /></mesh>
        {[-0.55, 0, 0.55].map((x) => <Roller key={x} position={[x, 0.34, 0]} radius={0.12} width={1.24} color="#687e85" />)}
        <StructuralFrame width={1.85} height={0.62} depth={1.34} color="#485e68" />
      </TwinMachine>
      <TwinMachine scene={scene} id="furnace">
        <mesh position={[0, 1.16, 0]} castShadow><boxGeometry args={[1.72, 1.62, 1.45]} /><meshStandardMaterial color="#394b55" metalness={0.57} roughness={0.5} /></mesh>
        <mesh position={[0, 0.82, 0.74]}><boxGeometry args={[1.05, 0.78, 0.055]} /><meshStandardMaterial color="#120f12" emissive="#8a311c" emissiveIntensity={0.45} /></mesh>
        <mesh position={[0, 0.8, 0.79]}><boxGeometry args={[0.74, 0.18, 0.08]} /><meshStandardMaterial color="#ff7c42" emissive="#db491e" emissiveIntensity={1.25} /></mesh>
        {[-0.52, 0.52].map((x) => <mesh key={x} position={[x, 1.18, 0.79]}><boxGeometry args={[0.08, 1.2, 0.08]} /><meshStandardMaterial color="#80949a" metalness={0.72} /></mesh>)}
        <mesh position={[0.55, 2.14, -0.42]}><cylinderGeometry args={[0.17, 0.23, 0.82, 18]} /><meshStandardMaterial color="#4b606a" metalness={0.62} /></mesh>
        <mesh position={[-0.45, 0.56, 1.0]}><boxGeometry args={[0.32, 0.3, 0.05]} /><meshStandardMaterial color="#318ca0" emissive="#123a48" emissiveIntensity={0.5} /></mesh>
      </TwinMachine>
      <TwinMachine scene={scene} id="conveyor">
        <StructuralFrame width={1.8} height={0.62} depth={1.35} />
        {[-0.62, -0.31, 0, 0.31, 0.62].map((z) => <Roller key={z} position={[0, 0.75, z]} radius={0.14} width={1.62} />)}
        <mesh position={[0, 0.94, 0]}><boxGeometry args={[1.68, 0.08, 0.12]} /><meshStandardMaterial color="#cf704c" emissive="#7e301c" emissiveIntensity={0.28} /></mesh>
        {[-0.7, 0.7].map((x) => <mesh key={x} position={[x, 0.46, 0]}><boxGeometry args={[0.12, 0.58, 1.52]} /><meshStandardMaterial color="#405965" metalness={0.6} /></mesh>)}
      </TwinMachine>
      <TwinMachine scene={scene} id="mill">
        <StructuralFrame width={1.82} height={2.05} depth={1.42} color="#6e8790" />
        <Roller position={[0, 1.05, 0]} radius={0.35} width={1.32} color="#c5d0cf" />
        <Roller position={[0, 1.72, 0]} radius={0.31} width={1.32} color="#d0d7d2" />
        {[-0.5, 0.5].map((x) => <mesh key={x} position={[x, 1.4, 0.57]}><cylinderGeometry args={[0.1, 0.1, 0.65, 16]} /><meshStandardMaterial color="#d1a24d" metalness={0.65} /></mesh>)}
        <mesh position={[0, 0.76, 0]}><boxGeometry args={[0.86, 0.1, 0.96]} /><meshStandardMaterial color="#cc6846" emissive="#772714" emissiveIntensity={0.3} /></mesh>
      </TwinMachine>
      <TwinMachine scene={scene} id="cooling">
        <StructuralFrame width={1.82} height={1.86} depth={1.4} color="#477080" />
        {[-0.55, -0.18, 0.18, 0.55].map((z) => (
          <group key={z}>
            <Roller position={[0, 0.76, z]} radius={0.11} width={1.48} />
            <mesh position={[0, 1.9, z]}><boxGeometry args={[1.55, 0.075, 0.075]} /><meshStandardMaterial color="#549fb0" metalness={0.62} /></mesh>
            {[-0.5, 0, 0.5].map((x) => <mesh key={x} position={[x, 1.76, z]} rotation={[0.18, 0, 0]}><coneGeometry args={[0.08, 0.22, 8]} /><meshStandardMaterial color="#54bdd0" emissive="#146071" emissiveIntensity={0.38} /></mesh>)}
          </group>
        ))}
      </TwinMachine>
      <TwinMachine scene={scene} id="coiler">
        <StructuralFrame width={1.7} height={1.95} depth={1.32} />
        <HorizontalDrum position={[0, 1.28, 0]} radius={0.59} length={1.12} color="#c0c9c6" />
        <mesh position={[0, 1.28, 0.61]}><cylinderGeometry args={[0.71, 0.71, 0.11, 32]} /><meshStandardMaterial color="#879ba0" metalness={0.8} /></mesh>
        <mesh position={[0, 1.28, -0.61]}><cylinderGeometry args={[0.71, 0.71, 0.11, 32]} /><meshStandardMaterial color="#879ba0" metalness={0.8} /></mesh>
        <mesh position={[0, 0.6, 0]}><boxGeometry args={[0.7, 0.2, 0.78]} /><meshStandardMaterial color="#d26743" emissive="#762812" emissiveIntensity={0.32} /></mesh>
      </TwinMachine>
    </>
  )
}
