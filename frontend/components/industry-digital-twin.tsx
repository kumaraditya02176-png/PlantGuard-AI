"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import type { IndustryMetadata } from "@/lib/plantguard"
import { formatPercent, formatSensorValue, riskBand } from "@/lib/plantguard"
import { industryTwinLayouts, type IndustryTwinId } from "@/lib/industry-twin-layouts"
import type { TwinStation } from "@/components/industry-twins/shared"
import { usePlantGuard } from "@/components/app-provider"

const IndustryTwin3D = dynamic(
  () => import("@/components/industry-twin-3d").then((module) => module.IndustryTwin3D),
  { ssr: false, loading: () => <div className="twin-loading">Loading industry-specific 3D twin…</div> },
)

function isIndustryTwinId(value: string): value is IndustryTwinId {
  return Object.prototype.hasOwnProperty.call(industryTwinLayouts, value)
}

function apiRiskBand(value: string | undefined): TwinStation["band"] {
  if (value === "low" || value === "moderate" || value === "high") return value
  return "offline"
}

function sensorValue(value: number | string | null | undefined, key: string, unit: string): string {
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
    return "Unavailable"
  }
  return formatSensorValue(key, value, unit)
}

function IndustryTwinFallback({
  stations,
  selectedId,
  onSelect,
}: {
  stations: TwinStation[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const selected = stations.find((station) => station.id === selectedId) ?? stations[0]
  return (
    <div className="industry-twin-fallback">
      <p className="twin-fallback-message">Interactive 3D is unavailable in this browser. Select equipment from the accessible process sequence below.</p>
      <div className="industry-fallback-stations" role="group" aria-label="Select simulated equipment">
        {stations.map((station, index) => (
          <button
            key={station.id}
            className={station.id === selected?.id ? "selected" : ""}
            type="button"
            aria-pressed={station.id === selected?.id}
            onClick={() => onSelect(station.id)}
          >
            <span className={`industry-signal-dot ${station.band}`} aria-hidden="true" />
            <span>{String(index + 1).padStart(2, "0")} · {station.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function IndustryDigitalTwin({ industry }: { industry: IndustryMetadata }) {
  const { dashboard } = usePlantGuard()
  const industryId = isIndustryTwinId(industry.id) ? industry.id : null
  const layout = industryId ? industryTwinLayouts[industryId] : null
  const [selectedId, setSelectedId] = useState(layout?.stations[0]?.id ?? "")
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    setSelectedId(layout?.stations[0]?.id ?? "")
  }, [industry.id])

  useEffect(() => {
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl")
    setWebglAvailable(Boolean(context))
    context?.getExtension("WEBGL_lose_context")?.loseContext()
  }, [])

  const stations = useMemo<TwinStation[]>(() => {
    if (!layout) return []
    const sensorDefinitions = new Map(industry.sensors.map((sensor) => [sensor.key, sensor]))
    const sensor = dashboard?.simulation.latest_sensor
    const band = dashboard ? apiRiskBand(dashboard.risk.risk_band) : "offline"
    return layout.stations.map((station) => ({
      ...station,
      band,
      signals: station.sensorKeys.flatMap((key) => {
        const definition = sensorDefinitions.get(key)
        if (!definition) return []
        return [{
          key,
          label: definition.label,
          unit: definition.unit,
          value: sensorValue(sensor?.[key], key, definition.unit),
        }]
      }),
    }))
  }, [dashboard, industry.sensors, layout])

  const activeStation = stations.find((station) => station.id === selectedId) ?? stations[0]
  const riskCategories = industry.risk_categories.flatMap((category) => {
    const value = dashboard?.risk.risk[category.id]
    return typeof value === "number"
      ? [{ ...category, value }]
      : []
  })

  return (
    <section className="card twin-card industry-twin-card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">SIMULATED PROCESS TWIN</p>
          <h2>{layout?.title ?? `${industry.name} process twin`}</h2>
          <p className="heading-subtitle">{industry.description} · Simulated equipment only; no physical machinery connection.</p>
        </div>
        <span className="tag tag-info">Industry-specific 3D</span>
      </div>
      {!industryId ? (
        <div className="inline-empty" role="status">No 3D equipment layout is configured for this industry.</div>
      ) : webglAvailable === null ? (
        <div className="twin-loading">Checking local WebGL support…</div>
      ) : webglAvailable ? (
        <IndustryTwin3D
          key={industry.id}
          industryId={industryId}
          stations={stations}
          selectedId={activeStation?.id ?? ""}
          onSelect={setSelectedId}
          fallback={<IndustryTwinFallback stations={stations} selectedId={activeStation?.id ?? ""} onSelect={setSelectedId} />}
        />
      ) : (
        <IndustryTwinFallback stations={stations} selectedId={activeStation?.id ?? ""} onSelect={setSelectedId} />
      )}
      {activeStation && (
        <div className="industry-twin-details" aria-live="polite">
          <div className="industry-twin-station-head">
            <div>
              <span className="micro-label">SELECTED SIMULATED EQUIPMENT</span>
              <strong>{activeStation.name}</strong>
              <small>{activeStation.description}</small>
            </div>
            <span className={`tag tag-${activeStation.band}`}>
              {activeStation.band === "offline" ? "Risk unavailable" : `${activeStation.band} overall risk`}
            </span>
          </div>
          <div className="industry-twin-signal-grid">
            {activeStation.signals.length ? activeStation.signals.map((signal) => (
              <div className="industry-twin-signal" key={signal.key}>
                <span>{signal.label}</span>
                <strong>{signal.value}</strong>
              </div>
            )) : <span className="inline-empty">No linked backend sensor is configured for this equipment.</span>}
          </div>
          <div className="industry-twin-risk-list" aria-label="Current simulated risk categories">
            {riskCategories.length
              ? riskCategories.map((risk) => (
                <span className={`tag tag-${riskBand(risk.value)}`} key={risk.id}>
                  {risk.label}: {formatPercent(risk.value)}
                </span>
              ))
              : <span className="micro-label">Risk signals are unavailable until the selected simulator responds.</span>}
          </div>
        </div>
      )}
      <p className="factory-safety-note">Live values and risk bands are read from this industry’s backend simulator. Recommendations remain advisory-only.</p>
    </section>
  )
}
