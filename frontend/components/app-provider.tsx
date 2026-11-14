"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { apiRequest, type Dashboard, type MetricsResponse, type ScenarioId, type Sensor } from "@/lib/plantguard"

type AppContextValue = {
  dashboard: Dashboard | null
  history: Sensor[]
  metrics: MetricsResponse | null
  online: boolean
  busy: string | null
  error: string | null
  mutationAuthorized: boolean
  updatedAt: Date | null
  refresh: () => Promise<void>
  authorizeMutations: (username: string, password: string) => Promise<void>
  revokeMutationAuthorization: () => Promise<void>
  resetScenario: (scenario: ScenarioId) => Promise<void>
  injectDefect: (defect: string) => Promise<void>
  advance: () => Promise<void>
  applyAdvisory: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [history, setHistory] = useState<Sensor[]>([])
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null)
  const [online, setOnline] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mutationAuthorized, setMutationAuthorized] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const inFlight = useRef(false)
  const metricsLoadedAt = useRef(0)

  const refresh = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const [dash, health] = await Promise.all([
        apiRequest<Dashboard>("/api/v1/dashboard"),
        apiRequest<{ status: string; simulation_only: boolean }>("/health"),
      ])
      if (health.status !== "ok" || health.simulation_only !== true) {
        throw new Error("Backend health check did not confirm simulation-only mode.")
      }
      setDashboard(dash)
      setHistory(dash.simulation.sensor_history ?? [])
      setOnline(true)
      setUpdatedAt(new Date())
      setError(null)
      if (!metrics || Date.now() - metricsLoadedAt.current > 60_000) {
        try {
          const nextMetrics = await apiRequest<MetricsResponse>("/api/v1/metrics")
          setMetrics(nextMetrics)
          metricsLoadedAt.current = Date.now()
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Model metrics are unavailable.")
        }
      }
    } catch (reason) {
      setOnline(false)
      setError(reason instanceof Error ? reason.message : "Backend is unavailable.")
    } finally {
      inFlight.current = false
    }
  }, [metrics])

  useEffect(() => {
    let active = true
    void fetch("/api/auth", { cache: "no-store" })
      .then(async (response) => response.ok
        ? response.json() as Promise<{ authorized: boolean; csrfToken: string | null }>
        : { authorized: false, csrfToken: null })
      .then((result) => {
        if (active) {
          setMutationAuthorized(result.authorized === true)
          setCsrfToken(result.authorized === true ? result.csrfToken : null)
        }
      })
      .catch(() => {
        if (active) {
          setMutationAuthorized(false)
          setCsrfToken(null)
        }
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 5000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const authorizeMutations = useCallback(async (username: string, password: string) => {
    let response: Response
    try {
      response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password }),
      })
    } catch {
      throw new Error("Could not reach the local authentication endpoint.")
    }
    let result: { authorized?: unknown; csrfToken?: unknown; detail?: unknown }
    try {
      result = await response.json() as { authorized?: unknown; csrfToken?: unknown; detail?: unknown }
    } catch {
      throw new Error(response.ok ? "Authentication response was invalid." : "Operator credentials were not accepted.")
    }
    if (!response.ok) {
      throw new Error(typeof result.detail === "string" ? result.detail : "Operator credentials were not accepted.")
    }
    if (result.authorized !== true || typeof result.csrfToken !== "string") {
      throw new Error("Authentication response was invalid.")
    }
    setCsrfToken(result.csrfToken)
    setMutationAuthorized(true)
  }, [])

  const revokeMutationAuthorization = useCallback(async () => {
    try {
      const response = await fetch("/api/auth", {
        method: "DELETE",
        credentials: "same-origin",
        headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
      })
      if (!response.ok) throw new Error("Could not revoke the operator session.")
      setMutationAuthorized(false)
      setCsrfToken(null)
    } catch (reason) {
      throw reason instanceof Error ? reason : new Error("Could not revoke the operator session.")
    }
  }, [])

  const command = useCallback(async (key: string, path: string, body?: object) => {
    if (busy) return
    if (!mutationAuthorized) {
      setError("Authorize as an operator in Settings before changing simulated state.")
      return
    }
    setBusy(key)
    setError(null)
    try {
      const result = await apiRequest<Dashboard>(path, {
        method: "POST",
        headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
        body: JSON.stringify(body ?? {}),
      })
      setDashboard(result)
      setHistory(result.simulation.sensor_history ?? [])
      setOnline(true)
      setUpdatedAt(new Date())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The requested action failed.")
    } finally {
      setBusy(null)
    }
  }, [busy, mutationAuthorized, csrfToken])

  const value = useMemo<AppContextValue>(() => ({
    dashboard,
    history,
    metrics,
    online,
    busy,
    error,
    mutationAuthorized,
    updatedAt,
    refresh,
    authorizeMutations,
    revokeMutationAuthorization,
    resetScenario: (scenario) => command(`scenario:${scenario}`, "/api/v1/simulation/reset", { scenario }),
    injectDefect: (defect) => command(`defect:${defect}`, "/api/v1/simulation/inject", { defect }),
    advance: () => command("advance", "/api/v1/simulation/advance", { dt: 1, steps: 2 }),
    applyAdvisory: () => command("advisory", "/api/v1/advisories/apply"),
  }), [dashboard, history, metrics, online, busy, error, mutationAuthorized, updatedAt, refresh, authorizeMutations, revokeMutationAuthorization, command])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function usePlantGuard(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) throw new Error("usePlantGuard must be used within AppProvider.")
  return value
}
