import Link from 'next/link'
import { industryCountsForNotices } from '@/lib/seo/layoff-industry-links'

/** "By industry" links from a layoff page to the industry pages behind its notices. Renders nothing when none of the notices has an industry page. */
export async function IndustryLayoffLinks({ notices, heading = 'By industry' }: { notices: { id: string; workers: number | null }[]; heading?: string }) {
  const rows = await industryCountsForNotices(notices).catch(() => [])
  if (rows.length === 0) return null
  return (
    <section aria-labelledby="industries" className="mt-10">
      <h2 id="industries" className="text-2xl font-bold tracking-tight text-navy">{heading}</h2>
      <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <li key={r.href}>
            <Link href={r.href} className="flex justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2 hover:border-brand">
              <span className="font-medium text-navy">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">{r.notices} {r.notices === 1 ? 'notice' : 'notices'}{r.workers ? ` · ${r.workers.toLocaleString('en-US')} workers` : ''}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
