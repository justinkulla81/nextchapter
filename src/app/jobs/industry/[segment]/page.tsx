import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SegmentHubView, SegmentSoonView } from '@/components/segments/SegmentViews'
import { canonical } from '@/lib/seo/canonical'
import { titleMeta } from '@/lib/seo/title'
import { count, usdK } from '@/lib/segments/aggregate'
import { loadSegmentPage, loadSoonSegment, readSegmentIndex } from '@/lib/segments/page-data'

export const revalidate = 21600
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ segment: string }> }): Promise<Metadata> {
  const { segment } = await params
  const d = await loadSegmentPage(segment).catch(() => null)
  if (!d) {
    // A known segment with no published lists yet: a page that is kept out of search results until it has some.
    const soon = await loadSoonSegment(segment).catch(() => null)
    if (!soon) return { title: 'Jobs not found', robots: { index: false, follow: true } }
    return { title: titleMeta(`${soon.def.name} jobs: lists coming soon`), robots: { index: false, follow: true }, ...canonical(`/jobs/industry/${segment}`) }
  }
  return {
    title: titleMeta(`${d.def.name} jobs: employers hiring, pay and skills`),
    description: `${count(d.e.total)} open ${d.def.label} jobs in the US${d.e.payMed ? `, median stated pay ${usdK(d.e.payMed)}` : ''}. The employers hiring most, the highest-paying roles, the skills asked for and the newest jobs.`,
    ...canonical(`/jobs/industry/${segment}`),
  }
}

export default async function SegmentPage({ params }: { params: Promise<{ segment: string }> }) {
  const { segment } = await params
  const data = await loadSegmentPage(segment).catch(() => null)
  const index = await readSegmentIndex().catch(() => [])
  if (data) return <SegmentHubView data={data} index={index} />
  const soon = await loadSoonSegment(segment).catch(() => null)
  if (!soon) notFound()
  return <SegmentSoonView def={soon.def} found={soon.found} index={index} />
}
