import type { SVGProps } from "react"

const paths: Record<string, string> = {
  overview: "M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z",
  assets: "M4 5h16v14H4z M8 9h8 M8 13h5 M8 17h8",
  telemetry: "M3 12h4l3-8 4 16 3-8h4",
  analytics: "M4 19V5m0 14h17 M8 16v-5m5 5V7m5 9V3",
  alerts: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
  advisory: "M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7l-8-4Zm-3 9 2 2 4-4",
  workflows: "M6 4h12v5H6z M6 15h12v5H6z M12 9v6 M9 12l3 3 3-3",
  simulation: "M4 5h16v14H4z M8 9l8 3-8 3V9Z",
  roi: "M4 18 9 12l4 3 7-9 M15 6h5v5",
  reports: "M6 3h9l4 4v14H6z M15 3v5h5 M9 12h7 M9 16h7",
  integrations: "M8 8V5a3 3 0 0 1 6 0v3 M7 8h10v5a5 5 0 0 1-10 0V8Zm5 10v3",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M3 12h2m14 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  search: "M20 20l-4.5-4.5 M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
  chevron: "m7 10 5 5 5-5",
  collapse: "m14 5-7 7 7 7",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  refresh: "M20 7v5h-5 M4 17v-5h5 M5 9a7 7 0 0 1 12-2l3 5 M4 12l3 5a7 7 0 0 0 12-2",
  download: "M12 3v12m-5-5 5 5 5-5 M4 17v4h16v-4",
  activity: "M3 12h4l3-8 4 16 3-8h4",
}

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d={paths[name] ?? paths.overview} />
    </svg>
  )
}
