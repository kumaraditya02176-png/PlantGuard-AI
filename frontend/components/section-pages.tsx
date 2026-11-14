"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"
import {
  CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { usePlantGuard } from "@/components/app-provider"
import { useTheme } from "@/components/app-shell"
import { DigitalTwin } from "@/components/digital-twin"
import { ModelComparisonChart, ModelMetricCard, RiskDistributionChart, SensorTrendChart, ThicknessTrendChart } from "@/components/data-charts"
import { Icon } from "@/components/icon"
import {
  formatAdjustment, formatPercent, formatSensorValue, getApiBaseUrl, riskBand,
  scenarioOptions, titleCase, toNumber, type RoiEstimate, type RiskKey,
} from "@/lib/plantguard"

const riskLabels: Record<RiskKey, string> = {
  surface_cracking: "Surface cracking",
  warping: "Warping",
  thickness_non_uniformity: "Thickness variation",
}

const sensorDefinitions = [
  ["temperature_c", "Temperature", "°C"],
  ["pressure_bar", "Melt pressure", "bar"],
  ["screw_speed_rpm", "Screw speed", "rpm"],
  ["feed_rate_kg_h", "Feed rate", "kg/h"],
  ["vibration_mm_s", "Vibration", "mm/s"],
  ["viscosity_pa_s", "Viscosity", "Pa·s"],
  ["thickness_mm", "Output thickness", "mm"],
  ["line_speed_m_min", "Line speed", "m/min"],
  ["cooling_efficiency", "Cooling efficiency", "%"],
] as const

function PageIntro({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="page-intro"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{copy}</p></div>{action && <div className="page-intro-action">{action}</div>}</div>
}

function PanelTitle({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: React.ReactNode }) {
  return <div className="card-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{aside}</div>
}

function RiskCard({ label, value }: { label: string; value: number }) {
  const band = riskBand(value)
  return (
    <article className="risk-tile">
      <div className="risk-tile-top"><span>{label}</span><strong>{formatPercent(value)}</strong></div>
      <div className="risk-meter"><span className={band} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} /></div>
      <span className={`tag tag-${band}`}>{band} estimate</span>
    </article>
  )
}

function StatusTag({ label, status }: { label: string; status: string }) {
  return <span className={`tag tag-${status}`}>{label}</span>
}

function SensorValueCards({ compact = false }: { compact?: boolean }) {
  const { dashboard } = usePlantGuard()
  const sensor = dashboard?.simulation.latest_sensor
  const rows = compact ? sensorDefinitions.slice(0, 4) : sensorDefinitions
  return (
    <div className={`sensor-kpi-grid ${compact ? "sensor-kpi-grid-compact" : ""}`}>
      {rows.map(([key, label]) => (
        <article className="sensor-kpi" key={key}>
          <div className="sensor-kpi-head"><span>{label}</span><span className={`sensor-health ${sensor ? "connected" : "disconnected"}`} /></div>
          <strong>{sensor ? formatSensorValue(key, sensor[key]) : "—"}</strong>
          <small>{sensor ? "Simulated sensor" : "Waiting for API"}</small>
        </article>
      ))}
    </div>
  )
}

export function OverviewPage() {
  const { dashboard, online, metrics } = usePlantGuard()
  const risk = dashboard?.risk
  const total = risk?.overall_risk
  return (
    <>
      <PageIntro eyebrow="PLANT OPERATIONS / SIMULATION" title="Quality intelligence, at a glance." copy="Physics-aware process monitoring for continuous extrusion. All readings and risk estimates on this workspace are simulated." action={<Link className="button button-primary" href="/simulation"><Icon name="simulation" /> Open simulation lab</Link>} />
      <div className="overview-kpis">
        <article className="kpi-card kpi-featured"><div className="kpi-heading"><span>Overall defect risk</span><span className={`kpi-icon ${risk ? riskBand(risk.overall_risk) : ""}`}><Icon name="activity" /></span></div><strong>{total === undefined ? "—" : formatPercent(total)}</strong><div className="kpi-foot"><StatusTag label={risk?.risk_band ?? "Waiting"} status={risk ? riskBand(risk.overall_risk) : "offline"} /><span>Current model estimate</span></div></article>
        <article className="kpi-card"><div className="kpi-heading"><span>Process state</span><span className="kpi-icon blue"><Icon name="simulation" /></span></div><strong className="kpi-text">{dashboard?.simulation.active_scenario ? titleCase(dashboard.simulation.active_scenario.type) : "Connecting"}</strong><div className="kpi-foot"><span>Digital twin scenario</span><span className="kpi-value-note">SIMULATED</span></div></article>
        <article className="kpi-card"><div className="kpi-heading"><span>Model visibility estimate</span><span className="kpi-icon violet"><Icon name="analytics" /></span></div><strong>{risk ? `${Math.round(risk.lead_time_estimate_s)}s` : "—"}</strong><div className="kpi-foot"><span>Heuristic estimate, not measured lead time</span></div></article>
        <article className="kpi-card"><div className="kpi-heading"><span>Backend connection</span><span className={`kpi-icon ${online ? "green" : "red"}`}><Icon name="integrations" /></span></div><strong className="kpi-text">{online ? "Connected" : "Unavailable"}</strong><div className="kpi-foot"><span>{metrics ? "PINN / LSTM metrics loaded" : "Model metrics pending"}</span><span className={`status-dot ${online ? "online" : "offline"}`} /></div></article>
      </div>

      <div className="overview-main-grid">
        <DigitalTwin />
        <section className="card overview-risk-card">
          <PanelTitle eyebrow="MODEL SIGNAL" title="Current defect risk" aside={<Link className="subtle-link" href="/analytics">Details <span aria-hidden="true">→</span></Link>} />
          <div className="risk-list">
            {risk ? Object.entries(riskLabels).map(([key, label]) => <RiskCard key={key} label={label} value={risk.risk[key as RiskKey]} />) : <div className="inline-empty">Risk outputs appear when the API connects.</div>}
          </div>
          <div className="lead-time-callout"><span className="lead-time-icon"><Icon name="activity" /></span><span><strong>Estimated visibility window</strong><small>Simulator-derived estimate; requires empirical validation.</small></span><b>{risk ? `${Math.round(risk.lead_time_estimate_s)}s` : "—"}</b></div>
        </section>
      </div>

      <div className="dashboard-two-column">
        <SensorTrendChart compact />
        <section className="card current-advisory-card">
          <PanelTitle eyebrow="ADVISORY ENGINE" title="Current model guidance" aside={<Link className="subtle-link" href="/advisory">Open advisory <span aria-hidden="true">→</span></Link>} />
          {dashboard ? (
            <div className="advisory-summary">
              <div className="advisory-summary-head"><span className={`signal-icon ${riskBand(dashboard.advisory.risk)}`}><Icon name="advisory" /></span><div><span className="micro-label">Current signal</span><h3>{titleCase(dashboard.advisory.defect)}</h3></div><StatusTag label={dashboard.advisory.severity} status={riskBand(dashboard.advisory.risk)} /></div>
              <p>{dashboard.advisory.recommended_action}</p>
              <div className="advisory-summary-meta"><span>Suggested adjustment <strong>{formatAdjustment(dashboard.advisory)}</strong></span><span>Duration <strong>{dashboard.advisory.duration_s}s</strong></span></div>
              <Link className="button button-secondary button-full" href="/advisory">Review simulated recommendation <Icon name="arrow" /></Link>
            </div>
          ) : <div className="inline-empty">Waiting for the backend advisory.</div>}
        </section>
      </div>

      <div className="dashboard-two-column">
        <RiskDistributionChart risk={risk?.risk} />
        <section className="card workflow-summary-card">
          <PanelTitle eyebrow="OPERATOR-LED PROCESS" title="Decision workflow" aside={<Link className="subtle-link" href="/workflows">View overview <span aria-hidden="true">→</span></Link>} />
          <div className="workflow-steps">
            <div className="workflow-step complete"><span>01</span><div><strong>Sensor sample</strong><small>Simulator state received</small></div><i /></div>
            <div className="workflow-step complete"><span>02</span><div><strong>Risk evaluation</strong><small>{risk ? `Current risk: ${formatPercent(risk.overall_risk)}` : "Awaiting model output"}</small></div><i /></div>
            <div className="workflow-step current"><span>03</span><div><strong>Operator review</strong><small>Manual review required before action</small></div><i /></div>
            <div className="workflow-step unavailable"><span>04</span><div><strong>External automation</strong><small>Not connected or implemented</small></div></div>
          </div>
        </section>
      </div>
      <div className="simulation-disclaimer"><span className="simulation-pulse" /><div><strong>Simulation environment</strong><p>Data is generated by a local mathematical twin. Recommendations are advisory-only and never actuate equipment.</p></div><Link href="/simulation">Explore scenarios <span aria-hidden="true">→</span></Link></div>
    </>
  )
}

export function AssetsPage() {
  const { dashboard } = usePlantGuard()
  const sensor = dashboard?.simulation.latest_sensor
  const [stationSearch, setStationSearch] = useState("")
  const stations = [
    ["Feed system", "feed_rate_kg_h", "Material input", "Feed rate / pressure"],
    ["Extrusion zone", "temperature_c", "Melt processing", "Temperature / vibration"],
    ["Cooling section", "cooling_efficiency", "Thermal stabilization", "Cooling efficiency"],
    ["Output gauge", "thickness_mm", "Product measurement", "Thickness / line speed"],
  ]
  const visibleStations = stations.filter((station) => station.join(" ").toLowerCase().includes(stationSearch.toLowerCase()))
  return (
    <>
      <PageIntro eyebrow="SIMULATED PROCESS / EQUIPMENT VIEW" title="Plant & assets" copy="The current backend models one extrusion process. Equipment stations below describe that simulator only; no physical asset registry is connected." action={<span className="tag tag-info">1 simulated process</span>} />
      <section className="card"><PanelTitle eyebrow="SIMULATOR PROCESS" title="Extrusion line · demonstration asset" aside={<StatusTag label={sensor ? "Telemetry available" : "Waiting for API"} status={sensor ? "low" : "offline"} />} />
        <div className="asset-list-row"><span className="asset-avatar"><Icon name="assets" /></span><span className="asset-primary"><strong>Simulated extrusion process</strong><small>Local digital twin · scenario: {dashboard?.simulation.active_scenario?.type ?? "unavailable"}</small></span><span className="asset-readout"><small>Overall risk</small><strong>{dashboard ? formatPercent(dashboard.risk.overall_risk) : "—"}</strong></span><Link className="button button-secondary" href="/assets/extrusion-line">Open process detail <Icon name="arrow" /></Link></div>
      </section>
      <div className="section-heading-row"><div><p className="eyebrow">PROCESS STATIONS</p><h2>Sensor-linked equipment areas</h2></div><label className="search-field"><Icon name="search" /><input value={stationSearch} onChange={(event) => setStationSearch(event.target.value)} aria-label="Search simulated process stations" placeholder="Filter stations" /></label></div>
      <div className="asset-station-grid">
        {visibleStations.map(([label, key, description, details]) => (
          <Link className="card asset-station-card" href="/assets/extrusion-line" key={key}>
            <span className="station-card-top"><span className="station-icon"><Icon name="assets" /></span><StatusTag label={sensor ? "Simulated" : "Unavailable"} status={sensor ? "info" : "offline"} /></span>
            <h3>{label}</h3><p>{description}</p><div className="station-value"><span>{sensor ? formatSensorValue(key, sensor[key]) : "—"}</span><small>{details}</small></div>
          </Link>
        ))}
        {!visibleStations.length && <div className="card inline-empty">No simulated process stations match this filter.</div>}
      </div>
      <section className="card"><PanelTitle eyebrow="DATA BOUNDARY" title="What this asset view does not represent" /><div className="notice-list"><p>No physical plant, asset count, machine ID, maintenance history, or historical incidents are present in the backend.</p><p>Station markers use current simulator sensors and are not linked to PLCs or industrial control systems.</p></div></section>
    </>
  )
}

export function AssetDetailPage({ assetId }: { assetId: string }) {
  const { dashboard } = usePlantGuard()
  if (assetId !== "extrusion-line") return <PageIntro eyebrow="ASSET DETAIL" title="Asset unavailable" copy="This identifier does not refer to an asset exposed by the simulator." action={<Link className="button button-secondary" href="/assets">Return to assets</Link>} />
  const sensor = dashboard?.simulation.latest_sensor
  return (
    <>
      <PageIntro eyebrow="SIMULATOR ASSET DETAIL" title="Simulated extrusion process" copy="A single in-memory process state from the local digital twin. No industrial asset connection is configured." action={<Link className="button button-secondary" href="/simulation">Open simulation <Icon name="arrow" /></Link>} />
      <div className="overview-kpis detail-kpis"><article className="kpi-card"><div className="kpi-heading"><span>Active scenario</span><span className="kpi-icon blue"><Icon name="simulation" /></span></div><strong className="kpi-text">{dashboard ? titleCase(dashboard.simulation.active_scenario?.type ?? "unknown") : "—"}</strong></article><article className="kpi-card"><div className="kpi-heading"><span>Overall risk</span><span className={`kpi-icon ${dashboard ? riskBand(dashboard.risk.overall_risk) : ""}`}><Icon name="activity" /></span></div><strong>{dashboard ? formatPercent(dashboard.risk.overall_risk) : "—"}</strong></article><article className="kpi-card"><div className="kpi-heading"><span>Simulation time</span><span className="kpi-icon violet"><Icon name="telemetry" /></span></div><strong>{dashboard ? `${dashboard.simulation.time_s.toFixed(0)} s` : "—"}</strong></article></div>
      <section className="card"><PanelTitle eyebrow="CURRENT TELEMETRY" title="Process sensor readings" /><SensorValueCards /></section>
      <div className="dashboard-two-column"><SensorTrendChart /><RiskDistributionChart risk={dashboard?.risk.risk} /></div>
    </>
  )
}

export function TelemetryPage() {
  const { dashboard } = usePlantGuard()
  return (
    <>
      <PageIntro eyebrow="SIMULATED SENSOR DATA" title="Live telemetry" copy="Sensor state is polled from the digital-twin API. It is not a real-time industrial sensor stream." action={<span className="tag tag-info">Polling API</span>} />
      <SensorValueCards />
      <div className="dashboard-two-column telemetry-charts"><SensorTrendChart /><ThicknessTrendChart /></div>
      <section className="card"><PanelTitle eyebrow="SOURCE & FRESHNESS" title="Telemetry context" /><div className="detail-grid"><div><span>Source</span><strong>Backend extrusion simulator</strong></div><div><span>Scenario</span><strong>{dashboard?.simulation.active_scenario ? titleCase(dashboard.simulation.active_scenario.type) : "Unavailable"}</strong></div><div><span>Simulation clock</span><strong>{dashboard ? `${dashboard.simulation.time_s.toFixed(1)} seconds` : "—"}</strong></div><div><span>Sampling</span><strong>Current backend history</strong></div></div><p className="fine-print">The user interface refreshes its dashboard view periodically; this is not a streaming or guaranteed real-time telemetry service.</p></section>
    </>
  )
}

export function AnalyticsPage() {
  const { dashboard, metrics } = usePlantGuard()
  const risk = dashboard?.risk
  return (
    <>
      <PageIntro eyebrow="MODEL OUTPUT / SYNTHETIC VALIDATION" title="AI analytics" copy="Compare current simulated risk signals with held-out model metrics. These results are not validated against real production data." />
      <div className="overview-kpis analytics-kpis"><article className="kpi-card"><div className="kpi-heading"><span>Overall risk estimate</span><span className="kpi-icon blue"><Icon name="activity" /></span></div><strong>{risk ? formatPercent(risk.overall_risk) : "—"}</strong><div className="kpi-foot"><span>Primary model: PINN</span></div></article><article className="kpi-card"><div className="kpi-heading"><span>Estimated lead time</span><span className="kpi-icon violet"><Icon name="analytics" /></span></div><strong>{risk ? `${risk.lead_time_estimate_s.toFixed(0)}s` : "—"}</strong><div className="kpi-foot"><span>Heuristic estimate; not empirically measured</span></div></article><article className="kpi-card"><div className="kpi-heading"><span>LSTM live status</span><span className="kpi-icon green"><Icon name="activity" /></span></div><strong className="kpi-text">{risk?.model_comparison?.lstm_status === "active" ? "Active" : "Warming up"}</strong><div className="kpi-foot"><span>Separate live comparator</span></div></article></div>
      <div className="risk-summary-grid">{risk && Object.entries(riskLabels).map(([key, label]) => <RiskCard key={key} label={label} value={risk.risk[key as RiskKey]} />)}</div>
      <RiskDistributionChart risk={risk?.risk} />
      <div className="section-heading-row"><div><p className="eyebrow">HELD-OUT MODEL EVALUATION</p><h2>PINN and LSTM comparison</h2></div><span className="tag tag-warning">Synthetic simulator holdout</span></div>
      {metrics ? <><div className="model-grid"><ModelMetricCard name="PINN" metrics={metrics.pinn} /><ModelMetricCard name="LSTM" metrics={metrics.lstm} /></div><ModelComparisonChart pinn={{ mae: metrics.pinn.mae, mse: metrics.pinn.mse }} lstm={{ mae: metrics.lstm.mae, mse: metrics.lstm.mse }} /></> : <div className="card inline-empty">Model metrics are unavailable until the backend finishes evaluation.</div>}
      <div className="dashboard-two-column"><section className="card"><PanelTitle eyebrow="MODEL NOTES" title="How to interpret this page" /><div className="notice-list"><p><strong>PINN:</strong> the dashboard’s primary model; the code combines data and physics-informed loss terms.</p><p><strong>LSTM:</strong> sequence-based comparison model. Live output waits for a complete input window.</p><p><strong>Evaluation:</strong> MAE and MSE are calculated from synthetic holdout predictions. Classification accuracy, precision, recall, F1, confusion matrix, false-alarm rate and empirical latency are not exposed by this API.</p></div></section><section className="card"><PanelTitle eyebrow="CURRENT LIVE COMPARISON" title="Model output state" /><div className="detail-grid"><div><span>Primary model</span><strong>PINN</strong></div><div><span>PINN risk band</span><strong>{risk?.risk_band ?? "Unavailable"}</strong></div><div><span>LSTM comparator</span><strong>{risk?.model_comparison?.lstm_status ?? "Unavailable"}</strong></div><div><span>Physics residual series</span><strong>Not exposed by API</strong></div></div></section></div>
    </>
  )
}

type CurrentSignal = { name: string; risk: number; key: RiskKey }
export function AlertsPage() {
  const { dashboard } = usePlantGuard()
  const [filter, setFilter] = useState("all")
  const [query, setQuery] = useState("")
  const signals: CurrentSignal[] = dashboard ? (Object.keys(riskLabels) as RiskKey[]).map((key) => ({ name: riskLabels[key], risk: dashboard.risk.risk[key], key })) : []
  const visible = signals.filter((signal) => (filter === "all" || riskBand(signal.risk) === filter) && signal.name.toLowerCase().includes(query.toLowerCase()))
  return (
    <>
      <PageIntro eyebrow="CURRENT MODEL SIGNALS" title="Alerts & incidents" copy="The backend exposes current risk estimates, not an incident event store. This page presents current signals only and does not fabricate alert history." />
      <section className="card">
        <div className="filter-toolbar"><div><p className="eyebrow">LIVE RISK SIGNALS</p><h2>Current defect estimates</h2></div><div className="filter-controls"><label className="search-field"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter defect signals" aria-label="Filter current risk signals" /></label><label className="select-control"><span className="sr-only">Risk level filter</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All levels</option><option value="high">High</option><option value="moderate">Moderate</option><option value="low">Low</option></select></label></div></div>
        <div className="signal-table">
          <div className="signal-table-head"><span>Current signal</span><span>Model risk</span><span>Severity band</span><span>Source</span></div>
          {visible.map((signal) => <Link className="signal-row" href="/analytics" key={signal.key}><span><i className={`severity-dot ${riskBand(signal.risk)}`} />{signal.name}</span><strong>{formatPercent(signal.risk)}</strong><StatusTag label={riskBand(signal.risk)} status={riskBand(signal.risk)} /><small>Current simulator output</small></Link>)}
          {!visible.length && <div className="inline-empty">{dashboard ? "No current signals match these filters." : "Risk signals appear when the backend connects."}</div>}
        </div>
      </section>
      <div className="notice-card"><span className="notice-icon"><Icon name="alerts" /></span><div><strong>Incident history is not available</strong><p>No alert timestamps, asset event records, acknowledgement workflow or resolution status are provided by the current API.</p></div></div>
    </>
  )
}

export function AdvisoryPage() {
  const { dashboard, busy, mutationAuthorized, applyAdvisory } = usePlantGuard()
  const advisory = dashboard?.advisory
  const result = dashboard?.correction_result
  return (
    <>
      <PageIntro eyebrow="OPERATOR-IN-THE-LOOP / SIMULATION ONLY" title="AI advisory center" copy="Review the backend-generated recommendation and, if desired, apply it to the mathematical simulator. This action never controls physical equipment." />
      <div className="advisory-page-grid">
        <section className="card advisory-detail-card">
          <PanelTitle eyebrow="CURRENT BACKEND RECOMMENDATION" title={advisory ? titleCase(advisory.defect) : "Recommendation unavailable"} aside={advisory && <StatusTag label={advisory.severity} status={riskBand(advisory.risk)} />} />
          {advisory ? <><div className="advisory-risk-readout"><span>Defect-specific model risk</span><strong>{formatPercent(advisory.risk)}</strong><span>Overall risk: {formatPercent(advisory.overall_risk)}</span></div><div className="recommendation-block"><span>Recommended action</span><strong>{advisory.recommended_action}</strong><p>{advisory.reason}</p></div><div className="detail-grid"><div><span>Target process variable</span><strong>{titleCase(advisory.target_process_variable)}</strong></div><div><span>Suggested adjustment</span><strong>{formatAdjustment(advisory)}</strong></div><div><span>Suggested duration</span><strong>{advisory.duration_s} seconds</strong></div><div><span>Recommendation source</span><strong>Backend advisory engine</strong></div></div></> : <div className="inline-empty">Connect the backend to load its recommendation.</div>}
          <div className="operator-review-note"><span className="review-check">i</span><span><strong>Operator review required</strong><small>Recommendation values are simulated and require independent validation.</small></span></div>
          <button className="button button-primary" type="button" onClick={() => void applyAdvisory()} disabled={!advisory || !mutationAuthorized || busy !== null}>{busy === "advisory" ? "Applying to simulator…" : "Apply correction to simulation"} <Icon name="arrow" /></button>
          {!mutationAuthorized && <p className="fine-print">Operator authorization in <Link href="/settings">Settings</Link> is required to apply simulated corrections.</p>}
        </section>
        <section className="card correction-explainer"><PanelTitle eyebrow="SAFE BOUNDARY" title="Advisory-only action" /><div className="safe-flow"><span className="safe-flow-icon"><Icon name="simulation" /></span><p>This button posts to <code>/api/v1/advisories/apply</code>, which changes only the backend's in-memory simulated process state.</p><p>No PLC, machine controller, or production equipment is addressed by this application.</p></div></section>
      </div>
      {result && <section className="card correction-result"><PanelTitle eyebrow="BACKEND CORRECTION RESPONSE" title="Simulated before / after" aside={<StatusTag label={result.simulated ? "Simulator only" : "Unverified"} status={result.simulated ? "info" : "warning"} />} /><p className="fine-print">Duration: {result.duration_s}s · {titleCase(result.defect)} · {titleCase(result.target_process_variable)}</p><div className="detail-grid"><div><span>Target sensor value</span><strong>{result.before.sensor_value.toFixed(3)} → {result.after.sensor_value.toFixed(3)}</strong></div><div><span>Defect-specific risk</span><strong>{formatPercent(result.before.defect_risk)} → {formatPercent(result.after.defect_risk)}</strong></div><div><span>Overall model risk</span><strong>{formatPercent(result.before.overall_risk)} → {formatPercent(result.after.overall_risk)}</strong></div></div><p className="fine-print">Risk may not always improve immediately; scenario dynamics continue after a correction.</p></section>}
    </>
  )
}

export function WorkflowsPage() {
  const { dashboard } = usePlantGuard()
  return (
    <>
      <PageIntro eyebrow="CONCEPTUAL PROCESS / MANUAL ACTIONS" title="Workflow overview" copy="This diagram describes a possible operator-led sequence. It is not an executed workflow engine or an integration with external plant systems." action={<Link className="button button-secondary" href="/simulation">Open simulation lab <Icon name="arrow" /></Link>} />
      <section className="card workflow-board"><div className="workflow-board-head"><div><p className="eyebrow">SIMULATION DATA PATH</p><h2>From sensor state to reviewed recommendation</h2></div><span className="tag tag-warning">No workflow engine connected</span></div>
        <div className="workflow-flow">
          {[
            ["01", "Sensor sample", "Backend simulator state", "complete"],
            ["02", "Risk evaluation", dashboard ? `PINN estimate · ${formatPercent(dashboard.risk.overall_risk)}` : "Waiting for API", dashboard ? "complete" : "waiting"],
            ["03", "Advisory generation", dashboard ? titleCase(dashboard.advisory.defect) : "Waiting for API", dashboard ? "complete" : "waiting"],
            ["04", "Operator review", "Manual review is required", "current"],
            ["05", "Simulated adjustment", "Operator-triggered simulator action", "manual"],
          ].map(([step, title, detail, status], index) => <div className="workflow-flow-item" key={step}><article className={`workflow-node ${status}`}><span className="workflow-node-index">{step}</span><strong>{title}</strong><small>{detail}</small><StatusTag label={status === "complete" ? "Available" : status === "current" ? "Required" : status === "manual" ? "Manual" : "Waiting"} status={status === "complete" ? "low" : status === "current" ? "warning" : "offline"} /></article>{index < 4 && <span className="workflow-connector" aria-hidden="true"><Icon name="arrow" /></span>}</div>)}
        </div>
      </section>
      <div className="notice-card"><span className="notice-icon"><Icon name="workflows" /></span><div><strong>External execution is not implemented</strong><p>There is no CMMS, Slack, PLC, email, work-order, or workflow-history integration. The advisory application action updates only simulated state.</p></div></div>
    </>
  )
}

export function SimulationPage() {
  const { dashboard, busy, mutationAuthorized, resetScenario, injectDefect, advance } = usePlantGuard()
  const active = dashboard?.simulation.active_scenario?.type
  const [defect, setDefect] = useState("surface_cracking")
  return (
    <>
      <PageIntro eyebrow="DIGITAL TWIN / CONTAINED STATE" title="Simulation lab" copy="Select one of the six implemented scenarios and observe backend sensor and risk responses. All commands are advisory demonstration actions only." action={<StatusTag label={active ? titleCase(active) : "Waiting for API"} status={dashboard ? "info" : "offline"} />} />
      <section className="card"><PanelTitle eyebrow="SCENARIO SELECTOR" title="Choose process conditions" aside={<span className="fine-print">Selecting a scenario resets its simulator state</span>} /><div className="scenario-cards">
        {scenarioOptions.map((scenario) => <button className={`scenario-option ${active === scenario.id ? "selected" : ""}`} type="button" key={scenario.id} aria-pressed={active === scenario.id} disabled={!mutationAuthorized || busy !== null} onClick={() => void resetScenario(scenario.id)}><span className="scenario-option-icon"><Icon name={scenario.id === "normal" ? "activity" : "alerts"} /></span><span><strong>{scenario.label}</strong><small>{scenario.note}</small></span><span className={`scenario-radio ${active === scenario.id ? "checked" : ""}`} /></button>)}
        {!mutationAuthorized && <p className="fine-print">Authorize as an operator in <Link href="/settings">Settings</Link> to change simulated state.</p>}
      </div></section>
      <div className="dashboard-two-column">
        <section className="card"><PanelTitle eyebrow="ACTIVE PROCESS STATE" title="Current sensor signals" aside={<span className="tag tag-info">{dashboard ? `${dashboard.simulation.time_s.toFixed(0)}s elapsed` : "API pending"}</span>} /><SensorValueCards compact /><div className="simulation-controls"><button className="button button-primary" type="button" disabled={!dashboard || !mutationAuthorized || busy !== null} onClick={() => void advance()}><Icon name="simulation" />{busy === "advance" ? "Advancing…" : "Advance simulation"}</button><p>Advances the simulation by two one-second steps.</p></div></section>
        <section className="card"><PanelTitle eyebrow="DEFECT INJECTION" title="Apply a simulated disturbance" /><p className="body-copy">Inject a supported defect into the simulator state to observe its sensor and risk response.</p><label className="field-label" htmlFor="defect-select">Defect mode</label><select className="form-select" id="defect-select" value={defect} onChange={(event) => setDefect(event.target.value)}><option value="surface_cracking">Surface cracking</option><option value="warping">Warping</option><option value="thickness_variation">Thickness variation</option></select><button className="button button-secondary" type="button" disabled={!dashboard || !mutationAuthorized || busy !== null} onClick={() => void injectDefect(defect)}>{busy === `defect:${defect}` ? "Injecting…" : "Inject defect into simulation"}</button><p className="fine-print">Defect injection changes only the in-memory simulator.</p></section>
      </div>
      <div className="dashboard-two-column"><SensorTrendChart /><RiskDistributionChart risk={dashboard?.risk.risk} /></div>
      <div className="simulation-disclaimer"><strong>Simulation boundary</strong><span>These controls do not connect to or alter physical manufacturing equipment.</span></div>
    </>
  )
}

export function RoiPage() {
  const [result, setResult] = useState<RoiEstimate | null>(null)
  const [validation, setValidation] = useState<string | null>(null)
  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const read = (key: string) => Number(formData.get(key))
    const throughput = read("throughput")
    const scrapRate = read("scrapRate")
    const reduction = read("reduction")
    const materialCost = read("materialCost")
    const operatingCost = read("operatingCost")
    const implementationCost = read("implementationCost")
    const values = [throughput, scrapRate, reduction, materialCost, operatingCost, implementationCost]
    if (values.some((value) => !Number.isFinite(value) || value < 0) || scrapRate > 100 || reduction > 100) {
      setValidation("Enter finite non-negative values; scrap rate and relative reduction must not exceed 100%.")
      return
    }
    const grossSavings = throughput * materialCost * (scrapRate / 100) * (reduction / 100)
    const annualSavings = grossSavings - operatingCost
    setResult({
      annual_savings_usd: annualSavings,
      scrap_reduction_pct: scrapRate * (reduction / 100),
      payback_months: annualSavings > 0 ? implementationCost / annualSavings * 12 : null,
    })
    setValidation(null)
  }
  const currency = (value: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
  return (
    <>
      <PageIntro eyebrow="ILLUSTRATIVE BUSINESS CASE" title="ROI analytics" copy="Explore sensitivity to assumptions. Outputs are arithmetic estimates only; they are not measured customer savings, investment advice, or a guarantee." action={<span className="tag tag-warning">Illustrative assumptions</span>} />
      <div className="roi-page-grid">
        <section className="card"><PanelTitle eyebrow="EDITABLE INPUTS" title="Set your assumptions" />        <form className="roi-input-form" onSubmit={calculate}>
          <div className="form-grid">
            <label>Annual throughput <span>kg / year</span><input name="throughput" type="number" min="0" step="any" defaultValue="1200000" required /></label>
            <label>Current scrap rate <span>% of throughput</span><input name="scrapRate" type="number" min="0" max="100" step="any" defaultValue="3.2" required /></label>
            <label>Assumed relative scrap reduction <span>% of current scrap</span><input name="reduction" type="number" min="0" max="100" step="any" defaultValue="28" required /></label>
            <label>Material cost <span>USD / kg</span><input name="materialCost" type="number" min="0" step="any" defaultValue="3.2" required /></label>
            <label>Annual operating cost <span>USD / year</span><input name="operatingCost" type="number" min="0" step="any" defaultValue="260000" required /></label>
            <label>Implementation cost <span>one-time USD</span><input name="implementationCost" type="number" min="0" step="any" defaultValue="0" required /></label>
          </div>
          {validation && <p className="field-error" role="alert">{validation}</p>}
          <button className="button button-primary" type="submit">Calculate illustrative estimate <Icon name="arrow" /></button>
        </form></section>
        <section className="card roi-output-card"><PanelTitle eyebrow="SENSITIVITY RESULT" title="Estimated outcomes" /><div className="roi-result-values"><div><span>Illustrative net annual benefit</span><strong>{result ? currency(result.annual_savings_usd) : "—"}</strong></div><div><span>Assumed scrap-rate reduction</span><strong>{result ? `${result.scrap_reduction_pct.toFixed(2)} percentage points` : "—"}</strong></div><div><span>Simple payback</span><strong>{!result ? "Calculate to view" : result.payback_months === null ? "Not reached" : `${result.payback_months.toFixed(1)} months`}</strong></div></div><div className="formula-note"><strong>Formula used</strong><p>Annual throughput × material cost × current scrap rate × assumed relative reduction − annual operating cost. Simple payback = one-time implementation cost ÷ positive annual benefit × 12.</p><small>Illustrative arithmetic; excludes taxes, discounting, ramp-up, uncertainty and other costs. No outcomes are guaranteed.</small></div></section>
      </div>
    </>
  )
}

function downloadSensorCsv(history: Record<string, number | string | null>[]) {
  if (!history.length) return
  const columns = ["timestamp_s", ...sensorDefinitions.map(([key]) => key)]
  const rows = [columns, ...history.map((reading) => columns.map((column) => reading[column] ?? ""))]
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = "plantguard-simulated-sensor-history.csv"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function ReportsPage() {
  const { dashboard, history, metrics } = usePlantGuard()
  return (
    <>
      <PageIntro eyebrow="AVAILABLE DATA PRODUCTS" title="Reports & exports" copy="Export data returned by the simulator. No PDF generation, incident archive, or production historian export is currently implemented." />
      <div className="report-export-grid">
        <article className="card export-card"><span className="export-icon"><Icon name="download" /></span><p className="eyebrow">CSV · SENSOR HISTORY</p><h2>Simulated sensor stream</h2><p>Download the currently loaded sensor history ({history.length} readings) with the simulator timestamp and available process variables.</p><button className="button button-primary" type="button" disabled={!history.length} onClick={() => downloadSensorCsv(history)}>Export sensor CSV <Icon name="arrow" /></button></article>
        <article className="card export-card"><span className="export-icon violet"><Icon name="analytics" /></span><p className="eyebrow">MODEL EVALUATION</p><h2>Held-out metrics</h2><p>{metrics ? `PINN and LSTM MAE/MSE from a synthetic simulator holdout are available (${metrics.pinn.sample_count ?? "—"} PINN observations).` : "Model evaluation data is not loaded."}</p><Link className="button button-secondary" href="/analytics">View model metrics <Icon name="arrow" /></Link></article>
      </div>
      <section className="card"><PanelTitle eyebrow="CURRENT SIMULATOR SNAPSHOT" title="Report preview" /><div className="detail-grid"><div><span>Scenario</span><strong>{dashboard?.simulation.active_scenario ? titleCase(dashboard.simulation.active_scenario.type) : "Unavailable"}</strong></div><div><span>Simulation time</span><strong>{dashboard ? `${dashboard.simulation.time_s.toFixed(1)} s` : "—"}</strong></div><div><span>Overall risk</span><strong>{dashboard ? formatPercent(dashboard.risk.overall_risk) : "—"}</strong></div><div><span>Sensor rows ready for export</span><strong>{history.length}</strong></div></div></section>
      <div className="notice-card"><span className="notice-icon"><Icon name="reports" /></span><div><strong>PDF and historical reports are not available</strong><p>No PDF export or server-side report archive exists in the current project. Sensor CSV is generated from the loaded simulated readings in the browser.</p></div></div>
    </>
  )
}

export function IntegrationsPage() {
  const { online, dashboard, metrics } = usePlantGuard()
  const endpoints = [
    ["Dashboard & simulator", "GET /api/v1/dashboard", "Implemented"],
    ["Sensor history", "GET /api/v1/sensors/history", "Implemented"],
    ["Risk & advisory", "GET /api/v1/risk/latest · /api/v1/advisory/latest", "Implemented"],
    ["Simulation actions", "POST /api/v1/simulation/*", "Implemented"],
    ["Model evaluation", "GET /api/v1/metrics", metrics ? "Available" : "Pending"],
    ["External OT / CMMS / messaging", "No configured endpoint", "Not connected"],
  ]
  return (
    <>
      <PageIntro eyebrow="SERVICE BOUNDARIES" title="Integrations & API" copy="Inspect the application API boundary. Only repository endpoints are listed as implemented; third-party and industrial systems are not connected." action={<button className="button button-secondary" type="button" disabled={!getApiBaseUrl()} onClick={() => window.open(`${getApiBaseUrl()}/docs`, "_blank", "noopener,noreferrer")}>Open API docs <Icon name="arrow" /></button>} />
      <div className="overview-kpis"><article className="kpi-card"><div className="kpi-heading"><span>Backend API</span><span className={`kpi-icon ${online ? "green" : "red"}`}><Icon name="integrations" /></span></div><strong className="kpi-text">{online ? "Reachable" : "Unavailable"}</strong><div className="kpi-foot"><span>Health and dashboard endpoints</span></div></article><article className="kpi-card"><div className="kpi-heading"><span>Simulation service</span><span className="kpi-icon blue"><Icon name="simulation" /></span></div><strong className="kpi-text">{dashboard ? "Active" : "Unknown"}</strong><div className="kpi-foot"><span>In-memory mathematical twin</span></div></article><article className="kpi-card"><div className="kpi-heading"><span>Industrial connectivity</span><span className="kpi-icon violet"><Icon name="assets" /></span></div><strong className="kpi-text">Not configured</strong><div className="kpi-foot"><span>No PLC or plant connection</span></div></article></div>
      <section className="card"><PanelTitle eyebrow="APPLICATION ENDPOINTS" title="Implemented API surface" /><div className="integration-list">{endpoints.map(([name, path, status]) => <div className="integration-row" key={name}><span className="integration-symbol"><Icon name={name.startsWith("External") ? "close" : "integrations"} /></span><span><strong>{name}</strong><small>{path}</small></span><StatusTag label={status} status={status === "Not connected" ? "offline" : "info"} /></div>)}</div></section>
      <div className="notice-card"><span className="notice-icon"><Icon name="settings" /></span><div><strong>Container status is not reported by this UI</strong><p>The app does not have a Docker runtime status API. Container health must be checked through the operator's local Docker tooling.</p></div></div>
    </>
  )
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { online, dashboard, mutationAuthorized, authorizeMutations, revokeMutationAuthorization } = usePlantGuard()
  const [operatorUsername, setOperatorUsername] = useState("")
  const [operatorPassword, setOperatorPassword] = useState("")
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  async function submitOperatorToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError(null)
    try {
      await authorizeMutations(operatorUsername, operatorPassword)
    } catch (reason) {
      setAuthError(reason instanceof Error ? reason.message : "Operator authentication failed.")
    } finally {
      setOperatorPassword("")
      setAuthBusy(false)
    }
  }
  async function signOutOperator() {
    setAuthBusy(true)
    setAuthError(null)
    try {
      await revokeMutationAuthorization()
    } catch (reason) {
      setAuthError(reason instanceof Error ? reason.message : "Could not revoke operator authorization.")
    } finally {
      setAuthBusy(false)
    }
  }
  const themes = [
    ["midnight", "Midnight navy", "Default · layered blue-black surfaces"],
    ["graphite", "Graphite dark", "Neutral charcoal with cool accents"],
    ["light", "Clean light", "High-contrast light surfaces"],
  ] as const
  return (
    <>
      <PageIntro eyebrow="LOCAL PREFERENCES" title="Settings" copy="Appearance, local simulation status and operator sign-in for advisory-only simulated changes. This single-operator demo is not a complete identity or role-management system." />
      <section className="card"><PanelTitle eyebrow="APPEARANCE" title="Theme presets" /><div className="theme-choice-grid">{themes.map(([id, label, description]) => <button key={id} type="button" className={`theme-choice ${theme === id ? "selected" : ""}`} aria-pressed={theme === id} onClick={() => setTheme(id)}><span className={`theme-preview ${id}`}><i /><i /><i /></span><strong>{label}</strong><small>{description}</small><span className={`theme-check ${theme === id ? "checked" : ""}`}>{theme === id ? "Selected" : "Use theme"}</span></button>)}</div><p className="fine-print">Theme preference is stored in this browser only.</p></section>
      <div className="dashboard-two-column"><section className="card"><PanelTitle eyebrow="SIMULATION BOUNDARY" title="Safety and data mode" /><div className="setting-status-row"><span>Operating mode</span><StatusTag label="Simulation only" status="warning" /></div><div className="setting-status-row"><span>Backend status</span><StatusTag label={online ? "Connected" : "Unavailable"} status={online ? "low" : "offline"} /></div><div className="setting-status-row"><span>Active scenario</span><strong>{dashboard?.simulation.active_scenario ? titleCase(dashboard.simulation.active_scenario.type) : "Unavailable"}</strong></div><p className="fine-print">No configuration in this application enables direct physical equipment control.</p></section><section className="card"><PanelTitle eyebrow="OPERATOR ACCESS" title={mutationAuthorized ? "Authorized for simulated changes" : "Operator sign-in"} />{mutationAuthorized ? <><div className="setting-status-row"><span>Operator session</span><StatusTag label="Active · this browser" status="low" /></div><p className="fine-print">This browser holds only an HTTP-only session cookie and a short-lived CSRF token. The backend mutation secret is server-side only.</p><button className="button button-secondary" type="button" disabled={authBusy} onClick={() => void signOutOperator()}>{authBusy ? "Revoking…" : "Sign out and revoke session"}</button></> : <form className="roi-input-form" onSubmit={(event) => void submitOperatorToken(event)}><p className="body-copy">Sign in with the operator credentials configured by the service owner. Credentials are sent only to this origin over HTTPS in production; this is a single-operator demonstration flow.</p><label className="field-label" htmlFor="operator-username">Operator username</label><input id="operator-username" type="text" autoComplete="username" value={operatorUsername} onChange={(event) => setOperatorUsername(event.target.value)} required maxLength={128} /><label className="field-label" htmlFor="operator-password">Operator password</label><input id="operator-password" type="password" autoComplete="current-password" value={operatorPassword} onChange={(event) => setOperatorPassword(event.target.value)} required maxLength={1024} /><button className="button button-primary" type="submit" disabled={authBusy || !operatorUsername || !operatorPassword}>{authBusy ? "Signing in…" : "Sign in for simulated actions"}</button></form>}{authError && <p role="alert" className="field-error">{authError}</p>}<p className="fine-print">This single shared operator identity is not multi-user access control, MFA, or enterprise SSO.</p></section></div>
    </>
  )
}

export function SectionPage({ section }: { section: string }) {
  switch (section) {
    case "assets": return <AssetsPage />
    case "telemetry": return <TelemetryPage />
    case "analytics": return <AnalyticsPage />
    case "alerts": return <AlertsPage />
    case "advisory": return <AdvisoryPage />
    case "workflows": return <WorkflowsPage />
    case "simulation": return <SimulationPage />
    case "roi": return <RoiPage />
    case "reports": return <ReportsPage />
    case "integrations": return <IntegrationsPage />
    case "settings": return <SettingsPage />
    default: return <PageIntro eyebrow="PAGE NOT FOUND" title="Section unavailable" copy="This route is not part of the PlantGuard AI workspace." action={<Link className="button button-secondary" href="/overview">Return to overview</Link>} />
  }
}
