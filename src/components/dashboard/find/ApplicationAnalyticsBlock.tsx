import type { ApplicationAnalytics, RateRow } from '@/lib/jobs/application-analytics'
import { MIN_FOR_RATES } from '@/lib/jobs/application-analytics'

// Reply rates under My jobs' "Show more": how many applications went out, how many got a reply, an
// interview or an offer, and where replies come from by job function and level. Counts only; no model.

function RateTable({ caption, rows }: { caption: string; rows: RateRow[] }) {
  if (rows.length === 0) return null
  return (
    <table className="w-full text-sm">
      <caption className="pb-1 text-left text-sm font-semibold text-ink">{caption}</caption>
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th scope="col" className="py-1 font-medium">
            {caption.replace('By ', '').replace(/^./, (c) => c.toUpperCase())}
          </th>
          <th scope="col" className="py-1 text-right font-medium">Applied</th>
          <th scope="col" className="py-1 text-right font-medium">Got a reply</th>
          <th scope="col" className="py-1 text-right font-medium">Interview</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-t border-border">
            <td className="py-1.5 text-ink">{r.label}</td>
            <td className="py-1.5 text-right tabular-nums">{r.applied}</td>
            <td className="py-1.5 text-right tabular-nums">{r.replyRate}%</td>
            <td className="py-1.5 text-right tabular-nums">{r.interviewRate}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ApplicationAnalyticsBlock({ analytics: a }: { analytics: ApplicationAnalytics }) {
  if (a.applied === 0) return null
  return (
    <section aria-labelledby="reply-rates" className="space-y-4 rounded-2xl border border-border p-5">
      <div className="space-y-1">
        <h3 id="reply-rates" className="text-base font-semibold text-ink">
          Reply rates
        </h3>
        <p className="text-sm text-muted-foreground">
          {a.applied} applications, {a.appliedLast7} in the last 7 days and {a.appliedLast30} in the last 30.
          {a.replyRate === null
            ? ` Rates show once you have ${MIN_FOR_RATES} applications.`
            : ` ${a.replyRate}% got a reply (an interview, an offer or a no), ${a.interviewRate}% an interview${a.offerRate !== null ? `, and ${a.offerRate}% of interviews an offer` : ''}.`}
        </p>
      </div>
      {a.replyRate !== null && (
        <div className="grid gap-6 sm:grid-cols-2">
          <RateTable caption="By function" rows={a.byFunction} />
          <RateTable caption="By level" rows={a.byLevel} />
        </div>
      )}
    </section>
  )
}
