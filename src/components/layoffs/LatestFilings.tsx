import { TrackedLink } from '@/components/marketing/TrackedLink'
import { noticeDay, type PublicNotice } from '@/lib/warn/layoff-pages'
import { stateName } from '@/lib/seo/states'

const SHOWN = 5

/** The date a notice is known by: when it was filed, or (a state that publishes only the effective date) when it takes effect. */
export function filingDateLabel(n: Pick<PublicNotice, 'noticeDate' | 'noticeDateKnown' | 'effectiveDate'>): string {
  if (n.noticeDateKnown) return `Filed ${noticeDay(n.noticeDate)}`
  return n.effectiveDate ? `Effective ${noticeDay(n.effectiveDate)}` : noticeDay(n.noticeDate)
}

/**
 * The answer to "is this employer laying off, and what do the filings say?": the newest state filings with date, place, workers
 * and a link to the state's own record, in the page's HTML near the top. It reads only the notices the page already loaded.
 */
export function LatestFilings({ name, slug, notices, lastUpdated }: { name: string; slug: string; notices: PublicNotice[]; lastUpdated: string }) {
  const newest = [...notices].sort((a, b) => b.noticeDate.getTime() - a.noticeDate.getTime()).slice(0, SHOWN)
  if (newest.length === 0) return null
  return (
    <div className="mt-6">
      <h3 className="text-base font-semibold text-navy">Latest filings by {name}</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">The {newest.length} newest layoff filings by {name}, as of {lastUpdated}</caption>
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="py-2 pr-4 font-medium">Date</th>
              <th scope="col" className="py-2 pr-4 font-medium">Where</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Workers</th>
              <th scope="col" className="py-2 pr-4 font-medium">Takes effect</th>
              <th scope="col" className="py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {newest.map((n) => (
              <tr key={n.id} className="border-t border-border">
                <td className="py-2 pr-4 whitespace-nowrap">{filingDateLabel(n)}</td>
                <td className="py-2 pr-4">{[n.city ?? n.place, stateName(n.state)].filter(Boolean).join(', ')}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{n.workers != null ? n.workers.toLocaleString('en-US') : 'Not stated'}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{n.noticeDateKnown && n.effectiveDate ? noticeDay(n.effectiveDate) : '—'}</td>
                <td className="py-2 whitespace-nowrap">
                  {n.sourceUrl ? (
                    <TrackedLink href={n.sourceUrl} event="layoff_source_clicked" properties={{ noticeId: n.id, state: n.state, company: slug, page: 'company-latest' }} className="text-brand underline underline-offset-4">
                      {stateName(n.state)} record
                    </TrackedLink>
                  ) : (
                    `${stateName(n.state)} record`
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notices.length > newest.length && <p className="mt-2 text-xs text-muted-foreground">{notices.length - newest.length} older {notices.length - newest.length === 1 ? 'filing is' : 'filings are'} in the full list below.</p>}
    </div>
  )
}
