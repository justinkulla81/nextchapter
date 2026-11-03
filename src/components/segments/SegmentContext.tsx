import { TrackedLink } from '@/components/marketing/TrackedLink'
import { H2 } from '@/components/seo/SeoPage'
import { awardTier } from '@/lib/rankings/awards'
import { editionLabel } from '@/lib/rankings/build-edition'
import { CUTS, cutPath, segmentPath } from '@/lib/segments/cuts'
import { companyKey, segmentBySlug } from '@/lib/segments/defs'
import { getSegmentAwards, readSegmentIndex } from '@/lib/segments/store'

const TIER = {
  podium: 'bg-tint-sun text-tint-sun-ink',
  top10: 'bg-tint-mint text-tint-mint-ink',
  top25: 'bg-tint-sky text-navy',
} as const

const SHOWN_MONTHS = 3

/**
 * Where an employer places in the industry job lists ("#3 for most open defense jobs, November 2026"), each linking to its
 * list; the lists link back to the employer's page. Renders nothing when the employer is in no list or a read fails.
 */
export async function SegmentContext({ employerName, surface = 'employer' }: { employerName: string; surface?: string }) {
  const key = `emp:${companyKey(employerName)}`
  const [awards, index] = await Promise.all([getSegmentAwards([key]).catch(() => []), readSegmentIndex().catch(() => [])])
  const latest = new Map(index.map((x) => [x.slug, x.editions[0]]))
  const months = new Map<string, { slug: string; cut: string; rank: number; valueLabel: string; places: number; edition: string }[]>()
  for (const a of awards) {
    const [slug, cut] = a.slug.split('/')
    if (!segmentBySlug(slug) || !CUTS.some((c) => c.id === cut)) continue
    months.set(a.edition, [...(months.get(a.edition) ?? []), { slug, cut, rank: a.rank, valueLabel: a.valueLabel, places: a.places, edition: a.edition }])
  }
  const ordered = [...months].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, SHOWN_MONTHS)
  if (!ordered.length) return null
  return (
    <section aria-labelledby="industry-lists" className="mt-10 rounded-3xl border border-border bg-tint-sky p-5 sm:p-7">
      <h2 id="industry-lists" className={H2}>{employerName} in the industry job lists</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Where {employerName} places in our weekly lists of the employers hiring in each industry, kept month by month.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {ordered.map(([edition, items]) => (
          <div key={edition} className="rounded-xl bg-white/80 p-4">
            <h3 className="text-sm font-semibold text-navy">{editionLabel(edition)}</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {items.sort((a, b) => a.rank - b.rank).slice(0, 6).map((a) => {
                const def = segmentBySlug(a.slug)!
                const cut = CUTS.find((c) => c.id === a.cut)!
                const href = edition === latest.get(a.slug) ? cutPath(a.slug, cut.id) : `${segmentPath(a.slug)}/${edition}`
                return (
                  <li key={`${a.slug}${a.cut}`} className="flex items-baseline gap-2">
                    <span className={`inline-flex min-w-[2.5rem] shrink-0 justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${TIER[awardTier(a.rank)]}`}>#{a.rank}</span>
                    <TrackedLink href={href} event="segment_award_clicked" properties={{ surface, segment: a.slug, cut: a.cut, edition, rank: a.rank }} className="text-brand underline underline-offset-4">{cut.title(def)}</TrackedLink>
                    <span className="text-xs text-muted-foreground">{a.valueLabel} · of {a.places}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
