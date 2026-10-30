import { B2B_DAILY_TARGET, B2B_SOURCE_LABEL, weekAverage, type B2bDay, type B2bSource } from '@/lib/outreach/b2b-leads'
import { Tile } from '@/components/admin/OutreachParts'

const SOURCES = Object.keys(B2B_SOURCE_LABEL) as B2bSource[]
const short = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** Admin → CRM → Outreach: organizations reaching out each day, against the goal of 3 to 5 a day. */
export function B2bLeadsPanel({ days }: { days: B2bDay[] }) {
  const today = days[days.length - 1]
  const yesterday = days[days.length - 2]
  const avg = weekAverage(days)
  const { low, high } = B2B_DAILY_TARGET
  return (
    <section className="space-y-3" aria-labelledby="b2b-leads">
      <div>
        <h2 id="b2b-leads" className="text-lg font-semibold tracking-tight">B2B leads a day</h2>
        <p className="mt-1 text-sm text-muted-foreground">Organizations reaching out: interested replies to our emails, page claims, employer statements with a verified work email, search requests and audit requests. Goal: {low} to {high} a day.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Today so far" value={String(today?.total ?? 0)} sub={`goal ${low} to ${high}`} />
        <Tile label="Yesterday" value={String(yesterday?.total ?? 0)} sub={(yesterday?.total ?? 0) >= low ? 'on goal' : `${low - (yesterday?.total ?? 0)} short of ${low}`} />
        <Tile label="Last 7 days, per day" value={avg.toFixed(1)} sub={avg >= low ? 'on goal' : `${(low - avg).toFixed(1)} short of ${low}`} />
        <Tile label="Last 14 days" value={String(days.reduce((n, d) => n + d.total, 0))} sub="all kinds" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr><th className="p-3">Kind</th>{days.map((d) => <th key={d.date} className="p-2 text-right font-normal">{short(d.date)}</th>)}</tr>
          </thead>
          <tbody>
            {SOURCES.map((s) => (
              <tr key={s} className="border-t border-border">
                <td className="p-3">{B2B_SOURCE_LABEL[s]}</td>
                {days.map((d) => <td key={d.date} className="p-2 text-right tabular-nums">{d.bySource[s] || <span className="text-muted-foreground">·</span>}</td>)}
              </tr>
            ))}
            <tr className="border-t border-border font-medium">
              <td className="p-3">All</td>
              {days.map((d) => <td key={d.date} className="p-2 text-right tabular-nums">{d.total}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
