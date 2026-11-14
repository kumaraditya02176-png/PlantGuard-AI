export const scenarioOptions = [
  { id: "normal", label: "Normal operation", note: "Baseline process" },
  { id: "overheating", label: "Overheating", note: "Thermal excursion" },
  { id: "uneven_cooling", label: "Uneven cooling", note: "Cooling imbalance" },
  { id: "feed_rate_instability", label: "Feed-rate instability", note: "Variable throughput" },
  { id: "gradual_drift", label: "Gradual drift", note: "Slow process change" },
  { id: "sudden_disturbance", label: "Sudden disturbance", note: "Rapid process change" },
] as const

export type ScenarioId = (typeof scenarioOptions)[number]["id"]
export type RiskKey = "surface_cracking" | "warping" | "thickness_non_uniformity"
export type Sensor = Record<string, number | string | null> & { timestamp_s?: number }
export type RiskMap = Record<RiskKey, number>

export type Advisory = {
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

export type CorrectionResult = {
  simulated: boolean
  defect: string
  target_process_variable: string
  duration_s: number
  before: { sensor_value: number; defect_risk: number; overall_risk: number }
  after: { sensor_value: number; defect_risk: number; overall_risk: number }
}

export type Dashboard = {
  simulation: {
    time_s: number
    active_scenario: { type: ScenarioId } | null
    latest_sensor: Sensor
    sensor_history?: Sensor[]
    controls: Record<string, number>
  }
  risk: {
    risk: RiskMap
    risk_bands?: Record<RiskKey, string>
    overall_risk: number
    risk_band: string
    lead_time_estimate_s: number
    model_comparison?: {
      primary_model: "pinn"
      lstm_status: "active" | "warming_up"
      lstm_risk: (RiskMap & { overall_risk: number; risk_band: string; lead_time_estimate_s: number }) | null
    }
  }
  advisory: Advisory
  correction_result?: CorrectionResult
  notice: string
}

export type ModelMetrics = {
  scope?: string
  label?: string
  mae: number
  mse: number
  sample_count?: number
  synthetic_holdout?: boolean
}

export type MetricsResponse = {
  synthetic_holdout?: boolean
  scope?: string
  pinn: ModelMetrics
  lstm: ModelMetrics
}

export type RoiEstimate = {
  annual_savings_usd: number
  scrap_reduction_pct: number
  payback_months: number | null
}

export function getApiBaseUrl(): string {
  return "/api/backend"
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl()
  if (!base) throw new Error("Backend API URL is not configured.")
  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    })
  } catch {
    throw new Error("Backend is unavailable. Check the API connection and try again.")
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status}).`
    try {
      const body = (await response.json()) as { detail?: unknown }
      if (typeof body.detail === "string") detail = body.detail
    } catch {
      // The response body may not be JSON.
    }
    throw new Error(detail)
  }
  return (await response.json()) as T
}

export function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function formatPercent(value: number): string {
  return `${Math.round(Math.min(100, Math.max(0, value * 100)))}%`
}

export function riskBand(value: number): "low" | "moderate" | "high" {
  if (value < 0.35) return "low"
  if (value < 0.65) return "moderate"
  return "high"
}

export function titleCase(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function formatSensorValue(key: string, value: number | string | null | undefined): string {
  const number = toNumber(value)
  const formats: Record<string, [number, string]> = {
    temperature_c: [1, "°C"],
    pressure_bar: [1, "bar"],
    screw_speed_rpm: [0, "rpm"],
    feed_rate_kg_h: [0, "kg/h"],
    vibration_mm_s: [2, "mm/s"],
    viscosity_pa_s: [1, "Pa·s"],
    thickness_mm: [3, "mm"],
    line_speed_m_min: [1, "m/min"],
    cooling_efficiency: [0, "%"],
  }
  const [digits, unit] = formats[key] ?? [2, ""]
  const formatted = key === "cooling_efficiency" ? `${Math.round(number * 100)}` : number.toFixed(digits)
  return `${formatted}${unit ? ` ${unit}` : ""}`
}

export function formatAdjustment(advisory: Advisory | undefined): string {
  if (!advisory) return "No recommendation"
  const adjustment = advisory.suggested_adjustment
  const signed = adjustment > 0 ? `+${adjustment}` : `${adjustment}`
  if (advisory.target_process_variable === "temperature_c") return `${signed} °C`
  if (advisory.target_process_variable === "cooling_efficiency") {
    const points = adjustment * 100
    return `${points > 0 ? "+" : ""}${points} percentage points`
  }
  if (advisory.target_process_variable === "feed_rate_kg_h") return `${signed} kg/h`
  return `${signed} ${titleCase(advisory.target_process_variable)}`
}
