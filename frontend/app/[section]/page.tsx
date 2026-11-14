import { notFound } from "next/navigation"
import { SectionPage } from "@/components/section-pages"

const sections = new Set(["assets", "telemetry", "analytics", "alerts", "advisory", "workflows", "simulation", "roi", "reports", "integrations", "settings"])

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  if (!sections.has(section)) notFound()
  return <SectionPage section={section} />
}
