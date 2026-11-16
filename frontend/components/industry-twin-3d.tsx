"use client"

import { Canvas } from "@react-three/fiber"
import { Component, type ComponentType, type ReactNode } from "react"
import type { IndustryTwinId } from "@/lib/industry-twin-layouts"
import type { TwinSceneProps } from "@/components/industry-twins/shared"
import { ChemicalProcessScene } from "@/components/industry-twins/chemical-process"
import { FoodBeverageScene } from "@/components/industry-twins/food-beverage"
import { PaperPulpScene } from "@/components/industry-twins/paper-pulp"
import { PharmaceuticalScene } from "@/components/industry-twins/pharmaceutical"
import { SteelMetalsScene } from "@/components/industry-twins/steel-metals"
import { IndustryHall, SceneControls } from "@/components/industry-twins/shared"

const industryScenes: Record<IndustryTwinId, ComponentType<TwinSceneProps>> = {
  paper_pulp: PaperPulpScene,
  steel_metals: SteelMetalsScene,
  chemical_process: ChemicalProcessScene,
  food_beverage: FoodBeverageScene,
  pharmaceutical: PharmaceuticalScene,
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

export function IndustryTwin3D({
  industryId,
  stations,
  selectedId,
  onSelect,
  fallback,
}: TwinSceneProps & {
  industryId: IndustryTwinId
  fallback: ReactNode
}) {
  const Scene = industryScenes[industryId]
  return (
    <div className="factory-twin">
      <div className="industry-twin-canvas-wrap">
        <SceneErrorBoundary fallback={fallback}>
          <Canvas
            frameloop="demand"
            shadows
            camera={{ position: [11, 9.5, 14], fov: 36 }}
            dpr={[1, 1.35]}
            gl={{ antialias: true, powerPreference: "low-power" }}
          >
            <IndustryHall />
            <Scene stations={stations} selectedId={selectedId} onSelect={onSelect} />
            <SceneControls />
          </Canvas>
        </SceneErrorBoundary>
        <span className="factory-view-hint">Drag to orbit · scroll to zoom</span>
      </div>
      <div className="factory-details">
        <div className="factory-station-selector" role="group" aria-label="Select simulated equipment">
          {stations.map((station) => (
            <button
              key={station.id}
              className={station.id === selectedId ? "selected" : ""}
              type="button"
              aria-pressed={station.id === selectedId}
              onClick={() => onSelect(station.id)}
            >
              <i className={`industry-signal-dot ${station.band}`} aria-hidden="true" />
              {station.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
