import Link from 'next/link'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { H2 } from '@/components/seo/SeoPage'
import { awardTier, familyLists, groupByMonth, viewAwards, type AwardMonth } from '@/lib/rankings/awards'
import { getAwards, readRankingIndex } from '@/lib/rankings/store'
import { functionByName, functionPath } from '@/lib/seo/topics'

// The cross-references that tie a page to the monthly rankings. A place (city or county) shows where it placed each month
// ("October 2026: #4 for junior jobs; September 2026: #3 ..."); a job family shows the lists about it. Used on place, job,
// employer, salary, job-title, function and top-employers pages. Renders nothing when a page has neither.

const TIER = {
  podium: 'bg-tint-sun text-tint-sun-ink',
  top10: 'bg-tint-mint text-tint-mint-ink',
  top25: 'bg-tint-sky text-navy',
} as const

const SHOWN_MONTHS = 3
const PER_MONTH = 6

function Month({ m, surface, entityKey }: { m: AwardMonth; surface: string; entityKey: string }) {
  return (
    <div className="rounded-xl bg-white/80 p-4">
      <h3 className="text-sm font-semibold text-navy">{m.month}</h3>
      <ul className="mt-2 space-y-1.5 text-sm">
        {m.items.slice(0, PER_MONTH).map((a) => (
          <li key={a.slug} className="flex items-baseline gap-2">
            <span className={`inline-flex min-w-[2.5rem] shrink-0 justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${TIER[awardTier(a.rank)]}`}>#{a.rank}</span>
            <TrackedLink href={a.href} event="ranking_award_clicked" properties={{ surface, entityKey, slug: a.slug, edition: a.edition, rank: a.rank }} className="text-brand underline underline-offset-4">{a.title}</TrackedLink>
            <span className="text-xs text-muted-foreground">{a.valueLabel} · of {a.places}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export async function RankingContext({ places = [], fn, surface, id = 'ranks' }: {
  /** Places to look for, best first; the first with a placing is shown. `keys` are the ways it is stored: a city "ST|city" in each spelling, a county FIPS. */
  places?: { name: string; keys: string[] }[]
  /** The job family as postings name it ("Data & Analytics"). */
  fn?: string | null
  /** Where the block sits, for the click event ("job", "employer", "place"). */
  surface: string
  id?: string
}) {
  const index = await readRankingIndex().catch(() => [])
  let months: AwardMonth[] = []
  let place: { name: string; keys: string[] } | undefined
  for (const candidate of places.slice(0, 4)) {
    const found = groupByMonth(viewAwards(await getAwards(candidate.keys).catch(() => []), index))
    if (found.length) { months = found; place = candidate; break }
  }
  const fnTopic = fn ? functionByName(fn) : null
  const lists = fn ? familyLists(index, fn) : []
  if (!months.length && !lists.length) return null
  const entityKey = place?.keys[0] ?? ''
  return (
    <section aria-labelledby={id} className="mt-10 rounded-3xl border border-border bg-tint-sky p-5 sm:p-7">
      <h2 id={id} className={H2}>{months.length ? `Where ${place?.name ?? 'this place'} ranks` : `${fnTopic?.name ?? fn} jobs in the rankings`}</h2>
      {months.length > 0 && (
        <>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Where {place?.name ?? 'it'} placed in our monthly rankings, month by month. Each month stays online at its own address.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {months.slice(0, SHOWN_MONTHS).map((m) => <Month key={m.edition} m={m} surface={surface} entityKey={entityKey} />)}
          </div>
          {months.length > SHOWN_MONTHS && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-navy">Earlier months ({months.length - SHOWN_MONTHS})</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {months.slice(SHOWN_MONTHS).map((m) => <Month key={m.edition} m={m} surface={surface} entityKey={entityKey} />)}
              </div>
            </details>
          )}
        </>
      )}
      {lists.length > 0 && (
        <div className={months.length ? 'mt-6' : 'mt-4'}>
          <h3 className="text-sm font-semibold text-navy">Rankings about {fnTopic?.name.toLowerCase() ?? fn?.toLowerCase()} jobs</h3>
          <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {lists.map((x) => (
              <li key={x.slug}>
                <TrackedLink href={`/rankings/${x.slug}`} event="ranking_family_link_clicked" properties={{ surface, fn, slug: x.slug }} className="text-brand underline underline-offset-4">{x.title}</TrackedLink>{' '}
                <span className="text-xs text-muted-foreground">#1 {x.topName} ({x.topValueLabel})</span>
              </li>
            ))}
          </ul>
          {fnTopic && (
            <p className="mt-3 text-sm text-muted-foreground">
              <Link href={functionPath(fnTopic.name)} className="underline underline-offset-4">{fnTopic.name} jobs</Link>
              {' · '}
              <Link href={`/top-employers/${fnTopic.slug}`} className="underline underline-offset-4">Top {fnTopic.name} employers</Link>
              {' · '}
              <Link href="/rankings" className="underline underline-offset-4">All rankings</Link>
            </p>
          )}
        </div>
      )}
    </section>
  )
}
