"use client"

import { useMemo, useState } from "react"
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts"
import { usePlantGuard } from "@/components/app-provider"
import { type ModelMetrics, type RiskKey, type Sensor, toNumber } from "@/lib/plantguard"

const axis = { fill: "var(--text-muted)", fontSize: 11 }
const grid = "var(--chart-grid)"
const tooltipStyle = { background: "var(--surface-raised)", border: "1px solid var(--border-strong)", borderRadius: 10, color: "var(--text)" }

export function SensorTrendChart({ compact = false }: { compact?: boolean }) {
  const { history, industry } = usePlantGuard()
  const [windowSize, setWindowSize] = useState("30")
  const series = useMemo(() => {
    if (!industry || industry.id === "plastic_extrusion") {
      return [
        { key: "temperature_c", label: "Temperature (°C)" },
        { key: "pressure_bar", label: "Pressure (bar)" },
      ]
    }
    return industry.sensors.slice(0, 2).map((sensor) => ({
      key: sensor.key,
      label: `${sensor.label}${sensor.unit ? ` (${sensor.unit})` : ""}`,
    }))
  }, [industry])
  const rows = useMemo(() => history.slice(-Number(windowSize)).map((reading) => ({
    timestamp: typeof reading.timestamp_s === "number" && Number.isFinite(reading.timestamp_s) ? reading.timestamp_s : null,
    ...Object.fromEntries(series.map((item) => [item.key, toNumber(reading[item.key])])),
  })), [history, series, windowSize])
  const timestampedRows = rows.filter((reading) => reading.timestamp !== null)
  const colors = ["#ff9b62", "#6ac8ff"]
  return (
    <section className={`card chart-card ${compact ? "chart-card-compact" : ""}`}>
      <div className="card-heading">
        <div><p className="eyebrow">SIMULATOR HISTORY</p><h2>Process signal trend</h2><p className="heading-subtitle">Actual backend snapshots · simulation time only, not a plant historian</p></div>
        <label className="select-control"><span className="sr-only">Visible sensor samples</span><select value={windowSize} onChange={(event) => setWindowSize(event.target.value)}><option value="30">Last 30</option><option value="60">Last 60</option><option value="90">Last 90</option></select></label>
      </div>
      {timestampedRows.length ? (
        <div className="chart-area">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timestampedRows} margin={{ top: 8, right: 12, bottom: 0, left: -14 }}>
              <CartesianGrid stroke={grid} vertical={false} strokeDasharray="4 5" />
              <XAxis dataKey="timestamp" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(value) => `${Number(value).toFixed(1)}s`} tick={axis} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis yAxisId="left" tick={axis} axisLine={false} tickLine={false} width={42} domain={["auto", "auto"]} />
              {series.length > 1 && <YAxis yAxisId="right" orientation="right" tick={axis} axisLine={false} tickLine={false} width={42} domain={["auto", "auto"]} />}
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => `Simulator time ${Number(value).toFixed(1)} s`} />
              {series.map((item, index) => <Line key={item.key} yAxisId={index === 0 ? "left" : "right"} type="monotone" dataKey={item.key} name={item.label} stroke={colors[index % colors.length]} strokeWidth={2.2} dot={timestampedRows.length === 1 ? { r: 4 } : false} activeDot={{ r: 5 }} isAnimationActive={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : <div className="chart-empty">{history.length ? "Sensor samples are available, but simulator timestamps are missing." : "No simulator samples yet. Reset or advance a scenario to collect a sample."}</div>}
      {timestampedRows.length === 1 && <p className="chart-sample-note">One actual simulator snapshot at {timestampedRows[0].timestamp?.toFixed(1)} s; advance the simulation to build a trend.</p>}
      <div className="chart-legend">{series.map((item, index) => <span key={item.key}><i className={`chart-key ${index === 0 ? "temperature" : "pressure"}`} />{item.label}</span>)}</div>
    </section>
  )
}

export function ThicknessTrendChart() {
  const { history, industry } = usePlantGuard()
  const signal = industry?.id === "plastic_extrusion" || !industry
    ? { key: "thickness_mm", label: "Thickness", unit: "mm" }
    : industry.sensors[2] ?? industry.sensors[0] ?? { key: "", label: "Sensor", unit: "" }
  const rows = history.slice(-36)
    .filter((reading): reading is Sensor & { timestamp_s: number } => typeof reading.timestamp_s === "number" && Number.isFinite(reading.timestamp_s))
    .map((reading) => ({ timestamp: reading.timestamp_s, value: toNumber(reading[signal.key]) }))
  return (
    <section className="card chart-card">
      <div className="card-heading"><div><p className="eyebrow">SIMULATOR OUTPUT</p><h2>{signal.label} signal</h2><p className="heading-subtitle">Actual simulator timestamps · not a historian</p></div><span className="chart-unit">{signal.unit}</span></div>
      {rows.length ? <div className="chart-area chart-area-short"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: -12 }}><CartesianGrid stroke={grid} vertical={false} strokeDasharray="4 5" /><XAxis dataKey="timestamp" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(value) => `${Number(value).toFixed(1)}s`} tick={axis} axisLine={false} tickLine={false} /><YAxis tick={axis} axisLine={false} tickLine={false} width={45} domain={["auto", "auto"]} /><Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => `Simulator time ${Number(value).toFixed(1)} s`} /><Line type="monotone" dataKey="value" name={`${signal.label}${signal.unit ? ` (${signal.unit})` : ""}`} stroke="#9b8cff" strokeWidth={2.3} dot={rows.length === 1 ? { r: 4 } : false} activeDot={{ r: 5 }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div> : <div className="chart-empty">{history.length ? "Sensor samples are available, but simulator timestamps are missing." : "No simulator samples yet. Reset or advance the simulation to collect a sample."}</div>}
      {rows.length === 1 && <p className="chart-sample-note">One actual simulator snapshot at {rows[0].timestamp.toFixed(1)} s; advance the simulation to build a trend.</p>}
    </section>
  )
}

export function RiskDistributionChart({ risk, categories }: { risk: Record<RiskKey, number> | undefined; categories?: Array<{ id: string; label: string }> }) {
  const fallbackCategories = [
    { id: "surface_cracking", label: "Surface cracking" },
    { id: "warping", label: "Warping" },
    { id: "thickness_non_uniformity", label: "Thickness variation" },
  ]
  const rows = risk ? (categories ?? fallbackCategories)
    .filter(({ id }) => typeof risk[id] === "number")
    .map(({ id, label }) => ({ label, value: risk[id] })) : []
  return (
    <section className="card chart-card">
      <div className="card-heading"><div><p className="eyebrow">CURRENT SIMULATED OUTPUT</p><h2>Current defect-risk scores</h2><p className="heading-subtitle">Current rule or model outputs on a 0–1 scale · calibration to probabilities is not established; not a historical trend.</p></div></div>
      {rows.length ? <div className="chart-area chart-area-short"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} layout="vertical" margin={{ top: 6, right: 16, bottom: 0, left: 16 }}><CartesianGrid stroke={grid} horizontal={false} /><XAxis type="number" domain={[0, 1]} tickFormatter={(value) => Number(value).toFixed(1)} tick={axis} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="label" width={112} tick={axis} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [Number(value).toFixed(3), "Model risk score"]} /><Bar dataKey="value" name="Model risk score" fill="#63c7e8" radius={[0, 6, 6, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div> : <div className="chart-empty">Risk data unavailable until the API responds.</div>}
    </section>
  )
}

export function ModelMetricCard({ name, metrics }: { name: string; metrics: ModelMetrics }) {
  return (
    <section className="card model-metric-card">
      <div className="card-heading"><div><p className="eyebrow">{name === "PINN" ? "PHYSICS-PROXY-GUIDED NEURAL NETWORK" : "SEQUENCE BASELINE"}</p><h2>{name}</h2></div><span className="tag tag-info">Synthetic holdout</span></div>
      <div className="metric-pair">
        <div><span>Held-out MAE</span><strong>{metrics.mae.toFixed(4)}</strong></div>
        <div><span>Held-out MSE</span><strong>{metrics.mse.toFixed(4)}</strong></div>
        <div><span>Test observations</span><strong>{metrics.sample_count?.toLocaleString() ?? "Not reported"}</strong></div>
      </div>
      <p className="fine-print">{metrics.scope?.replaceAll("_", " ") ?? "Synthetic simulator holdout"} · raw MAE/MSE values, not accuracy scores · no real-factory validation.</p>
    </section>
  )
}

export function ModelComparisonChart({ pinn, lstm }: { pinn: { mae: number; mse: number }; lstm: { mae: number; mse: number } }) {
  const charts = [
    { title: "Mean absolute error", key: "mae" as const, data: [{ model: "PINN", value: pinn.mae }, { model: "LSTM", value: lstm.mae }] },
    { title: "Mean squared error", key: "mse" as const, data: [{ model: "PINN", value: pinn.mse }, { model: "LSTM", value: lstm.mse }] },
  ]
  return (
    <section className="card model-comparison-card">
      <div className="card-heading"><div><p className="eyebrow">HELD-OUT COMPARISON</p><h2>Prediction error by model</h2><p className="heading-subtitle">Separate scales for MAE and MSE; lower error is preferable within each metric.</p></div></div>
      <div className="model-comparison-grid">
        {charts.map((chart) => (
          <div className="model-comparison-panel" key={chart.key}>
            <h3>{chart.title}</h3>
            <div className="chart-area chart-area-short">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart.data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke={grid} vertical={false} strokeDasharray="4 5" />
                  <XAxis dataKey="model" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis tick={axis} axisLine={false} tickLine={false} width={45} domain={[0, "dataMax"]} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => [Number(value).toFixed(5), chart.title]} />
                  <Bar dataKey="value" name={chart.title} radius={[5, 5, 0, 0]} fill="#63c7e8" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
