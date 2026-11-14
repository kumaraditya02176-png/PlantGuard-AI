"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Icon } from "@/components/icon"
import { usePlantGuard } from "@/components/app-provider"
import { getApiBaseUrl, formatPercent, formatSensorValue, riskBand, titleCase } from "@/lib/plantguard"

type ThemeName = "midnight" | "graphite" | "light"
type ThemeContextValue = { theme: ThemeName; setTheme: (theme: ThemeName) => void }

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within AppShell.")
  return context
}

const navigation = [
  {
    label: "WORKSPACE",
    items: [
      { href: "/overview", label: "Overview", icon: "overview" },
      { href: "/assets", label: "Plant & assets", icon: "assets" },
      { href: "/telemetry", label: "Live telemetry", icon: "telemetry" },
      { href: "/analytics", label: "AI analytics", icon: "analytics" },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { href: "/alerts", label: "Alerts & incidents", icon: "alerts" },
      { href: "/advisory", label: "AI advisory", icon: "advisory" },
      { href: "/workflows", label: "Workflow overview", icon: "workflows" },
      { href: "/simulation", label: "Simulation lab", icon: "simulation" },
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      { href: "/roi", label: "ROI analytics", icon: "roi" },
      { href: "/reports", label: "Reports & exports", icon: "reports" },
      { href: "/integrations", label: "Integrations & API", icon: "integrations" },
      { href: "/settings", label: "Settings", icon: "settings" },
    ],
  },
]

const pageTitles: Record<string, string> = {
  overview: "Executive overview",
  assets: "Plant & assets",
  telemetry: "Live telemetry",
  analytics: "AI analytics",
  alerts: "Alerts & incidents",
  advisory: "AI advisory center",
  workflows: "Workflow overview",
  simulation: "Simulation lab",
  roi: "ROI analytics",
  reports: "Reports & exports",
  integrations: "Integrations & API",
  settings: "Settings",
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { dashboard, online, error, refresh } = usePlantGuard()
  const [theme, setThemeState] = useState<ThemeName>("midnight")
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationReadSignal, setNotificationReadSignal] = useState("")
  const [searchIndex, setSearchIndex] = useState(0)
  const searchTriggerRef = useRef<HTMLButtonElement>(null)
  const searchDialogRef = useRef<HTMLElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const previousSearchFocus = useRef<HTMLElement | null>(null)
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null)
  const mobileNavCloseRef = useRef<HTMLButtonElement>(null)
  const mobileNavRef = useRef<HTMLElement>(null)
  const previousMobileFocus = useRef<HTMLElement | null>(null)

  const setTheme = useCallback((nextTheme: ThemeName) => {
    setThemeState(nextTheme)
    document.documentElement.dataset.theme = nextTheme
    try {
      localStorage.setItem("plantguard-theme", nextTheme)
    } catch {
      setThemeState(nextTheme)
    }
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem("plantguard-theme")
      if (saved === "midnight" || saved === "graphite" || saved === "light") setTheme(saved)
      const savedCollapse = localStorage.getItem("plantguard-sidebar-collapsed")
      setCollapsed(savedCollapse === "true")
      setNotificationReadSignal(localStorage.getItem("plantguard-notifications-read-signal") ?? "")
    } catch {
      document.documentElement.dataset.theme = "midnight"
    }
  }, [setTheme])

  useEffect(() => {
    setMobileOpen(false)
    setNotificationsOpen(false)
  }, [pathname])

  const section = pathname.split("/")[1] || "overview"
  const title = pageTitles[section] ?? (section === "assets" ? "Asset detail" : "PlantGuard AI")
  const currentRisk = dashboard?.risk.overall_risk
  const riskLevel = currentRisk === undefined ? "unknown" : riskBand(currentRisk)
  const activeNotification = dashboard && (dashboard.risk.risk_band === "high" || dashboard.risk.risk_band === "moderate")
  const currentSignalKey = dashboard
    ? `${dashboard.simulation.active_scenario?.type ?? "unknown"}:${dashboard.risk.risk_band}:${dashboard.advisory.defect}`
    : ""
  const notificationUnread = Boolean(activeNotification && currentSignalKey && currentSignalKey !== notificationReadSignal)
  const navEntries = useMemo(() => navigation.flatMap((group) => group.items), [])
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase()
    const pages = navEntries.filter((item) => !query || `${item.label} ${item.href}`.toLowerCase().includes(query))
      .map((item) => ({ label: item.label, detail: "Page", href: item.href, icon: item.icon }))
    const sensorLabels: Record<string, string> = {
      temperature_c: "Temperature",
      pressure_bar: "Melt pressure",
      screw_speed_rpm: "Screw speed",
      feed_rate_kg_h: "Feed rate",
      vibration_mm_s: "Vibration",
      viscosity_pa_s: "Viscosity",
      thickness_mm: "Output thickness",
      line_speed_m_min: "Line speed",
      cooling_efficiency: "Cooling efficiency",
    }
    const live = dashboard ? [
      { label: "Simulated extrusion process", detail: "Asset · demo data", href: "/assets/extrusion-line", icon: "assets" },
      { label: `${titleCase(dashboard.advisory.defect)} advisory`, detail: "Current simulated model advisory", href: "/advisory", icon: "advisory" },
      ...Object.entries(sensorLabels).flatMap(([field, label]) => {
        const value = dashboard.simulation.latest_sensor[field]
        if (value === undefined || value === null) return []
        const reading = `${label}: ${formatSensorValue(field, value)}`
        return [{ label: reading, detail: "Current simulated sensor reading", href: "/telemetry", icon: "telemetry" }]
      }),
    ].filter((item) => !query || `${item.label} ${item.detail}`.toLowerCase().includes(query)) : []
    return [...pages, ...live].slice(0, 9)
  }, [dashboard, navEntries, search])

  const openSearch = useCallback(() => {
    previousSearchFocus.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : searchTriggerRef.current
    setSearchOpen(true)
    setSearchIndex(0)
  }, [])

  const closeSearch = useCallback(() => setSearchOpen(false), [])

  const openMobileNavigation = useCallback(() => {
    previousMobileFocus.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : mobileMenuTriggerRef.current
    setMobileOpen(true)
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable
      if ((event.key === "/" && !typing) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault()
        if (searchOpen) closeSearch()
        else openSearch()
        return
      }
      if (event.key === "Escape") {
        closeSearch()
        setNotificationsOpen(false)
        setMobileOpen(false)
        return
      }
      if (!searchOpen || !searchResults.length) return
      if (event.key === "ArrowDown") {
        event.preventDefault()
        setSearchIndex((index) => (index + 1) % searchResults.length)
      } else if (event.key === "ArrowUp") {
        event.preventDefault()
        setSearchIndex((index) => (index - 1 + searchResults.length) % searchResults.length)
      } else if (event.key === "Enter") {
        event.preventDefault()
        chooseResult(searchResults[searchIndex]?.href ?? searchResults[0].href)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [searchOpen, searchIndex, searchResults, closeSearch, openSearch])

  useEffect(() => {
    if (!searchOpen) return
    const dialog = searchDialogRef.current
    const input = searchInputRef.current
    input?.focus()
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab" || !dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('input, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    dialog?.addEventListener("keydown", trapFocus)
    return () => {
      dialog?.removeEventListener("keydown", trapFocus)
      previousSearchFocus.current?.focus()
      previousSearchFocus.current = null
    }
  }, [searchOpen])

  useEffect(() => {
    if (!mobileOpen) return
    const nav = mobileNavRef.current
    mobileNavCloseRef.current?.focus()
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab" || !nav) return
      const focusable = Array.from(nav.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    nav?.addEventListener("keydown", trapFocus)
    return () => {
      nav?.removeEventListener("keydown", trapFocus)
      previousMobileFocus.current?.focus()
      previousMobileFocus.current = null
    }
  }, [mobileOpen])

  function chooseResult(href: string) {
    closeSearch()
    setSearch("")
    router.push(href)
  }

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value
      try {
        localStorage.setItem("plantguard-sidebar-collapsed", String(next))
      } catch {
        return next
      }
      return next
    })
  }

  function markNotificationsRead() {
    if (!currentSignalKey) return
    setNotificationReadSignal(currentSignalKey)
    try {
      localStorage.setItem("plantguard-notifications-read-signal", currentSignalKey)
    } catch {
      setNotificationReadSignal(currentSignalKey)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "mobile-nav-open" : ""}`}>
        <aside id="primary-navigation" ref={mobileNavRef} className="sidebar" aria-label="Primary navigation" role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen || undefined}>
          <div className="sidebar-brand">
            <Link href="/overview" className="brand-lockup" aria-label="PlantGuard AI overview">
              <span className="brand-symbol"><span /><span /><span /></span>
              <span className="brand-wordmark">PlantGuard <b>AI</b></span>
            </Link>
            <button className="icon-button sidebar-collapse" type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-controls="primary-navigation" aria-expanded={!collapsed} onClick={toggleCollapsed}>
              <Icon name="collapse" />
            </button>
            <button ref={mobileNavCloseRef} className="icon-button mobile-nav-close" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
              <Icon name="close" />
            </button>
          </div>
          <div className="sidebar-context">
            <span className="plant-avatar">PG</span>
            <span className="plant-context-text"><strong>Extrusion demo</strong><small>SIMULATED PROCESS</small></span>
            <Icon className="context-chevron" name="chevron" />
          </div>
          <nav className="sidebar-nav">
            {navigation.map((group) => (
              <div className="nav-group" key={group.label}>
                <p className="nav-group-title">{group.label}</p>
                {group.items.map((item) => (
                  <Link
                    className={`nav-item ${section === item.href.slice(1) ? "active" : ""}`}
                    href={item.href}
                    key={item.href}
                    title={item.label}
                    aria-label={item.label}
                    aria-current={section === item.href.slice(1) ? "page" : undefined}
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <div className={`sidebar-connection ${online ? "online" : "offline"}`}><span className="status-dot" />{online ? "API connected" : "API unavailable"}</div>
            <span className="sidebar-build">LOCAL SIMULATION · NO MACHINE CONTROL</span>
          </div>
        </aside>

        {mobileOpen && <button className="mobile-backdrop" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
        <div className="workspace">
          <header className="topbar">
            <div className="topbar-left">
              <button ref={mobileMenuTriggerRef} className="icon-button mobile-menu-button" type="button" aria-label="Open navigation" aria-controls="primary-navigation" aria-expanded={mobileOpen} onClick={openMobileNavigation}><Icon name="menu" /></button>
              <div>
                <div className="breadcrumbs"><span>PlantGuard AI</span><span className="breadcrumb-divider">/</span><strong>{title}</strong></div>
                <h1 className="topbar-title">{title}</h1>
              </div>
            </div>
            <div className="topbar-actions">
              <button ref={searchTriggerRef} className="search-trigger" type="button" onClick={openSearch} aria-label="Search pages and current data" aria-controls="global-search-dialog" aria-expanded={searchOpen}>
                <Icon name="search" /><span>Search pages and current data</span><kbd>Ctrl K</kbd>
              </button>
              <div className="theme-quick">
                <label className="sr-only" htmlFor="quick-theme">Theme</label>
                <select id="quick-theme" value={theme} onChange={(event) => setTheme(event.target.value as ThemeName)} aria-label="Choose appearance theme">
                  <option value="midnight">Midnight</option>
                  <option value="graphite">Graphite</option>
                  <option value="light">Light</option>
                </select>
              </div>
              <div className="notification-wrap">
                <button className="icon-button notification-button" type="button" aria-label="Open current notifications" aria-controls="current-notifications" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((open) => !open); markNotificationsRead() }}>
                  <Icon name="bell" />
                  {notificationUnread && <span className="notification-dot" />}
                </button>
                {notificationsOpen && (
                  <div id="current-notifications" className="notification-popover">
                    <div className="popover-heading"><div><strong>Current signals</strong><small>Live model state · not an incident history</small></div><button className="text-button" onClick={() => setNotificationsOpen(false)}>Close</button></div>
                    {dashboard ? (
                      <Link href="/alerts" className="notification-item" onClick={() => setNotificationsOpen(false)}>
                        <span className={`signal-icon ${riskLevel}`}><Icon name="activity" /></span>
                        <span><strong>{activeNotification ? `${titleCase(dashboard.advisory.defect)} risk is ${dashboard.risk.risk_band}` : "No elevated defect risk"}</strong><small>Current simulation reading · {formatPercent(dashboard.risk.overall_risk)} overall risk</small></span>
                      </Link>
                    ) : <p className="popover-empty">{online ? "Loading current signals…" : "Connect the backend to view current signals."}</p>}
                    <p className="popover-note">Notifications are local to this browser. Push or email delivery is not configured.</p>
                  </div>
                )}
              </div>
              <div className="topbar-status"><span className={`status-dot ${online ? "online" : "offline"}`} /><span>{online ? "Connected" : "Disconnected"}</span></div>
              <div className="workspace-identity"><span className="identity-avatar">PG</span><span><strong>Demo workspace</strong><small>Local simulation</small></span></div>
            </div>
          </header>
          <div className="global-simulation-strip"><span className="simulation-pulse" /> SIMULATION MODE <span>Advisory only · no physical machine control</span><span className="strip-status">{dashboard?.simulation.active_scenario?.type ? titleCase(dashboard.simulation.active_scenario.type) : "Awaiting API"}</span></div>
          {error && <div className="global-error" role="status"><span>{error}</span><button className="text-button" type="button" onClick={() => void refresh()}>Retry connection</button></div>}
          <main className="page-content">{children}</main>
          <footer className="app-footer"><span>PlantGuard AI · Physics-aware quality intelligence</span><span>Demonstration data only · validate with qualified operators</span></footer>
        </div>

        {searchOpen && (
          <div className="search-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSearch() }}>
            <section id="global-search-dialog" ref={searchDialogRef} className="search-dialog" role="dialog" aria-modal="true" aria-label="Global search">
          <div className="search-input-wrap"><Icon name="search" /><input ref={searchInputRef} value={search} onChange={(event) => { setSearch(event.target.value); setSearchIndex(0) }} placeholder="Search pages and current demo data…" aria-label="Search pages and current demo data" /><kbd>ESC</kbd></div>
              <p className="search-group-label">PAGES & CURRENT DATA</p>
              <div className="search-results" role="listbox" aria-label="Search results">
                {searchResults.map((result, index) => (
                  <button className={`search-result ${searchIndex === index ? "selected" : ""}`} key={`${result.href}:${result.label}`} type="button" role="option" aria-selected={searchIndex === index} onMouseEnter={() => setSearchIndex(index)} onClick={() => chooseResult(result.href)}>
                    <span className="search-result-icon"><Icon name={result.icon} /></span><span><strong>{result.label}</strong><small>{result.detail}</small></span><Icon className="search-result-arrow" name="arrow" />
                  </button>
                ))}
                {!searchResults.length && <p className="search-empty">No matching pages or current demo data.</p>}
              </div>
              <div className="search-foot"><span>Use ↑ ↓ to navigate · Enter to open</span><span>PlantGuard AI</span></div>
            </section>
          </div>
        )}
      </div>
    </ThemeContext.Provider>
  )
}
