import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { SegmentCutView, SegmentHubView } from '@/components/segments/SegmentViews'
import { canonical } from '@/lib/seo/canonical'
import { titleMeta } from '@/lib/seo/title'
import { editionLabel } from '@/lib/rankings/build-edition'
import { isEdition } from '@/lib/rankings/store'
import { publishedCuts } from '@/lib/segments/aggregate'
import { cutById, cutSentence, segmentPath } from '@/lib/segments/cuts'
import { loadSegmentPage, loadSoonSegment, readSegmentIndex } from '@/lib/segments/page-data'

// The second address part is a list ("top-employers") or a month ("2026-11"): a month shows that month's page for the segment,
// the newest month redirecting nowhere (it is the same page as the segment's own address, marked as such).
export const revalidate = 21600
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

type P = { params: Promise<{ segment: string; cut: string }> }

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { segment, cut } = await params
  const missing: Metadata = { title: 'Jobs not found', robots: { index: false, follow: true } }
  if (isEdition(cut)) {
    const d = await loadSegmentPage(segment, cut).catch(() => null)
    if (!d) return missing
    return { title: titleMeta(`${d.def.name} jobs, ${editionLabel(cut)}`), description: `${d.def.name} jobs in ${editionLabel(cut)}: employers hiring, pay and skills.`, ...canonical(d.newest ? `/jobs/industry/${segment}` : `/jobs/industry/${segment}/${cut}`) }
  }
  const c = cutById(cut)
  const d = await loadSegmentPage(segment).catch(() => null)
  if (!c || !d || !publishedCuts(d.e).includes(c.id)) return missing
  return { title: titleMeta(c.title(d.def)), description: cutSentence(d.def, c.id, d.e), ...canonical(`/jobs/industry/${segment}/${cut}`) }
}

export default async function SegmentCutPage({ params }: P) {
  const { segment, cut } = await params
  const index = await readSegmentIndex().catch(() => [])
  if (isEdition(cut)) {
    const data = await loadSegmentPage(segment, cut).catch(() => null)
    if (!data) notFound()
    return <SegmentHubView data={data} index={index} />
  }
  const c = cutById(cut)
  const data = await loadSegmentPage(segment).catch(() => null)
  if (!c || !data || !publishedCuts(data.e).includes(c.id)) {
    // A real segment whose list is not published (too little stated pay, say) goes to the segment's page, not a 404.
    if (data || (await loadSoonSegment(segment).catch(() => null))) redirect(segmentPath(segment))
    notFound()
  }
  return <SegmentCutView data={data} cut={c.id} index={index} />
}
