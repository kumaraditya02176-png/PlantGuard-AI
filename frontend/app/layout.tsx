import "./globals.css"
import { AppProvider } from "@/components/app-provider"
import { AppShell } from "@/components/app-shell"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: {
    default: "PlantGuard AI | Quality Intelligence",
    template: "%s | PlantGuard AI",
  },
  description: "Simulation-only process quality intelligence across six manufacturing industry modules.",
  icons: { icon: "/icon.svg" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  )
}
