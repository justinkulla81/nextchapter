import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { stateName } from '@/lib/seo/states'
import { loadLagByState } from '@/lib/warn/lag'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

const days = (n: number) => (n < 1 ? 'same day' : `${n.toFixed(n < 10 ? 1 : 0)} days`)

export default async function LayoffTimingPage() {
  await requireAdmin()
  const rows = await loadLagByState().catch(() => null)
  const total = rows?.reduce((s, r) => s + r.notices, 0) ?? 0
  const overall = rows && total ? rows.reduce((s, r) => s + r.medianDays * r.notices, 0) / total : null

  return (
    <div className="space-y-6">
      <div>
        <Link href="/support/admin/crm/warn" className="text-sm text-primary underline underline-offset-4">Back to WARN notices</Link>
        <h1 className="mt-2 text-2xl font-semibold">How soon a layoff reaches our site</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          For each state: the days between the date on the filing and the day we first stored it, for filings in the last 90 days. This includes any delay at the state itself, because we do not record when a state posted a notice, so it cannot show how far we run behind a state. It is the number we can honestly quote, as &quot;on our site a median of N days after the filing date&quot;. We do not claim to be first or fastest.
        </p>
      </div>

      {rows === null ? (
        <p className="text-sm">The numbers could not be loaded just now. Try again in a minute.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm">Not enough filings yet.</p>
      ) : (
        <>
          <p className="text-sm">{overall !== null ? <>Across {total.toLocaleString()} filings, the typical state sits at a median of <strong>{days(overall)}</strong>.</> : null}</p>
          <div className="overflow-x-auto">
            <table className="w-full max-w-3xl text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-2 pr-4">State</th><th className="py-2 pr-4">Filings</th><th className="py-2 pr-4">Median</th><th className="py-2 pr-4">Slowest 10%</th><th className="py-2 pr-4">Within a day</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.state} className="border-t border-border">
                    <td className="py-2 pr-4">{stateName(r.state)}</td>
                    <td className="py-2 pr-4 tabular-nums">{r.notices.toLocaleString()}</td>
                    <td className="py-2 pr-4 tabular-nums">{days(r.medianDays)}</td>
                    <td className="py-2 pr-4 tabular-nums">{days(r.p90Days)}</td>
                    <td className="py-2 pr-4 tabular-nums">{Math.round(r.withinOneDay * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="max-w-3xl text-xs text-muted-foreground">States with fewer than three filings in the window are left out. A state that publishes only an effective date (Pennsylvania) shows a lag that is not comparable.</p>
        </>
      )}
    </div>
  )
}
