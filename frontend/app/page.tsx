"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001"

type RiskMap = Record<"surface_cracking" | "warping" | "thickness_non_uniformity", number>
type ModelRisk = RiskMap & { overall_risk: number; risk_band: string; lead_time_estimate_s: number }

type Sensor = Record<string, number | string | null>

type Dashboard = {
  simulation: {
    time_s: number
    active_scenario: { type: string } | null
    latest_sensor: Sensor
    sensor_history?: Sensor[]
    controls: Record<string, number>
  }
  risk: {
    risk: RiskMap
    risk_bands?: Record<keyof RiskMap, string>
    overall_risk: number
    risk_band: string
    lead_time_estimate_s: number
    model_comparison?: {
      primary_model: "pinn"
      lstm_status: "active" | "warming_up"
      lstm_risk: ModelRisk | null
    }
  }
  advisory: {
    defect: string
    severity: string
    risk: number
    overall_risk: number
    recommended_action: string
    reason: string
    target_process_variable: string
    suggested_adjustment: number
    duration_s: number
  }
  correction_result?: {
    simulated: boolean
    defect: string
    target_process_variable: string
    duration_s: number
    before: { sensor_value: number; defect_risk: number; overall_risk: number }
    after: { sensor_value: number; defect_risk: number; overall_risk: number }
  }
  notice: string
}

type MetricsResponse = {
  synthetic_holdout?: boolean
  scope?: string
  label?: string
  pinn: {
    mae: number
    mse: number
    sample_count?: number
    synthetic_holdout?: boolean
    scope?: string
    label?: string
  }
  lstm: {
    mae: number
    mse: number
    sample_count?: number
    synthetic_holdout?: boolean
    scope?: string
    label?: string
  }
}

type RoiEstimate = {
  annual_savings_usd: number
  scrap_reduction_pct: number
  payback_months: number
}

type RoiResponse = {
  illustrative_estimate: RoiEstimate
  disclaimer: string
}

const scenarioOptions = [
  ["normal", "Normal operation"],
  ["overheating", "Overheating"],
  ["uneven_cooling", "Uneven cooling"],
  ["feed_rate_instability", "Feed instability"],
  ["gradual_drift", "Gradual drift"],
  ["sudden_disturbance", "Sudden disturbance"],
] as const

const toNumber = (value: number | string | null | undefined) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const formatPercent = (value: number) => `${Math.round(Math.min(100, Math.max(0, value * 100)))}%`
const formatSeconds = (value: number) => `${Math.round(value)}s`
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function getRiskBand(value: number) {
  if (value < 0.35) return "low"
  if (value < 0.65) return "moderate"
  return "high"
}

function MetricCard({
  title,
  model,
  metrics,
}: {
  title: string
  model: "pinn" | "lstm"
  metrics: MetricsResponse["pinn"]
}) {
  const chartData = [
    { metric: "MAE", value: metrics.mae },
    { metric: "MSE", value: metrics.mse },
  ]

  return (
    <div className="model-card">
      <div className="model-header">
        <div>
          <p className="eyebrow subtle">{model === "pinn" ? "Physics-informed risk network" : "Sensor-only LSTM"}</p>
          <h3>{title}</h3>
        </div>
        <span className="chip">
          {metrics.synthetic_holdout
            ? "Synthetic holdout"
            : metrics.label ?? "Evaluation scope unavailable"}
        </span>
      </div>

      <div className="mini-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.12)" />
            <XAxis dataKey="metric" tick={{ fill: "#9bb4c8", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: "#09141d",
                border: "1px solid rgba(94,234,212,0.25)",
                borderRadius: 12,
                color: "#edf6ff",
              }}
            />
            <Bar dataKey="value" fill={model === "pinn" ? "#5dd6a6" : "#79b7ff"} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="metric-grid">
        <div>
          <span className="metric-label">Held-out MAE</span>
          <strong>{metrics.mae.toFixed(3)}</strong>
        </div>
        <div>
          <span className="metric-label">Held-out MSE</span>
          <strong>{metrics.mse.toFixed(3)}</strong>
        </div>
        <div>
          <span className="metric-label">Held-out observations</span>
          <strong>{metrics.sample_count?.toLocaleString() ?? "—"}</strong>
        </div>
      </div>

      <div className="metrics-meta">
        <span>{metrics.scope?.replaceAll("_", " ") ?? metrics.label ?? "Evaluation scope unavailable"}</span>
      </div>
    </div>
  )
}

export default function Home() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [history, setHistory] = useState<Sensor[]>([])
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null)
  const [roiResult, setRoiResult] = useState<RoiEstimate | null>(null)
  const [correctionResult, setCorrectionResult] = useState<Dashboard["correction_result"] | null>(null)
  const [selectedScenario, setSelectedScenario] = useState("normal")
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState("Loading live data…")
  const commandInProgress = useRef(false)
  const requestVersion = useRef(0)

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail ?? `Request failed: ${res.status}`)
    }
    return (await res.json()) as T
  }

  async function refresh() {
    if (commandInProgress.current) return
    const version = ++requestVersion.current
    try {
      const [dash, hist, modelMetrics] = await Promise.all([
        request<Dashboard>("/api/v1/dashboard"),
        request<{ readings: Sensor[] }>("/api/v1/sensors/history?limit=90"),
        request<MetricsResponse>("/api/v1/metrics"),
      ])
      if (version !== requestVersion.current || commandInProgress.current) return

      setDashboard(dash)
      setHistory(dash.simulation.sensor_history ?? hist.readings)
      setMetrics(modelMetrics)
      setSelectedScenario(dash.simulation.active_scenario?.type ?? "normal")
      setMessage("Live data loaded")

      const roi = await request<RoiResponse>("/api/v1/roi")
      if (version !== requestVersion.current || commandInProgress.current) return
      setRoiResult(roi.illustrative_estimate)
    } catch (e: any) {
      if (version === requestVersion.current && !commandInProgress.current) {
        setMessage(e?.message ?? "Failed to load data")
      }
    }
  }

  useEffect(() => {
    void refresh()
    const id = setInterval(() => void refresh(), 5000)
    return () => clearInterval(id)
  }, [])

  async function command(key: string, path: string, body?: object) {
    if (commandInProgress.current) return
    commandInProgress.current = true
    const version = ++requestVersion.current
    setBusy(key)
    try {
      const dash = await request<Dashboard>(path, { method: "POST", body: JSON.stringify(body ?? {}) })
      const hist = await request<{ readings: Sensor[] }>("/api/v1/sensors/history?limit=90")
      if (version !== requestVersion.current) return
      setDashboard(dash)
      setHistory(dash.simulation.sensor_history ?? hist.readings)
      setSelectedScenario(dash.simulation.active_scenario?.type ?? "normal")
      if (key.startsWith("scenario-")) setCorrectionResult(null)
      if (key === "apply") setCorrectionResult(dash.correction_result ?? null)
      setMessage("Command applied")
      const latestRoi = await request<RoiResponse>("/api/v1/roi")
      if (version !== requestVersion.current) return
      setRoiResult(latestRoi.illustrative_estimate)
    } catch (e: any) {
      if (version === requestVersion.current) setMessage(e?.message ?? "Command failed")
    } finally {
      if (version === requestVersion.current) {
        commandInProgress.current = false
        setBusy(null)
      }
    }
  }

  async function handleScenarioSelect(scenario: string) {
    await command(`scenario-${scenario}`, "/api/v1/simulation/reset", { scenario })
  }

  async function handleAdvanceSimulation() {
    await command("advance", "/api/v1/simulation/advance", { dt: 1.0, steps: 2 })
  }

  async function handleApplyAdvice() {
    await command("apply", "/api/v1/advisories/apply")
  }

  const chartData = useMemo(
    () =>
      history.map((entry, index) => ({
        time: index,
        temperature: toNumber(entry.temperature_c),
        pressure: toNumber(entry.pressure_bar),
        thickness: toNumber(entry.thickness_mm),
        vibration: toNumber(entry.vibration_mm_s),
      })),
    [history]
  )

  const risk = dashboard?.risk
  const sensor = dashboard?.simulation.latest_sensor
  const advisory = dashboard?.advisory
  const riskBand = risk?.risk_band ?? "connecting"
  const riskValue = risk?.overall_risk ?? 0
  const currentDefect = advisory?.defect
    ? advisory.defect.replace("_", " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    : "Monitoring"
  const recommendedAction = advisory?.recommended_action ?? "Monitor process conditions"
  const advisoryReason = advisory?.reason ?? "No defect signal detected."
  const riskCards = [
    { key: "surface_cracking", label: "Surface cracking", value: risk?.risk.surface_cracking ?? 0, band: risk?.risk_bands?.surface_cracking },
    { key: "warping", label: "Warping", value: risk?.risk.warping ?? 0, band: risk?.risk_bands?.warping },
    { key: "thickness_non_uniformity", label: "Thickness variation", value: risk?.risk.thickness_non_uniformity ?? 0, band: risk?.risk_bands?.thickness_non_uniformity },
  ]

  const roiFormDefaults = {
    annual_throughput_kg: "1200000",
    current_scrap_rate_pct: "3.2",
    assumed_scrap_reduction_pct: "28",
    material_cost_per_kg: "3.2",
    annual_operating_cost: "260000",
  }

  function calculateIllustrativeEstimate(form: FormEvent<HTMLFormElement>) {
    form.preventDefault()
    const formData = new FormData(form.currentTarget)
    const throughput = Number(formData.get("annual_throughput_kg") ?? 0)
    const scrapRate = Number(formData.get("current_scrap_rate_pct") ?? 0) / 100
    const reduction = Number(formData.get("assumed_scrap_reduction_pct") ?? 0) / 100
    const materialCost = Number(formData.get("material_cost_per_kg") ?? 0)
    const operatingCost = Number(formData.get("annual_operating_cost") ?? 0)

    const annualSavings = throughput * materialCost * scrapRate * reduction
    const scrapReductionPct = clamp((reduction * 100) * 1.25, 0, 100)
    const paybackMonths = clamp(18 - reduction * 12, 6, 18)

    setRoiResult({
      annual_savings_usd: annualSavings,
      scrap_reduction_pct: scrapReductionPct,
      payback_months: paybackMonths,
    })
  }

  function exportCsv() {
    if (!history.length) return

    const rows = [
      [
        "timestamp_s",
        "temperature_c",
        "pressure_bar",
        "screw_speed_rpm",
        "feed_rate_kg_h",
        "vibration_mm_s",
        "viscosity_pa_s",
        "thickness_mm",
        "line_speed_m_min",
        "cooling_efficiency",
      ],
      ...history.map((reading) => [
        reading.timestamp_s ?? "",
        reading.temperature_c ?? "",
        reading.pressure_bar ?? "",
        reading.screw_speed_rpm ?? "",
        reading.feed_rate_kg_h ?? "",
        reading.vibration_mm_s ?? "",
        reading.viscosity_pa_s ?? "",
        reading.thickness_mm ?? "",
        reading.line_speed_m_min ?? "",
        reading.cooling_efficiency ?? "",
      ]),
    ]

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "plantguard-sensor-stream.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar panel">
        <div className="brand-wrap">
          <div className="brand-mark">PG</div>
          <div className="brand-text">
            <span>PlantGuard</span>
            <em>AI</em>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Dashboard sections">
          <a href="#monitor">Monitor</a>
          <a href="#advisory">Advisory</a>
          <a href="#lab">Simulation Lab</a>
          <a href="#roi">ROI</a>
        </nav>

        <div className="status-cluster">
          <div className={`connection-indicator ${riskBand}`}>
            <span className="dot" />
            {riskBand === "connecting" ? "Connecting" : "Online"}
          </div>
          <div className={`risk-badge ${riskBand}`}>
            {risk ? `${Math.round(risk.overall_risk * 100)}% risk` : "System status"}
          </div>
        </div>
      </header>

      <section className="hero panel">
        <div className="hero-copy-block">
          <p className="eyebrow">Continuous manufacturing / extrusion demo</p>
          <h1>See process risk before it becomes scrap.</h1>
          <p className="hero-copy">
            A physics-aware digital twin turns simulated sensor drift into transparent quality risk and advisory-only corrections.
          </p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={() => void handleScenarioSelect("sudden_disturbance")}>
              Run defect simulation
            </button>
            <button className="secondary-btn" onClick={() => void refresh()}>
              Refresh live state
            </button>
          </div>
        </div>

        <div className="hero-metric">
          <div className="micro-label">Current overall risk</div>
          <div className={`big-number ${riskBand}`}>{risk ? formatPercent(risk.overall_risk) : "--"}</div>
          <div className="hero-metric-row">
            <span>Estimated lead time</span>
            <strong>{risk ? formatSeconds(risk.lead_time_estimate_s) : "--"}</strong>
          </div>
          <div className="hero-metric-row">
            <span>Risk status</span>
            <strong>{risk ? riskBand.toUpperCase() : "CONNECTING"}</strong>
          </div>
        </div>
      </section>

      <section className="notice-banner" aria-live="polite">
        <span className="notice-tag">SIMULATION ONLY</span>
        <p>Simulation/advisory only. PlantGuard AI does not control real machinery. A qualified operator must validate any process change.</p>
      </section>

      <section className="panel monitor-panel" id="monitor">
        <div className="section-header">
          <div>
            <p className="eyebrow">Live process monitor</p>
            <h2>Operational status</h2>
          </div>
          <span className="section-pill">Active scenario: {dashboard?.simulation.active_scenario?.type ?? selectedScenario}</span>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card">
            <span className="kpi-label">Temperature</span>
            <strong>{sensor ? `${toNumber(sensor.temperature_c).toFixed(1)}°C` : "--"}</strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Pressure</span>
            <strong>{sensor ? `${toNumber(sensor.pressure_bar).toFixed(1)} bar` : "--"}</strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Thickness</span>
            <strong>{sensor ? `${toNumber(sensor.thickness_mm).toFixed(3)} mm` : "--"}</strong>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Vibration</span>
            <strong>{sensor ? `${toNumber(sensor.vibration_mm_s).toFixed(2)} mm/s` : "--"}</strong>
          </div>
        </div>

        <div className="chart-wrap large-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <defs>
                <linearGradient id="tempArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#ff8d5c" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#ff8d5c" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="pressureArea" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#5dd6a6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#5dd6a6" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fill: "#9bb4c8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#9bb4c8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "#08151f",
                  border: "1px solid rgba(94,234,212,0.2)",
                  borderRadius: 12,
                  color: "#edf6ff",
                }}
              />
              <Line type="monotone" dataKey="temperature" stroke="#ff8d5c" strokeWidth={2.5} dot={false} name="Temperature" />
              <Line type="monotone" dataKey="pressure" stroke="#5dd6a6" strokeWidth={2.5} dot={false} name="Pressure" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel risk-panel" id="risk">
        <div className="section-header">
          <div>
            <p className="eyebrow">Physics-informed risk</p>
            <h2>Defect prediction</h2>
          </div>
        </div>

        <div className="risk-grid">
          {riskCards.map((riskCard) => (
            <div key={riskCard.key} className="risk-card">
              <div className="risk-card-head">
                <span>{riskCard.label}</span>
                <strong>{formatPercent(riskCard.value)}</strong>
              </div>
              <div className="progress-bar">
                <span style={{ width: `${Math.round(riskCard.value * 100)}%`, background: (riskCard.band ?? getRiskBand(riskCard.value)) === "high" ? "linear-gradient(90deg, #ff7b6b, #ffb26b)" : (riskCard.band ?? getRiskBand(riskCard.value)) === "moderate" ? "linear-gradient(90deg, #fbbf24, #f59e0b)" : "linear-gradient(90deg, #34d399, #2dd4bf)" }} />
              </div>
              <div className={`risk-tag ${riskCard.band ?? getRiskBand(riskCard.value)}`}>
                {riskCard.band ?? getRiskBand(riskCard.value)}
              </div>
            </div>
          ))}
        </div>

        <div className="lead-window">
          <div className="lead-stats">
            <span>Estimated visibility window</span>
            <strong>{risk ? formatSeconds(risk.lead_time_estimate_s) : "--"}</strong>
          </div>
          <p>Simulation-derived estimate. Real lead time requires plant validation.</p>
        </div>
      </section>

      <section className="panel advisory-panel" id="advisory">
        <div className="section-header">
          <div>
            <p className="eyebrow">Advisory Center</p>
            <h2>Specific simulated correction</h2>
          </div>
        </div>

        <div className="advisory-layout">
          <div className="advisory-main">
            <div className="defect-title-row">
              <span className="eyebrow subtle">Current defect</span>
              <h3>{currentDefect}</h3>
            </div>

            <div className="advisory-stats">
              <div>
                <span>Defect-specific risk</span>
                <strong>{advisory ? formatPercent(advisory.risk ?? riskValue) : "--"}</strong>
              </div>
              <div>
                <span>Defect-risk severity</span>
                <strong>{(advisory?.severity ?? getRiskBand(riskValue)).toUpperCase()}</strong>
              </div>
            </div>

            <div className="action-box">
              <span>Recommended action</span>
              <strong>{recommendedAction}</strong>
            </div>

            <p className="advisory-reason">{advisoryReason}</p>
          </div>

          <aside className="recommendation-card">
            <div className="recommendation-row">
              <span>Extruder</span>
              <strong>{advisory ? `Increase screw speed by ${advisory.target_process_variable === "temperature_c" ? "3%" : "2%"}` : "Monitoring"}</strong>
            </div>
            <div className="recommendation-row">
              <span>Feeder</span>
              <strong>{advisory ? "Enable secondary feeder support" : "Stable"}</strong>
            </div>
            <div className="recommendation-row">
              <span>Suggested duration</span>
              <strong>{advisory ? `${advisory.duration_s ?? 45}s` : "45s"}</strong>
            </div>
            <button className="primary-btn" onClick={() => void handleApplyAdvice()} disabled={busy !== null}>
              {busy === "apply" ? "Applying…" : "Simulate correction"}
            </button>
          </aside>
        </div>
        {correctionResult && (
          <div className="lead-window" aria-live="polite">
            <div className="section-header">
              <div>
                <p className="eyebrow">Simulated correction result</p>
                <h3>{correctionResult.defect.replaceAll("_", " ")} · {correctionResult.target_process_variable.replaceAll("_", " ")}</h3>
              </div>
              <span className="section-pill">Finite duration: {correctionResult.duration_s}s</span>
            </div>
            <div className="advisory-stats">
              <div>
                <span>Sensor reading</span>
                <strong>{correctionResult.before.sensor_value.toFixed(2)} → {correctionResult.after.sensor_value.toFixed(2)}</strong>
              </div>
              <div>
                <span>Target defect risk</span>
                <strong>{formatPercent(correctionResult.before.defect_risk)} → {formatPercent(correctionResult.after.defect_risk)}</strong>
              </div>
              <div>
                <span>Overall risk</span>
                <strong>{formatPercent(correctionResult.before.overall_risk)} → {formatPercent(correctionResult.after.overall_risk)}</strong>
              </div>
            </div>
            <p className="advisory-reason">Immediate simulated response only; scenario dynamics continue. Total risk is not guaranteed to improve. No real equipment is controlled.</p>
          </div>
        )}
      </section>

      <section className="panel lab-panel" id="lab">
        <div className="section-header">
          <div>
            <p className="eyebrow">Simulation Lab</p>
            <h2>Test a defect response</h2>
          </div>
        </div>

        <p className="section-copy">Select a realistic failure mode, watch the sensor trace, then apply the advisory to the twin.</p>

        <div className="scenario-grid">
          {scenarioOptions.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`scenario-card ${selectedScenario === key ? "selected" : ""}`}
              onClick={() => void handleScenarioSelect(key)}
              disabled={busy !== null}
              aria-pressed={selectedScenario === key}
            >
              <span>{label}</span>
              <small>{key === "normal" ? "Baseline" : "Defect mode"}</small>
            </button>
          ))}
        </div>

        <div className="lab-footer">
          <button className="primary-btn" onClick={() => void handleAdvanceSimulation()} disabled={busy !== null}>
            {busy === "advance" ? "Advancing…" : "Advance simulation"}
          </button>
          <p>All buttons update a contained mathematical simulation. No real-world machinery is connected.</p>
        </div>
      </section>

      <section className="panel metrics-panel" id="metrics">
        <div className="section-header">
          <div>
            <p className="eyebrow">Model Evaluation</p>
            <h2>Synthetic simulator holdout</h2>
          </div>
        </div>

        <div className="model-grid">
          {metrics ? (
            <>
              <MetricCard title="Sensor-only LSTM" model="lstm" metrics={metrics.lstm} />
              <MetricCard title="Physics-informed risk network" model="pinn" metrics={metrics.pinn} />
            </>
          ) : (
            <div className="loading-card">Loading model metrics…</div>
          )}
        </div>
        {dashboard?.risk.model_comparison && (
          <div className="metrics-meta">
            <span>
              PINN drives dashboard and advisory risk. LSTM is a separate live comparator: {dashboard.risk.model_comparison.lstm_status === "active"
                ? `${formatPercent(dashboard.risk.model_comparison.lstm_risk?.overall_risk ?? 0)} overall risk`
                : "warming up until eight readings are available"}
            </span>
          </div>
        )}
      </section>

      <section className="panel roi-panel" id="roi">
        <div className="section-header">
          <div>
            <p className="eyebrow">Illustrative ROI calculator</p>
            <h2>Use your own assumptions</h2>
          </div>
        </div>

        <div className="roi-layout">
          <form className="roi-form" onSubmit={calculateIllustrativeEstimate}>
            <div className="field-grid">
              <label>
                Annual throughput (kg)
                <input name="annual_throughput_kg" defaultValue={roiFormDefaults.annual_throughput_kg} />
              </label>
              <label>
                Current scrap rate (%)
                <input name="current_scrap_rate_pct" defaultValue={roiFormDefaults.current_scrap_rate_pct} />
              </label>
              <label>
                Assumed scrap reduction (%)
                <input name="assumed_scrap_reduction_pct" defaultValue={roiFormDefaults.assumed_scrap_reduction_pct} />
              </label>
              <label>
                Material cost per kg
                <input name="material_cost_per_kg" defaultValue={roiFormDefaults.material_cost_per_kg} />
              </label>
              <label>
                Annual operating cost
                <input name="annual_operating_cost" defaultValue={roiFormDefaults.annual_operating_cost} />
              </label>
            </div>
            <button className="primary-btn" type="submit">Calculate estimate</button>
          </form>

          <div className="roi-result">
            <span className="mini-label">Illustrative estimate</span>
            <div className="roi-metric">
              <span>Annual savings</span>
              <strong>
                {roiResult ? `$${roiResult.annual_savings_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "$0"}
              </strong>
            </div>
            <div className="roi-metric">
              <span>Scrap reduction</span>
              <strong>{roiResult ? `${roiResult.scrap_reduction_pct.toFixed(1)}%` : "0%"}</strong>
            </div>
            <div className="roi-metric">
              <span>Payback</span>
              <strong>{roiResult ? `${roiResult.payback_months.toFixed(1)} months` : "0 months"}</strong>
            </div>
            <p>Outputs are estimates, never promised savings.</p>
          </div>
        </div>
      </section>

      <section className="panel reports-panel" id="reports">
        <div className="section-header">
          <div>
            <p className="eyebrow">Reports and system health</p>
            <h2>Operational summary</h2>
          </div>
        </div>

        <div className="report-grid">
          <div className="report-card">
            <span className="mini-label">System status</span>
            <h3>{risk ? riskBand.toUpperCase() : "CONNECTING"}</h3>
            <ul>
              <li>Simulation mode: {dashboard?.notice ? "enabled" : "pending"}</li>
              <li>Backend API: {API}</li>
              <li>Signal freshness: {message}</li>
            </ul>
          </div>

          <div className="report-card action-card">
            <span className="mini-label">Actions</span>
            <button className="secondary-btn" type="button" onClick={exportCsv}>Export sensor CSV</button>
            <a href={`${API}/docs`} target="_blank" rel="noreferrer" className="api-link">
              Open API docs
            </a>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="brand-wrap footer-brand">
          <div className="brand-mark">PG</div>
          <div className="brand-text">
            <span>PlantGuard</span>
            <em>AI</em>
          </div>
        </div>

        <p>Physics-aware quality intelligence for continuous manufacturing.</p>
        <small>Demo data only.</small>
      </footer>
    </main>
  )
}
