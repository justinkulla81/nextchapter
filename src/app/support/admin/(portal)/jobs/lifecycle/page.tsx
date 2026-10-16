import { requireAdmin } from '@/lib/admin/auth'
import { loadMarketLifecycle, type TimeToCloseRow } from '@/lib/jobs/past-jobs-data'
import { seniorityGroupLabel } from '@/lib/jobs/job-seniority'

// Current vs past jobs across the market (src/lib/jobs/job-status.ts): openings
// opened vs closed per week, median days from posting to the employer taking it
// down, by function and seniority, and how often roles are reposted. All from
// CompanyJobOpening, which keeps every closed opening. Collapsed duplicates are
// left out (they are current jobs). Crawler-side counts per state:
// python3 ~/nextchapter-jobs/repost_groups.py.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const n = (x: number) => x.toLocaleString('en-US')

function TtcTable({ title, rows, label }: { title: string; rows: TimeToCloseRow[]; label: (k: string) => string }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No closed openings yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 font-medium">Group</th>
              <th className="py-1 text-right font-medium">Closed jobs</th>
              <th className="py-1 text-right font-medium">Median days open</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border">
                <td className="py-1">{label(r.key)}</td>
                <td className="py-1 text-right tabular-nums">{n(r.closedJobs)}</td>
                <td className="py-1 text-right tabular-nums">{r.medianDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export default async function JobLifecyclePage() {
  await requireAdmin()
  let data: Awaited<ReturnType<typeof loadMarketLifecycle>> | null = null
  try {
    data = await loadMarketLifecycle()
  } catch (error) {
    console.error('job lifecycle analytics failed', error)
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Open vs closed jobs</h1>
        <p className="text-sm text-muted-foreground">
          Closed = the employer took the listing down. No longer listed = it passed our freshness window (director and above 60 days, others 30).
          Nothing is deleted: the crawler, the board and the company job history keep every job.
        </p>
      </div>
      {!data ? (
        <p className="text-sm text-muted-foreground">Couldn&apos;t load the numbers just now. Refresh the page to try again.</p>
      ) : (
        <>
          <p className="text-sm">
            {n(data.totals.open)} open · {n(data.totals.closed)} closed · {n(data.totals.expired)} no longer listed ·{' '}
            {data.roles > 0 ? `${Math.round((100 * data.repostedRoles) / data.roles)}%` : '—'} of {n(data.roles)} roles posted more than once
          </p>
          <section className="space-y-2">
            <h2 className="text-base font-semibold">By week (last 12)</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Week of</th>
                  <th className="py-1 text-right font-medium">Opened</th>
                  <th className="py-1 text-right font-medium">Closed</th>
                  <th className="py-1 text-right font-medium">No longer listed</th>
                </tr>
              </thead>
              <tbody>
                {data.weeks.map((w) => (
                  <tr key={w.week} className="border-t border-border">
                    <td className="py-1">{w.week}</td>
                    <td className="py-1 text-right tabular-nums">{n(w.opened)}</td>
                    <td className="py-1 text-right tabular-nums">{n(w.closed)}</td>
                    <td className="py-1 text-right tabular-nums">{n(w.expired)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <div className="grid gap-8 md:grid-cols-2">
            <TtcTable title="Time to close by function" rows={data.byFunction} label={(k) => k} />
            <TtcTable title="Time to close by seniority" rows={data.byLevel} label={(k) => seniorityGroupLabel(k) ?? k} />
          </div>
        </>
      )}
    </div>
  )
}
