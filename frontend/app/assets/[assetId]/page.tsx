import { AssetDetailPage } from "@/components/section-pages"

export default async function Page({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params
  return <AssetDetailPage assetId={assetId} />
}
