import type { Metadata } from 'next'
import Link from 'next/link'
import { StructuredData } from '@/components/StructuredData'
import { TrackedLink } from '@/components/marketing/TrackedLink'
import { PublicSiteFooter, PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'
import { SITE_URL } from '@/lib/seo/facts'
import { breadcrumbJsonLd, organizationRef } from '@/lib/seo/jsonld'
import { ALL_STATE_CODES, stateName } from '@/lib/seo/states'
import { LAYOFF_COLUMNS, LAYOFF_DATA_CITATION, LAYOFF_DATA_LICENSE, LAYOFF_DATA_LICENSE_URL, getLayoffRows } from '@/lib/data/layoff-export'
import { noticeDay } from '@/lib/warn/layoff-pages'
import { getLayoffCounts } from '@/lib/warn/layoff-counts'
import { LayoffNumbersNote } from '@/components/layoffs/LayoffNumbersNote'

export const revalidate = 3600

const DESCRIPTION = 'Download the layoff record: every WARN Act notice filed with US state labor departments in the last 24 months, as CSV or JSON, free to reuse with a link back.'
export const metadata: Metadata = pageMetadata('/data')

const LINK = 'text-brand underline underline-offset-4'

export default async function DataPage() {
  const [rows, counts] = await Promise.all([getLayoffRows(null).catch(() => []), getLayoffCounts()])
  const newest = rows[0]?.notice_date
  const oldest = rows[rows.length - 1]?.notice_date
  const states = [...new Set(rows.map((r) => r.state))].sort((a, b) => stateName(a).localeCompare(stateName(b)))
  const dataset = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'NextChapter layoff tracker: WARN Act notices by US state',
    description: DESCRIPTION,
    url: `${SITE_URL}/data`,
    license: LAYOFF_DATA_LICENSE_URL,
    creator: organizationRef(),
    isAccessibleForFree: true,
    keywords: ['layoffs', 'WARN Act', 'mass layoffs', 'plant closings', 'employment'],
    ...(oldest && newest ? { temporalCoverage: `${oldest}/${newest}` } : {}),
    spatialCoverage: 'United States',
    variableMeasured: [...LAYOFF_COLUMNS],
    distribution: [
      { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${SITE_URL}/data/layoffs.csv` },
      { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE_URL}/data/layoffs.json` },
    ],
  }
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={dataset} />
      <StructuredData data={breadcrumbJsonLd([{ name: 'Data', path: '/data' }])} />
      <PublicSiteHeader />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">{pageH1('/data', 'Layoff data: download the WARN record')}</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {rows.length.toLocaleString('en-US')} WARN Act filings{oldest && newest ? `, ${noticeDay(new Date(oldest))} to ${noticeDay(new Date(newest))}` : ''}, one row per filing, collected from state labor departments and linked to each state’s own record.
          </p>

          <LayoffNumbersNote counts={counts} className="mt-8 rounded-xl border border-border bg-white p-6" />

          <section aria-labelledby="files" className="mt-10">
            <h2 id="files" className="text-2xl font-bold tracking-tight text-navy">Files</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li><TrackedLink href="/data/layoffs.csv" event="data_download_clicked" properties={{ format: 'csv', scope: 'all' }} className={LINK}>layoffs.csv</TrackedLink>: all states, opens in any spreadsheet</li>
              <li><TrackedLink href="/data/layoffs.json" event="data_download_clicked" properties={{ format: 'json', scope: 'all' }} className={LINK}>layoffs.json</TrackedLink>: the same rows with the license and citation, for code</li>
              <li>One state: add <code className="rounded bg-white px-1.5 py-0.5">?state=TX</code> to either file, or pick below.</li>
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">Columns: {LAYOFF_COLUMNS.join(', ')}. Updated at least hourly from the states’ published records. A state may publish late or leave out worker counts, so this is a floor, not a count of every layoff.</p>
          </section>

          <section aria-labelledby="license" className="mt-10 rounded-xl border border-border bg-white p-6">
            <h2 id="license" className="text-xl font-semibold tracking-tight text-navy">License and how to cite</h2>
            <p className="mt-2 text-sm">
              Free to use, share and adapt, including commercially, under <a href={LAYOFF_DATA_LICENSE_URL} className={LINK} target="_blank" rel="noopener noreferrer">{LAYOFF_DATA_LICENSE}</a>. The one condition is credit with a link:
            </p>
            <p className="mt-3 rounded-lg bg-off-white p-3 text-sm"><span className="select-all">{LAYOFF_DATA_CITATION}</span></p>
          </section>

          <section aria-labelledby="states" className="mt-10">
            <h2 id="states" className="text-2xl font-bold tracking-tight text-navy">By state</h2>
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {states.map((s) => (
                <li key={s} className="flex justify-between gap-2 rounded-lg border border-border bg-white px-3 py-2">
                  <span>{stateName(s)}</span>
                  <TrackedLink href={`/data/layoffs.csv?state=${s}`} event="data_download_clicked" properties={{ format: 'csv', scope: s }} className={LINK}>CSV</TrackedLink>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="more" className="mt-10">
            <h2 id="more" className="text-2xl font-bold tracking-tight text-navy">Put it on your site</h2>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm">
              <li><Link href="/data/embed" className={LINK}>Embeddable widgets</Link>: layoff notices, open jobs and unemployment benefits for any state or industry, free, with a link back.</li>
              <li><Link href="/feeds/layoffs" className={LINK}>RSS feed of new layoff notices</Link>, or one state at <code className="rounded bg-white px-1.5 py-0.5">/feeds/layoffs/&lt;state&gt;</code>.</li>
              <li><Link href="/layoffs/this-week" className={LINK}>Layoffs this week</Link>, updated every day.</li>
              <li><Link href="/layoffs" className={LINK}>The full layoff tracker</Link> and the <Link href="/reports" className={LINK}>White Collar Employment Report</Link>.</li>
            </ul>
          </section>
          <p className="mt-10 text-xs text-muted-foreground">All {ALL_STATE_CODES.length} jurisdictions are tracked; states with no notice in the period have no file.</p>
        </div>
      </main>
      <PublicSiteFooter page="seo" />
    </div>
  )
}
