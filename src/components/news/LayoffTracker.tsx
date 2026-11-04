import { LayoffTable } from './LayoffTable'
import type { ReactNode } from 'react'
import { StructuredData } from '@/components/StructuredData'
import type { LayoffTrackerData } from '@/lib/warn/public-tracker'
import { monthLabel, type NationalLaborData } from '@/lib/market/bls-national'

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
/** BLS reports in thousands. */
function people(thousands: number): string {
  return thousands >= 1000 ? `${(thousands / 1000).toFixed(2)} million` : `${Math.round(thousands).toLocaleString()},000`
}
function change(now: number, then: number | undefined, unit: 'pct' | 'pts' = 'pct'): string | null {
  if (then == null || then === 0) return null
  if (unit === 'pts') {
    const d = now - then
    return `${d >= 0 ? 'up' : 'down'} ${Math.abs(d).toFixed(1)} points from a year earlier`
  }
  const d = ((now - then) / then) * 100
  return `${d >= 0 ? 'up' : 'down'} ${Math.abs(d).toFixed(0)}% from a year earlier`
}

/**
 * The national picture from BLS, set beside the tracker's own count.
 *
 * WARN filings are the only layoffs with names attached, but they are a
 * small part of all layoffs — most are below the Act's threshold or in
 * states that publish nothing. The BLS figures say how small, and the
 * long-term unemployment numbers say what happens next.
 */
function NationalPicture({ national, trackedWorkers, year, headingLevel }: { national: NationalLaborData; trackedWorkers: number; year: number; headingLevel: 'h2' | 'h3' }) {
  const Heading = headingLevel
  const { layoffs, longTerm, longTermShare, medianWeeks, rate } = national
  const ytd = layoffs?.thisYear.filter((p) => p.year === year).reduce((sum, p) => sum + p.value, 0) ?? 0
  const lastYtdMonth = layoffs?.thisYear.filter((p) => p.year === year).at(-1)
  const share = ytd > 0 ? (trackedWorkers / (ytd * 1000)) * 100 : null
  const tile = (value: string, label: string, note: string | null) => (
    <div className="rounded-xl border border-border bg-white p-5">
      <p className="text-2xl font-bold tabular-nums text-navy">{value}</p>
      <p className="mt-1 text-sm text-foreground">{label}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
  return (
    <div className="mt-12">
      <Heading className="text-xl font-bold tracking-tight text-navy">The national picture</Heading>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        From the Bureau of Labor Statistics, which estimates every layoff and every unemployed person in the country each
        month from its own surveys.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {layoffs && tile(people(layoffs.latest.value), `layoffs and discharges in ${monthLabel(layoffs.latest)}`, change(layoffs.latest.value, layoffs.yearAgo?.value))}
        {longTerm && tile(people(longTerm.latest.value), `people unemployed 27 weeks or more in ${monthLabel(longTerm.latest)}`,
          longTermShare ? `${longTermShare.latest.value.toFixed(1)}% of everyone unemployed${longTermShare.yearAgo ? `, ${change(longTermShare.latest.value, longTermShare.yearAgo.value, 'pts')}` : ''}` : change(longTerm.latest.value, longTerm.yearAgo?.value))}
        {medianWeeks && tile(`${medianWeeks.latest.value.toFixed(1)} weeks`, `median time out of work in ${monthLabel(medianWeeks.latest)}`, change(medianWeeks.latest.value, medianWeeks.yearAgo?.value))}
        {rate && tile(`${rate.latest.value.toFixed(1)}%`, `unemployment rate in ${monthLabel(rate.latest)}`, change(rate.latest.value, rate.yearAgo?.value, 'pts'))}
      </div>
      {layoffs && ytd > 0 && lastYtdMonth && share != null && (
        <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
          BLS estimates {people(ytd)} layoffs and discharges from January to {monthLabel(lastYtdMonth)}. The filings
          and reports in this tracker name {trackedWorkers.toLocaleString()} workers this year — about{' '}
          {share < 1 ? share.toFixed(1) : Math.round(share)}% of that. The rest are layoffs below the WARN Act&apos;s size
          threshold, in states that do not publish their notices, or never announced.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Sources: BLS Job Openings and Labor Turnover Survey (layoffs and discharges) and Current Population Survey
        (unemployment), seasonally adjusted. Survey estimates, revised as BLS publishes.
      </p>
    </div>
  )
}

export function LayoffTracker({ data, national, headingLevel = 'h2', afterStats }: { data: LayoffTrackerData; national?: NationalLaborData | null; headingLevel?: 'h1' | 'h2'; afterStats?: ReactNode }) {
  const Heading = headingLevel
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
        name: 'NextChapter Layoff Tracker: layoff notices by state',
        description: `Layoff and plant-closing notices filed with US state labor departments (under the federal WARN Act), collected daily from each state's public record, with layoffs reported elsewhere where no filing exists. ${data.total.notices.toLocaleString()} layoffs from ${data.total.states} states since ${data.total.since}.`,
        url: `${SITE}/layoffs`,
        creator: { '@type': 'Organization', name: 'NextChapter', url: SITE },
        isAccessibleForFree: true,
        spatialCoverage: 'United States',
        keywords: ['layoffs', 'WARN notices', 'WARN Act', 'mass layoffs', 'plant closings'],
      }} />

      <Heading id="layoff-tracker-heading" className="text-3xl font-bold tracking-tight text-navy">Layoff tracker</Heading>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Layoff notices employers have filed with state labor departments, collected each day from the
        states&apos; own public records, plus layoffs reported elsewhere where no state filing covers them.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {stat(data.year.workers.toLocaleString(), `workers in layoffs filed or reported in ${data.year.year}`)}
        {stat(data.year.layoffs.toLocaleString(), `layoffs filed or reported in ${data.year.year}, in ${data.year.states} states`)}
        <div className="rounded-xl border border-border bg-white p-5 sm:col-span-2">
          <p className="text-sm text-muted-foreground">Last 30 days</p>
          <p className="mt-1 text-2xl font-bold text-navy">
            <span className="tabular-nums">{data.last30.notices.toLocaleString()}</span> layoffs naming{' '}
            <span className="tabular-nums">{data.last30.workers.toLocaleString()}</span> workers
          </p>
        </div>
      </div>

      {afterStats}

      <LayoffTable rows={data.rows} />

      <div className="mt-4 max-w-3xl space-y-2 text-sm text-muted-foreground">
        <p>
          The table lists the {data.rows.length.toLocaleString()} most recent layoffs, including reported ones outside the U.S. The totals above count
          {' '}{data.total.notices.toLocaleString()} U.S. layoffs from {data.total.states} states since {data.total.since}.{data.updatedLabel && ` Last updated ${data.updatedLabel}.`}
        </p>
        <p>
          What this covers: notices a state has published online, marked “State record”, and layoffs reported by{' '}
          <a href="https://layoffs.fyi" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">layoffs.fyi</a>{' '}
          or in the press, marked with their source, where the same employer has no state filing within 45 days. A reported
          layoff that names no U.S. state shows “—” for the state and is listed but not counted in the totals above. Several
          reports of one layoff are shown once, with the number of workers most of them agree on. Not every
          state publishes its notices, some publish weeks late, and some leave out the number of workers, so the totals are
          a floor rather than a count of every layoff. The WARN Act generally applies to employers with 100 or more workers.
        </p>
        <p>
          The Sources column lists up to three places that reported each layoff: the state record, then the news outlets that
          covered it. “1 source” marks a reported layoff that only one publisher has reported so far. Click an employer to see
          what to do if you were affected.
        </p>
        <p>
          Free to cite with a link to <span className="font-medium text-foreground">launchyournextchapter.com/layoffs</span>.
        </p>
      </div>

      {national && <NationalPicture national={national} trackedWorkers={data.year.workers} year={data.year.year} headingLevel={headingLevel === 'h1' ? 'h2' : 'h3'} />}
    </section>
  )
}
