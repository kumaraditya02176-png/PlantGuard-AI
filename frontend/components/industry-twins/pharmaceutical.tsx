"use client"

import { HorizontalDrum, Roller, StructuralFrame, TwinMachine, type TwinSceneProps, VerticalVessel } from "@/components/industry-twins/shared"

export function PharmaceuticalScene(scene: TwinSceneProps) {
  return (
    <>
      <TwinMachine scene={scene} id="dispensing">
        <StructuralFrame width={1.78} height={2.0} depth={1.34} color="#4e7784" />
        <mesh position={[0, 1.35, 0]}><boxGeometry args={[1.55, 1.15, 1.06]} /><meshStandardMaterial color="#b4c6c6" metalness={0.25} roughness={0.3} transparent opacity={0.4} /></mesh>
        <mesh position={[0, 2.02, 0]}><boxGeometry args={[1.7, 0.16, 1.2]} /><meshStandardMaterial color="#6b8d95" metalness={0.62} /></mesh>
        <mesh position={[0, 0.68, 0.55]}><boxGeometry args={[0.88, 0.06, 0.1]} /><meshStandardMaterial color="#d4a84e" metalness={0.52} /></mesh>
        <mesh position={[0, 0.86, 0.54]}><boxGeometry args={[0.52, 0.3, 0.05]} /><meshStandardMaterial color="#344c56" /></mesh>
        <mesh position={[0, 0.86, 0.58]}><boxGeometry args={[0.4, 0.19, 0.02]} /><meshStandardMaterial color="#48b2c4" emissive="#174955" emissiveIntensity={0.42} /></mesh>
        <mesh position={[0, 2.14, 0]}><boxGeometry args={[0.8, 0.08, 0.65]} /><meshStandardMaterial color="#d3d8d1" metalness={0.25} /></mesh>
      </TwinMachine>
      <TwinMachine scene={scene} id="granulator">
        <StructuralFrame width={1.58} height={1.9} depth={1.24} />
        <VerticalVessel radius={0.56} height={1.18} color="#5d7c85" />
        <mesh position={[0, 0.58, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.55, 0.56, 20]} /><meshStandardMaterial color="#627f87" metalness={0.58} /></mesh>
        <mesh position={[0, 2.16, 0]}><boxGeometry args={[0.7, 0.24, 0.58]} /><meshStandardMaterial color="#91a9ac" metalness={0.68} /></mesh>
        <mesh position={[0, 2.32, 0]}><cylinderGeometry args={[0.18, 0.18, 0.14, 18]} /><meshStandardMaterial color="#d1aa56" metalness={0.58} /></mesh>
        <mesh position={[0.59, 1.15, 0.4]}><boxGeometry args={[0.32, 0.38, 0.08]} /><meshStandardMaterial color="#3da5b9" emissive="#174c58" emissiveIntensity={0.38} /></mesh>
      </TwinMachine>
      <TwinMachine scene={scene} id="blender">
        <StructuralFrame width={1.62} height={1.8} depth={1.28} color="#547884" />
        <mesh position={[-0.24, 1.3, 0]} rotation={[0, 0, Math.PI / 4]}><cylinderGeometry args={[0.31, 0.31, 0.82, 22]} /><meshStandardMaterial color="#afc0bd" metalness={0.48} roughness={0.3} /></mesh>
        <mesh position={[0.24, 1.3, 0]} rotation={[0, 0, -Math.PI / 4]}><cylinderGeometry args={[0.31, 0.31, 0.82, 22]} /><meshStandardMaterial color="#afc0bd" metalness={0.48} roughness={0.3} /></mesh>
        <mesh position={[0, 1.3, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.12, 0.12, 0.45, 16]} /><meshStandardMaterial color="#d0a854" metalness={0.62} /></mesh>
        <mesh position={[0, 2.07, 0]}><boxGeometry args={[0.48, 0.3, 0.5]} /><meshStandardMaterial color="#496875" metalness={0.6} /></mesh>
        <mesh position={[0, 0.61, 0]}><boxGeometry args={[0.7, 0.18, 0.62]} /><meshStandardMaterial color="#53727d" metalness={0.6} /></mesh>
      </TwinMachine>
      <TwinMachine scene={scene} id="press">
        <StructuralFrame width={1.78} height={2.05} depth={1.35} color="#536f79" />
        <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.58, 0.58, 0.2, 32]} /><meshStandardMaterial color="#879da1" metalness={0.76} /></mesh>
        <mesh position={[0, 1.12, 0]}><cylinderGeometry args={[0.46, 0.46, 0.32, 32]} /><meshStandardMaterial color="#aebfbd" metalness={0.64} /></mesh>
        <mesh position={[0, 1.42, 0]}><cylinderGeometry args={[0.14, 0.14, 0.36, 20]} /><meshStandardMaterial color="#d3a950" metalness={0.65} /></mesh>
        {Array.from({ length: 10 }, (_, index) => {
          const angle = (index / 10) * Math.PI * 2
          return <mesh key={index} position={[Math.cos(angle) * 0.44, 1.37, Math.sin(angle) * 0.44]}><cylinderGeometry args={[0.045, 0.045, 0.38, 10]} /><meshStandardMaterial color="#d9e0d9" metalness={0.35} /></mesh>
        })}
        <mesh position={[0, 1.93, 0]}><boxGeometry args={[0.75, 0.14, 0.82]} /><meshStandardMaterial color="#6a8288" metalness={0.68} /></mesh>
      </TwinMachine>
      <TwinMachine scene={scene} id="coater">
        <StructuralFrame width={1.8} height={1.9} depth={1.36} />
        <HorizontalDrum position={[0, 1.22, 0]} radius={0.63} length={0.92} color="#9eb1b0" />
        <mesh position={[0, 1.22, 0.52]} rotation={[0, 0, 0.22]}><cylinderGeometry args={[0.64, 0.64, 0.1, 26]} /><meshStandardMaterial color="#718e95" metalness={0.66} /></mesh>
        <mesh position={[0, 1.22, -0.52]} rotation={[0, 0, -0.22]}><cylinderGeometry args={[0.64, 0.64, 0.1, 26]} /><meshStandardMaterial color="#718e95" metalness={0.66} /></mesh>
        <mesh position={[0.52, 2.12, 0]}><cylinderGeometry args={[0.13, 0.13, 0.55, 16]} /><meshStandardMaterial color="#78969b" metalness={0.7} /></mesh>
        <mesh position={[0.52, 2.42, 0]}><boxGeometry args={[0.48, 0.12, 0.42]} /><meshStandardMaterial color="#3f7887" metalness={0.6} /></mesh>
      </TwinMachine>
      <TwinMachine scene={scene} id="inspection">
        <StructuralFrame width={1.88} height={1.58} depth={1.38} color="#4b7480" />
        <mesh position={[0, 0.78, 0]}><boxGeometry args={[1.78, 0.1, 1.2]} /><meshStandardMaterial color="#263f4a" /></mesh>
        {[-0.5, -0.25, 0, 0.25, 0.5].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 0.95, 0]}><cylinderGeometry args={[0.105, 0.105, 0.12, 14]} /><meshStandardMaterial color="#dde2d8" roughness={0.35} /></mesh>
            <mesh position={[0, 1.02, 0]}><cylinderGeometry args={[0.07, 0.07, 0.035, 14]} /><meshStandardMaterial color="#d4a94f" metalness={0.55} /></mesh>
          </group>
        ))}
        <mesh position={[0, 1.7, 0]}><boxGeometry args={[0.72, 0.38, 0.72]} /><meshStandardMaterial color="#577985" metalness={0.5} /></mesh>
        <mesh position={[0, 1.72, 0.38]}><boxGeometry args={[0.48, 0.22, 0.035]} /><meshStandardMaterial color="#55b5c3" emissive="#174e5b" emissiveIntensity={0.4} /></mesh>
        <mesh position={[0.65, 0.38, 0]}><boxGeometry args={[0.46, 0.72, 0.76]} /><meshStandardMaterial color="#b6c1bb" metalness={0.27} /></mesh>
      </TwinMachine>
    </>
  )
}
