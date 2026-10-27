import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { LayoffNumbersNote } from '@/components/layoffs/LayoffNumbersNote'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { pageMetadata } from '@/lib/seo/keywords'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { getStateSummaries, noticeDay } from '@/lib/warn/layoff-pages'
import { getLayoffCounts } from '@/lib/warn/layoff-counts'
import { stateWarnLaw } from '@/lib/warn-guide/rules'
import { LAYOFF_DATA_CITATION, LAYOFF_DATA_LICENSE } from '@/lib/data/layoff-export'

// WARN notices by state: one table of what each state's own record shows, with the unit defined, the as-of date, a file to download and
// a citation line. Built to be linked and quoted.

export const revalidate = 3600

export const metadata: Metadata = pageMetadata('/layoffs/by-state')

export default async function WarnNoticesByStatePage() {
  const [states, counts] = await Promise.all([getStateSummaries().catch(() => []), getLayoffCounts()])
  const withNotices = new Set(states.map((s) => s.state))
  const without = ALL_STATE_CODES.filter((c) => !withNotices.has(c))
  const rows = [...states].sort((a, b) => b.recent - a.recent || stateName(a.state).localeCompare(stateName(b.state)))
  const notices = rows.reduce((t, s) => t + s.recent, 0)
  const workers = rows.reduce((t, s) => t + s.recentWorkers, 0)

  return (
    <SeoPage
      trail={[{ name: 'Layoff tracker', path: '/layoffs' }, { name: 'WARN notices by state', path: '/layoffs/by-state' }]}
      h1="WARN notices by state: what each state’s record shows"
      lede={
        <>
          <p>
            Employers that must give notice of a plant closing or mass layoff file a WARN notice with the state, and each state publishes what it receives. In the last 12 months we have read{' '}
            {notices.toLocaleString('en-US')} notices from {rows.length} states, naming {workers.toLocaleString('en-US')} workers. Open a state for every notice with its source, or download the data.
          </p>
          <AuthorByline updated={new Date().toISOString().slice(0, 10)} className="mt-4" />
        </>
      }
    >
      <section aria-labelledby="table" className="mt-8">
        <h2 id="table" className={H2}>Notices filed in the last 12 months</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          One row per state with at least one notice. Notices are filings, one row each as the state published them. Workers named is the number the notices give, a floor, because some states leave it out.
          Where a state has its own WARN law the row says so, and the <Link href="/resources/warn-act" className={LINK}>WARN Act guide</Link> explains it with sources.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <caption className="sr-only">WARN notices filed in the last 12 months, by state</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="border-b border-border py-2 pr-3 font-medium">State</th>
                <th scope="col" className="border-b border-border py-2 pr-3 text-right font-medium">Notices</th>
                <th scope="col" className="border-b border-border py-2 pr-3 text-right font-medium">Workers named</th>
                <th scope="col" className="border-b border-border py-2 pr-3 font-medium">Latest filing</th>
                <th scope="col" className="border-b border-border py-2 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const law = stateWarnLaw(s.state)
                return (
                  <tr key={s.state} className="align-top">
                    <th scope="row" className="border-b border-border py-2.5 pr-3 text-left font-medium text-navy">
                      <Link href={`/layoffs/${stateSlug(s.state)}`} className={LINK}>{stateName(s.state)}</Link>
                      {law && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">own WARN law</span>}
                    </th>
                    <td className="border-b border-border py-2.5 pr-3 text-right tabular-nums">{s.recent.toLocaleString('en-US')}</td>
                    <td className="border-b border-border py-2.5 pr-3 text-right tabular-nums">{s.recentWorkers > 0 ? s.recentWorkers.toLocaleString('en-US') : '–'}</td>
                    <td className="border-b border-border py-2.5 pr-3 text-muted-foreground">{noticeDay(s.latest)}</td>
                    <td className="border-b border-border py-2.5">
                      <TrackedLink href={`/data/layoffs.csv?state=${s.state}`} event="data_download_clicked" properties={{ format: 'csv', scope: s.state, placement: 'by_state' }} className={LINK}>
                        CSV
                      </TrackedLink>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {without.length > 0 && (
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Coverage:</span> no notices from the last 12 months for {without.map(stateName).join(', ')}. Some of these states publish no list online, some publish in a form we cannot read yet, and some had no qualifying layoffs.
          </p>
        )}
      </section>

      <LayoffNumbersNote counts={counts} className="mt-12 rounded-xl border border-border bg-white p-6" />

      <section aria-labelledby="cite" className="mt-12 rounded-xl border border-border bg-white p-6">
        <h2 id="cite" className="text-xl font-semibold tracking-tight text-navy">Use and cite this data</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Free to use, including commercially, under {LAYOFF_DATA_LICENSE} with a link back. The full record is on the{' '}
          <Link href="/data" className={LINK}>data page</Link> as CSV and JSON, and the latest notices are on the <Link href="/layoffs" className={LINK}>layoff tracker</Link>.
        </p>
        <p className="mt-3 max-w-3xl rounded-lg bg-off-white p-3 text-sm"><span className="select-all">{LAYOFF_DATA_CITATION}</span></p>
      </section>
    </SeoPage>
  )
}
