import { StructuredData } from '@/components/StructuredData'
import type { LayoffTrackerData } from '@/lib/warn/public-tracker'

const SITE = 'https://launchyournextchapter.com'

/**
 * The public layoff tracker: recent WARN notices, with three numbers on top.
 *
 * Plain numbers and a table rather than a chart — the questions are "how
 * many, where, who", and each row links to the state record it came from so
 * anyone citing it can check it. The notes underneath say what the list
 * does and does not cover, because the totals are only as complete as the
 * states that publish.
 */
export function LayoffTracker({ data }: { data: LayoffTrackerData }) {
  const stat = (value: string, label: string) => (
    <div className="rounded-xl border border-border bg-white p-5">
      <p className="text-3xl font-bold tabular-nums text-navy">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  )
  return (
    <section id="layoff-tracker" aria-labelledby="layoff-tracker-heading" className="scroll-mt-6">
      <StructuredData data={{
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: 'NextChapter Layoff Tracker: WARN notices by state',
        description: `Layoff and plant-closing notices filed under the WARN Act with US state labor departments, collected weekly from each state's public record, with layoffs reported elsewhere where no filing exists. ${data.total.notices.toLocaleString()} layoffs from ${data.total.states} states since ${data.total.since}.`,
        url: `${SITE}/news#layoff-tracker`,
        creator: { '@type': 'Organization', name: 'NextChapter', url: SITE },
        isAccessibleForFree: true,
        spatialCoverage: 'United States',
        keywords: ['layoffs', 'WARN notices', 'WARN Act', 'mass layoffs', 'plant closings'],
      }} />

      <h2 id="layoff-tracker-heading" className="text-3xl font-bold tracking-tight text-navy">Layoff tracker</h2>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Layoff notices employers have filed with state labor departments under the WARN Act, collected each week from the
        states&apos; own public records, plus layoffs reported elsewhere where no state filing covers them.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {stat(data.last30.notices.toLocaleString(), 'layoffs filed or reported in the last 30 days')}
        {stat(data.last30.workers.toLocaleString(), 'workers affected')}
        {stat(String(data.last30.states), 'states with a layoff in the last 30 days')}
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">The most recent layoff notices, newest first</caption>
          <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Date</th>
              <th scope="col" className="px-4 py-3 font-medium">Employer</th>
              <th scope="col" className="px-4 py-3 font-medium">State</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Workers</th>
              <th scope="col" className="px-4 py-3 font-medium">Takes effect</th>
              <th scope="col" className="px-4 py-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.rows.map((r) => (
              <tr key={r.key}>
                <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted-foreground">{r.noticeDate}</td>
                <th scope="row" className="px-4 py-3 font-medium text-navy">
                  {r.employer}
                  {(r.type || r.sites > 1) && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {[r.type, r.sites > 1 ? `${r.sites} sites` : null].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </th>
                <td className="px-4 py-3 whitespace-nowrap">
                  {r.state}
                  {r.county && <span className="block text-xs text-muted-foreground">{r.county}</span>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{r.workers != null ? r.workers.toLocaleString() : '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted-foreground">{r.effectiveDate ?? '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {r.sourceUrl
                    ? <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{r.sourceLabel}</a>
                    : r.sourceLabel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 max-w-3xl space-y-2 text-sm text-muted-foreground">
        <p>
          Showing the {data.rows.length} most recent of {data.total.notices.toLocaleString()} layoffs from {data.total.states} states
          since {data.total.since}.{data.updatedLabel && ` Last updated ${data.updatedLabel}.`}
        </p>
        <p>
          What this covers: notices a state has published online, marked “State record”, and layoffs reported by{' '}
          <a href="https://layoffs.fyi" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">layoffs.fyi</a>{' '}
          or in the press, marked with their source, where the same employer has no state filing within 45 days. Not every
          state publishes its notices, some publish weeks late, and some leave out the number of workers, so the totals are
          a floor rather than a count of every layoff. The WARN Act generally applies to employers with 100 or more workers.
        </p>
        <p>
          Free to cite with a link to <span className="font-medium text-foreground">launchyournextchapter.com/news#layoff-tracker</span>.
        </p>
      </div>
    </section>
  )
}
