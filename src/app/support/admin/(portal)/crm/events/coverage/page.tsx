import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { listEvents } from '@/lib/events/store'
import { INDUSTRIES, TAXONOMY, cellCount } from '@/lib/events/taxonomy'
import { SENIORITIES, SENIORITY_LABEL } from '@/lib/events/types'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'

export const maxDuration = 30

/**
 * The full map: every industry, its segments and the jobs in them, with how many published events
 * cover each. A segment with none is a gap to research. An event with no segment tag counts toward
 * its industry only.
 */
export default async function EventCoveragePage() {
  await requireAdmin()
  let rows: Awaited<ReturnType<typeof listEvents>> = []
  let missing = false
  try {
    rows = await listEvents()
  } catch {
    missing = true
  }
  const live = rows.filter((r) => r.published)
  const inSegment = (seg: string) => live.filter((r) => r.segments.includes(seg))
  const empty = INDUSTRIES.flatMap((i) => Object.keys(TAXONOMY[i]).filter((s) => inSegment(s).length === 0)).length
  const tone = (n: number) => (n === 0 ? 'text-red-700 dark:text-red-400' : n < 3 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400')

  return (
    <div className="space-y-6">
      <header>
        <Link href="/support/admin/crm/events" className="text-sm text-muted-foreground hover:underline">All events</Link>
        <h1 className="text-2xl font-semibold">Events coverage map</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {live.length} published events across {INDUSTRIES.length} industries and {cellCount} segments. {empty} segments have no published event yet (red), and amber ones have fewer than three.
          Each job under a segment is the specific role the segment is research-checked against.
        </p>
      </header>
      {missing ? (
        <p className="text-sm">The ConferenceEvent tables are not applied yet.</p>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">By function and level</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="p-2">Function</th><th className="p-2">All</th>{SENIORITIES.map((s) => <th key={s} className="p-2">{SENIORITY_LABEL[s]}</th>)}</tr></thead>
                <tbody>
                  {PRIMARY_FUNCTION_OPTIONS.filter((f) => f !== 'General' && f !== 'Other').map((f) => {
                    const mine = live.filter((r) => r.functions.length === 0 || r.functions.includes(f))
                    return (
                      <tr key={f} className="border-b border-border last:border-0">
                        <td className="p-2 font-medium">{f}</td>
                        <td className={`p-2 ${tone(mine.length)}`}>{mine.length}</td>
                        {SENIORITIES.map((s) => { const n = mine.filter((r) => r.seniorities.length === 0 || r.seniorities.includes(s)).length; return <td key={s} className={`p-2 ${tone(n)}`}>{n}</td> })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {INDUSTRIES.map((ind) => {
            const industryRows = live.filter((r) => r.industries.includes(ind))
            return (
              <section key={ind} className="space-y-2">
                <h2 className="text-lg font-semibold">{ind} <span className="text-sm font-normal text-muted-foreground">({industryRows.length} events)</span></h2>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {Object.entries(TAXONOMY[ind]).map(([seg, roles]) => {
                    const n = inSegment(seg).length
                    return (
                      <li key={seg} className="flex flex-wrap items-baseline gap-x-3 p-2.5 text-sm">
                        <span className={`w-8 text-right font-semibold ${tone(n)}`}>{n}</span>
                        <Link href={`/support/admin/crm/events?q=${encodeURIComponent(seg)}`} className="font-medium hover:underline">{seg}</Link>
                        <span className="text-xs text-muted-foreground">{roles.join(', ')}</span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}
