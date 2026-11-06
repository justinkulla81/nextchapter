import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { loadPortalUsage } from '@/lib/admin/portal-usage'
import { stuckPages, type PageStat } from '@/lib/admin/portal-usage-analysis'
import { AverageBarChart } from '@/components/admin/AverageBarChart'
import { hourLabel } from '@/lib/admin/visitor-time-buckets'

export const maxDuration = 30

const WINDOW_DAYS = 30

const pct = (n: number) => `${Math.round(n * 100)}%`

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      {note && <p className="mb-3 mt-1 text-xs text-muted-foreground">{note}</p>}
      {children}
    </section>
  )
}

function PageTable({ rows, empty }: { rows: PageStat[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1 pr-2 font-normal">Page</th>
            <th className="py-1 pr-2 text-right font-normal">Views</th>
            <th className="py-1 pr-2 text-right font-normal">Members</th>
            <th className="py-1 pr-2 text-right font-normal">Visits ending here</th>
            <th className="py-1 pr-2 text-right font-normal">One-page visits</th>
            <th className="py-1 text-right font-normal">Visits that looped</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.page} className="border-t border-border">
              <td className="max-w-xs break-all py-1 pr-2">{p.page}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{p.views}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{p.members}</td>
              <td className="py-1 pr-2 text-right tabular-nums">
                {p.exits} <span className="text-muted-foreground">({pct(p.exitRate)})</span>
              </td>
              <td className="py-1 pr-2 text-right tabular-nums">{p.bounces}</td>
              <td className="py-1 text-right tabular-nums">{p.loops}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function AdminPortalUsagePage() {
  await requireAdmin()
  const { usage, truncated } = await loadPortalUsage(WINDOW_DAYS)
  const hours = (counts: number[], days: number) => counts.map((c, h) => ({ label: hourLabel(h), average: days ? c / days : 0 }))
  const stuck = stuckPages(usage.pages).slice(0, 15)
  const topPages = usage.pages.slice(0, 20)
  const hourSeries = [
    { label: 'Weekdays', color: 'var(--color-brand)', buckets: hours(usage.startsByHour.weekday, usage.dayCounts.weekday) },
    { label: 'Weekends', color: 'var(--color-navy)', buckets: hours(usage.startsByHour.weekend, usage.dayCounts.weekend) },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Member portal usage</h1>
        <p className="mt-1 text-muted-foreground">
          How candidates use the logged-in portal, last {WINDOW_DAYS} days: {usage.members} members, {usage.visits} visits, {usage.pageViews} page views. A visit is one
          member&apos;s run of pages with no gap over 30 minutes. Seeded sample accounts are left out.{' '}
          <Link href="/support/admin/visitors" className="text-primary underline underline-offset-4">
            Back to Visitors
          </Link>
        </p>
        {truncated && <p className="mt-1 text-sm text-muted-foreground">The most recent 300,000 page views are shown; older ones in the window are cut off.</p>}
      </div>

      <Section
        title="Where members get stuck"
        note="Pages with at least 10 visits, ranked by how often a visit ends there after other pages. Ending is not proof of trouble (a member who finished a task also stops), but a page far above the rest, or one that members open three or more times in one visit, is where to look first."
      >
        <PageTable rows={stuck} empty="No page has enough visits yet." />
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Pages per visit" note={`Average ${usage.pagesPerVisit.average.toFixed(1)}, median ${usage.pagesPerVisit.median}. ${pct(usage.oneVisitShare)} of visits are a single page.`}>
          {usage.visits === 0 ? (
            <p className="text-sm text-muted-foreground">No portal visits in this window yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {usage.depth.map((d) => (
                  <tr key={d.label} className="border-t border-border first:border-t-0">
                    <td className="py-1 pr-2">{d.label}</td>
                    <td className="w-full py-1 pr-2">
                      <div className="h-2 rounded bg-brand" style={{ width: `${usage.visits ? (d.visits / usage.visits) * 100 : 0}%` }} />
                    </td>
                    <td className="py-1 pr-2 text-right tabular-nums">{d.visits}</td>
                    <td className="py-1 text-right tabular-nums text-muted-foreground">{pct(usage.visits ? d.visits / usage.visits : 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Time of day" note="Visits started per hour, average per day, Eastern time.">
          <AverageBarChart series={hourSeries} labelEvery={3} unit="visits per hour" emptyMessage="No portal visits in this window yet." />
        </Section>
      </div>

      <Section title="What members use" note="Most viewed portal pages. Record ids are grouped (:id).">
        <PageTable rows={topPages} empty="No portal page views in this window yet." />
      </Section>

      <Section title="What one-page visits looked at" note="Members who opened a single page and left, by that page.">
        {usage.bounceLandings.length === 0 ? (
          <p className="text-sm text-muted-foreground">None in this window.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {usage.bounceLandings.slice(0, 10).map((b) => (
                <tr key={b.page} className="border-t border-border first:border-t-0">
                  <td className="break-all py-1 pr-2">{b.page}</td>
                  <td className="py-1 text-right tabular-nums">{b.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  )
}
