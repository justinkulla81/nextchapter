import { LAYOFF_TERMS } from '@/lib/warn/layoff-definitions'
import type { LayoffCounts } from '@/lib/warn/layoff-counts'

// "How these numbers fit together": the definitions in one place, with the live counts and an as-of date, so the number on
// /layoffs and the number on /data can be read against each other and cited.
export function LayoffNumbersNote({ counts, className }: { counts: LayoffCounts | null; className?: string }) {
  return (
    <section aria-labelledby="how-we-count" className={className ?? 'mt-12 rounded-xl border border-border bg-white p-6'}>
      <h2 id="how-we-count" className="text-xl font-semibold tracking-tight text-navy">How we count</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Every figure on the layoff pages uses one of these units, and says which. The counts below come from the same rows as the tables and the downloadable file{counts ? `, as of ${counts.asOf}` : ''}.
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {LAYOFF_TERMS.map((t) => (
          <div key={t.key} className="rounded-lg bg-off-white p-3 text-sm">
            <dt className="font-semibold text-navy">{t.term}</dt>
            <dd className="mt-1 text-muted-foreground">{t.definition}</dd>
          </div>
        ))}
      </dl>
      {counts && (
        <table className="mt-5 w-full max-w-3xl text-sm">
          <caption className="pb-1 text-left text-xs text-muted-foreground">Counts, same rows, different units</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-1 font-normal">What</th>
              <th className="pb-1 text-right font-normal">Count</th>
              <th className="pb-1 text-right font-normal">Workers named</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="py-1.5">Filings, last 24 months{counts.filings.since ? ` (since ${counts.filings.since})` : ''}: the downloadable file</td>
              <td className="py-1.5 text-right tabular-nums">{counts.filings.count.toLocaleString('en-US')}</td>
              <td className="py-1.5 text-right tabular-nums">{counts.filings.workers.toLocaleString('en-US')}</td>
            </tr>
            <tr className="border-t">
              <td className="py-1.5">Layoffs in {counts.layoffsYear.year}: state filings and reported layoffs with a U.S. state, once per employer, state and date</td>
              <td className="py-1.5 text-right tabular-nums">{counts.layoffsYear.layoffs.toLocaleString('en-US')}</td>
              <td className="py-1.5 text-right tabular-nums">{counts.layoffsYear.workers.toLocaleString('en-US')}</td>
            </tr>
            <tr className="border-t">
              <td className="py-1.5">Of the layoffs above, rows from the press or layoffs.fyi (raw rows, before grouping)</td>
              <td className="py-1.5 text-right tabular-nums">{counts.reportedYear.count.toLocaleString('en-US')}</td>
              <td className="py-1.5 text-right tabular-nums">{counts.reportedYear.workers.toLocaleString('en-US')}</td>
            </tr>
            <tr className="border-t">
              <td className="py-1.5">Not counted: {counts.layoffsYear.year} announcements with no U.S. state</td>
              <td className="py-1.5 text-right tabular-nums">{counts.notCounted.count.toLocaleString('en-US')}</td>
              <td className="py-1.5 text-right tabular-nums">{counts.notCounted.workers.toLocaleString('en-US')}</td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  )
}
