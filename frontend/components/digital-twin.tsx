"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useState } from "react"
import { usePlantGuard } from "@/components/app-provider"
import { formatSensorValue, riskBand, toNumber } from "@/lib/plantguard"
import type { FactoryRiskBand, FactoryStation } from "@/components/factory-twin-3d"

const FactoryTwin3D = dynamic(
  () => import("@/components/factory-twin-3d").then((module) => module.FactoryTwin3D),
  { ssr: false, loading: () => null },
)

function stationBand(kind: string, value: number, fallback: FactoryRiskBand): FactoryRiskBand {
  if (kind === "temperature_c") return value >= 100 ? "high" : value >= 90 ? "moderate" : "low"
  if (kind === "cooling_efficiency") return value <= 0.65 ? "high" : value <= 0.78 ? "moderate" : "low"
  if (kind === "vibration_mm_s") return value >= 4 ? "high" : value >= 3 ? "moderate" : "low"
  if (kind === "feed_rate_kg_h") return value >= 950 ? "high" : value >= 900 ? "moderate" : "low"
  if (kind === "thickness_mm") return value >= 2.7 ? "high" : value >= 2.5 ? "moderate" : "low"
  if (kind === "pressure_bar") return value >= 70 ? "high" : value >= 60 ? "moderate" : "low"
  return fallback
}

export function DigitalTwin() {
  const { dashboard } = usePlantGuard()
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null)
  const sensor = dashboard?.simulation.latest_sensor
  const fallback = dashboard ? riskBand(dashboard.risk.overall_risk) : "offline"
  const stations: Omit<FactoryStation, "value" | "band">[] = [
    { id: "feed", label: "Feed system", field: "feed_rate_kg_h", description: "Material feed hopper and metering" as const, position: [-4.25, 0, -1.2] as [number, number, number] },
    { id: "extruder", label: "Extruder", field: "temperature_c", description: "Simulated extrusion barrel and screw" as const, position: [-1.7, 0, -0.65] as [number, number, number] },
    { id: "cooling", label: "Cooling section", field: "cooling_efficiency", description: "Illustrative cooling station" as const, position: [1.2, 0, -0.1] as [number, number, number] },
    { id: "output", label: "Output gauge", field: "vibration_mm_s", description: "Simulated output measurement station" as const, position: [3.8, 0, 0.55] as [number, number, number] },
  ]

  useEffect(() => {
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl")
    setWebglAvailable(Boolean(context))
    context?.getExtension("WEBGL_lose_context")?.loseContext()
  }, [])

  const sceneStations = stations.map((station) => {
    const value = toNumber(sensor?.[station.field])
    return {
      ...station,
      field: station.field,
      value: sensor ? formatSensorValue(station.field, sensor[station.field]) : "Unavailable",
      band: sensor ? stationBand(station.field, value, fallback) : "offline" as const,
    }
  })

  return (
    <section className="card twin-card">
      <div className="card-heading">
        <div><p className="eyebrow">SIMULATED PROCESS TWIN</p><h2>Extrusion factory schematic</h2><p className="heading-subtitle">Interactive illustrative equipment layout · not a facility map or safety system.</p></div>
        <Link className="subtle-link" href="/assets">View process details <span aria-hidden="true">→</span></Link>
      </div>
      {webglAvailable && <FactoryTwin3D stations={sceneStations} />}
      {webglAvailable === false && <div className="twin-svg-fallback"><p className="twin-fallback-message">WebGL is unavailable; showing the accessible SVG process illustration.</p><div className="twin-stage">
        <svg className="twin-svg" viewBox="0 0 920 470" role="img" aria-labelledby="twin-title twin-description">
          <title id="twin-title">Isometric extrusion process illustration</title>
          <desc id="twin-description">A simulated feed system, extruder, cooling section and output gauge with sensor status markers.</desc>
          <defs>
            <linearGradient id="twin-floor" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="var(--twin-floor-a)" /><stop offset="1" stopColor="var(--twin-floor-b)" /></linearGradient>
            <linearGradient id="twin-machine" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--twin-machine-a)" /><stop offset="1" stopColor="var(--twin-machine-b)" /></linearGradient>
            <pattern id="twin-grid" width="32" height="32" patternTransform="skewY(-27) scale(1,.72)" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="var(--twin-grid)" strokeWidth="1" /></pattern>
          </defs>
          <path d="M65 190 459 38 855 194 459 408Z" fill="url(#twin-floor)" stroke="var(--twin-edge)" strokeWidth="2" />
          <path d="M65 190 459 408V447L65 229Z" fill="var(--twin-wall)" stroke="var(--twin-edge)" strokeWidth="2" />
          <path d="M459 408 855 194V235L459 447Z" fill="var(--twin-wall-side)" stroke="var(--twin-edge)" strokeWidth="2" />
          <path d="M65 190 459 38 855 194 459 408Z" fill="url(#twin-grid)" opacity=".8" />
          <path d="M101 193 459 55 818 197M110 215 459 78 808 219M118 237 459 101 798 241" fill="none" stroke="var(--twin-lane)" strokeWidth="2" strokeDasharray="5 6" />
          <path d="M135 182 456 337 768 173" fill="none" stroke="var(--twin-flow)" strokeWidth="3" strokeDasharray="8 8" />
          <path d="m753 169 16 4-11 13" fill="none" stroke="var(--twin-flow)" strokeWidth="3" />

          <g className="twin-machine">
            <path d="m185 185 72-29 66 27-72 31Z" fill="var(--twin-top)" stroke="var(--twin-edge)" />
            <path d="m185 185 66 29v70l-66-31Z" fill="var(--twin-front)" stroke="var(--twin-edge)" />
            <path d="m251 214 72-31v68l-72 33Z" fill="var(--twin-side)" stroke="var(--twin-edge)" />
            <path d="m205 190 52-21 45 19-52 22Z" fill="none" stroke="var(--twin-accent)" strokeWidth="2" />
            <path d="m216 225 24 11v22l-24-11Z" fill="var(--twin-window)" />
            <text x="195" y="306" className="twin-label">FEED SYSTEM</text>
          </g>
          <g className="twin-machine">
            <path d="m324 212 97-40 100 42-96 42Z" fill="var(--twin-top)" stroke="var(--twin-edge)" />
            <path d="m324 212 101 44v68l-101-45Z" fill="var(--twin-front)" stroke="var(--twin-edge)" />
            <path d="m425 256 96-42v68l-96 42Z" fill="var(--twin-side)" stroke="var(--twin-edge)" />
            <path d="m348 220 77 34 71-32" fill="none" stroke="var(--twin-accent)" strokeWidth="7" />
            <path d="m365 277 42 18v12l-42-18Z" fill="var(--twin-window)" />
            <text x="352" y="349" className="twin-label">EXTRUDER</text>
          </g>
          <g className="twin-machine">
            <path d="m536 142 90-36 104 42-91 39Z" fill="var(--twin-top)" stroke="var(--twin-edge)" />
            <path d="m536 142 103 45v72l-103-45Z" fill="var(--twin-front)" stroke="var(--twin-edge)" />
            <path d="m639 187 91-39v71l-91 40Z" fill="var(--twin-side)" stroke="var(--twin-edge)" />
            <path d="m558 151 80 36 71-31" fill="none" stroke="var(--twin-cool)" strokeWidth="5" strokeDasharray="6 5" />
            <path d="M563 169v60m20-51v60m20-51v60" stroke="var(--twin-cool)" strokeWidth="2" opacity=".8" />
            <text x="566" y="277" className="twin-label">COOLING SECTION</text>
          </g>
          <g className="twin-machine">
            <path d="m684 224 54-22 60 25-55 24Z" fill="var(--twin-top)" stroke="var(--twin-edge)" />
            <path d="m684 224 59 27v45l-59-27Z" fill="var(--twin-front)" stroke="var(--twin-edge)" />
            <path d="m743 251 55-24v44l-55 25Z" fill="var(--twin-side)" stroke="var(--twin-edge)" />
            <circle cx="742" cy="236" r="13" fill="var(--twin-window)" stroke="var(--twin-accent)" strokeWidth="2" />
            <text x="683" y="318" className="twin-label">OUTPUT GAUGE</text>
          </g>
          <g fill="none" stroke="var(--twin-pipe)" strokeWidth="4">
            <path d="M173 177 173 132 253 101 253 153" />
            <path d="M520 200 520 126 643 76 643 129" />
            <path d="M795 219 819 207 819 157" />
          </g>
          <g fill="var(--twin-window)" stroke="var(--twin-edge)" strokeWidth="1">
            <path d="m94 192 22-9 24 12-22 10Z" /><path d="m750 302 22-12 25 12-22 13Z" />
          </g>
        </svg>
        {stations.map((station) => {
          const value = toNumber(sensor?.[station.field])
          const band = sensor ? stationBand(station.field, value, fallback) : "offline"
          const formatted = sensor ? formatSensorValue(station.field, sensor[station.field]) : "Unavailable"
          return (
            <Link
              key={station.field}
              href="/assets/extrusion-line"
              className={`twin-marker ${band}`}
              style={{ left: `${24 + stations.indexOf(station) * 17}%`, top: `${61 - stations.indexOf(station) * 6}%` }}
              title={`${station.label}: ${formatted}. Open simulated process details.`}
              aria-label={`${station.label}, ${formatted}, ${band}. Open process details.`}
            >
              <span className="marker-core" /><span className="marker-label">{station.label}<small>{formatted}</small></span>
            </Link>
          )
        })}
      </div>
      </div>}
      {webglAvailable === null && <div className="twin-loading">Checking local WebGL support…</div>}
      <div className="twin-legend">
        <span><i className="legend-dot low" /> Lower simulator signal</span><span><i className="legend-dot moderate" /> Elevated simulator signal</span><span><i className="legend-dot high" /> Higher simulator signal</span><span><i className="legend-dot offline" /> API unavailable</span>
        <span className="legend-caption">Color bands use documented demo signal thresholds only; not alarm thresholds.</span>
      </div>
    </section>
  )
}
