import type { Metadata } from 'next'
import Link from 'next/link'
import { StructuredData } from '@/components/StructuredData'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup'
import { SITE_URL, latestReport } from '@/lib/reports'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { readWcIndex, wcIndexSummary, monthLabel, monthShort, type WcIndexPoint } from '@/lib/reports-wc-index'

const SLUG = 'white-collar-index'
const URL = `${SITE_URL}/reports/${SLUG}`
const CSV_HREF = '/reports/wc-index.csv'
const LICENSE = 'https://creativecommons.org/licenses/by/4.0/'

// Headline figures are read from the published CSV at build time, so the page,
// its metadata and the downloadable file never disagree.
const { latest, yearAgo, last13 } = wcIndexSummary()
const LATEST_INDEX = Math.round(latest.index)
const YEAR_AGO_INDEX = yearAgo ? Math.round(yearAgo.index) : null
const LATEST_MONTH = monthLabel(latest.month)

export function generateMetadata(): Metadata {
  const description = YEAR_AGO_INDEX
    ? `The NextChapter White-Collar Displacement Index stood at ${LATEST_INDEX} in ${LATEST_MONTH} (2019 = 100), up from ${YEAR_AGO_INDEX} a year earlier. A monthly measure of long-term unemployment among U.S. managers and professionals, from Census CPS microdata.`
    : `The NextChapter White-Collar Displacement Index stood at ${LATEST_INDEX} in ${LATEST_MONTH} (2019 = 100). A monthly measure of long-term unemployment among U.S. managers and professionals, from Census CPS microdata.`
  return {
    title: {
      absolute: 'White-Collar Displacement Index | NextChapter',
    },
    description,
    alternates: { canonical: `/reports/${SLUG}` },
    openGraph: {
      type: 'article',
      title: 'NextChapter White-Collar Displacement Index',
      description,
      url: URL,
      siteName: 'NextChapter',
      images: [{ url: `${SITE_URL}/reports/displacement-report-2026-09-og.png`, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: 'NextChapter White-Collar Displacement Index', description },
  }
}

const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'NextChapter White-Collar Displacement Index',
  description:
    'Monthly long-term unemployment (27+ weeks) among management, business, financial and professional workers as a share of that labor force, seasonally adjusted 3-month average, 2019 = 100, from U.S. Census Bureau Current Population Survey microdata.',
  url: URL,
  temporalCoverage: '2015-01/latest',
  variableMeasured: [
    'White-Collar Displacement Index (2019 = 100)',
    'White-collar long-term unemployment rate',
    'White-collar unemployment rate',
    'Long-term share of unemployed white-collar workers',
    'Median weeks unemployed (white-collar)',
  ],
  creator: { '@type': 'Organization', name: 'NextChapter', url: SITE_URL },
  license: LICENSE,
  isAccessibleForFree: true,
  distribution: {
    '@type': 'DataDownload',
    encodingFormat: 'text/csv',
    contentUrl: `${SITE_URL}${CSV_HREF}`,
  },
}

// ---- Server-rendered line chart (inline SVG, no client JS) --------------------

const W = 720
const H = 340
const M = { t: 16, r: 48, b: 30, l: 40 }
const IW = W - M.l - M.r
const IH = H - M.t - M.b
const Y_MAX = 350

const monthIndex = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  return y * 12 + (mo - 1)
}
const toYear = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  return y + (mo - 1) / 12
}

function IndexChart({ series }: { series: WcIndexPoint[] }) {
  const x0 = 2015
  const x1 = toYear(series[series.length - 1].month) + 1 / 12
  const X = (yr: number) => M.l + ((yr - x0) / (x1 - x0)) * IW
  const Y = (v: number) => M.t + ((Y_MAX - v) / Y_MAX) * IH

  // Split the line at any gap longer than one month (e.g. October 2025, not collected).
  const segments: WcIndexPoint[][] = []
  let cur: WcIndexPoint[] = []
  let prev: number | null = null
  for (const p of series) {
    const idx = monthIndex(p.month)
    if (prev !== null && idx - prev > 1) {
      segments.push(cur)
      cur = []
    }
    cur.push(p)
    prev = idx
  }
  if (cur.length) segments.push(cur)

  const path = (seg: WcIndexPoint[]) =>
    'M' + seg.map((p) => `${X(toYear(p.month)).toFixed(1)} ${Y(p.index).toFixed(1)}`).join('L')

  const last = series[series.length - 1]
  const gapX = X(2025 + 9 / 12) // October 2025 position

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`White-Collar Displacement Index, January 2015 to ${monthShort(last.month)}, 2019 average = 100. ${LATEST_INDEX} in ${monthShort(last.month)}.`}
      className="h-auto w-full"
    >
      {/* gridlines + y labels */}
      {[0, 100, 200, 300].map((v) => (
        <g key={v}>
          <line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke="#e2e8f0" strokeWidth={1} />
          <text x={M.l - 6} y={Y(v) + 4} textAnchor="end" fontSize={11} fill="#8892a0">
            {v}
          </text>
        </g>
      ))}
      {/* x labels */}
      {[2015, 2017, 2019, 2021, 2023, 2025].map((yr) => (
        <text key={yr} x={X(yr)} y={H - 8} textAnchor="middle" fontSize={11} fill="#8892a0">
          {yr}
        </text>
      ))}
      {/* 2019 = 100 baseline */}
      <line x1={M.l} x2={W - M.r} y1={Y(100)} y2={Y(100)} stroke="#4a5568" strokeDasharray="4 4" strokeWidth={1} />
      <text x={W - M.r + 4} y={Y(100) + 4} fontSize={11} fill="#4a5568">
        2019
      </text>
      {/* gap marker for the uncollected month */}
      <line x1={gapX} x2={gapX} y1={M.t} y2={H - M.b} stroke="#c4574a" strokeDasharray="2 3" strokeWidth={1} opacity={0.5} />
      {/* index line, broken across the gap */}
      {segments.map((seg, i) => (
        <path key={i} d={path(seg)} fill="none" stroke="#1d4e89" strokeWidth={2} strokeLinejoin="round" />
      ))}
      {/* latest point */}
      <circle cx={X(toYear(last.month))} cy={Y(last.index)} r={4.5} fill="#1d4e89" />
      <text x={X(toYear(last.month)) - 8} y={Y(last.index) - 12} textAnchor="end" fontSize={11} fontWeight={600} fill="#0a0a0a">
        {monthShort(last.month)}: {LATEST_INDEX}
      </text>
    </svg>
  )
}

// ---- Page ---------------------------------------------------------------------

export default function WhiteCollarIndexPage() {
  const series = readWcIndex()
  const rows = [...last13].reverse() // newest first
  const fmt1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '—')
  const fmt0 = (v: number) => (Number.isFinite(v) ? Math.round(v).toString() : '—')

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={datasetJsonLd} />
      <StructuredData
        data={breadcrumbJsonLd([
          { name: 'Displacement Report', path: '/reports' },
          { name: 'White-Collar Index', path: `/reports/${SLUG}` },
        ])}
      />
      <PublicSiteHeader current="reports" />

      <main className="mx-auto w-full max-w-4xl px-6 py-14">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link href="/reports" className="hover:text-foreground">Displacement Report</Link>
          <span aria-hidden> › </span>
          <span className="text-foreground">White-Collar Index</span>
        </nav>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          NextChapter White-Collar Displacement Index
        </h1>
        {/* The index is refreshed with each monthly edition. */}
        {latestReport() && <AuthorByline updated={latestReport()!.publishedAt} />}

        {/* Latest value + year change */}
        <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <div className="text-5xl font-bold tracking-tight text-navy tabular-nums">{LATEST_INDEX}</div>
            <div className="mt-1 text-sm text-muted-foreground">{LATEST_MONTH} (2019 = 100)</div>
          </div>
          {YEAR_AGO_INDEX !== null && (
            <div>
              <div className="text-2xl font-semibold tabular-nums text-navy">
                {LATEST_INDEX - YEAR_AGO_INDEX >= 0 ? '+' : '−'}
                {Math.abs(LATEST_INDEX - YEAR_AGO_INDEX)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">vs. {YEAR_AGO_INDEX} a year earlier</div>
            </div>
          )}
        </div>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-foreground">
          The White-Collar Displacement Index tracks long-term unemployment among managers and professionals:
          people whose current or most recent job was in a management, business, financial or professional occupation
          and who have been unemployed 27 weeks or more, measured as a share of that labor force. It is seasonally
          adjusted, averaged over three months, and set so the 2019 average equals 100. A reading of {LATEST_INDEX}{' '}
          means long-term white-collar unemployment is running about {LATEST_INDEX}% of its 2019 level.
        </p>

        {/* Chart */}
        <figure className="mt-10 rounded-xl border border-light-gray bg-white p-5">
          <figcaption className="text-sm font-semibold text-navy">
            White-Collar Displacement Index, January 2015 – {monthLabel(latest.month)} (2019 average = 100)
          </figcaption>
          <div className="mt-3">
            <IndexChart series={series} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Seasonally adjusted, 3-month moving average. The dashed horizontal line is the 2019 baseline (= 100). The
            red marker shows October 2025, which the Current Population Survey did not collect during the federal
            shutdown; the line breaks across it. Source: NextChapter calculation from U.S. Census Bureau Current
            Population Survey microdata.
          </p>
        </figure>

        {/* Companion table */}
        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight text-navy">The last 13 months</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm tabular-nums">
              <thead>
                <tr className="border-b border-light-gray text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Month</th>
                  <th className="py-2 pr-4 text-right font-medium">Index</th>
                  <th className="py-2 pr-4 text-right font-medium">WC unemployment rate</th>
                  <th className="py-2 pr-4 text-right font-medium">Out 27+ weeks (share of WC unemployed)</th>
                  <th className="py-2 pr-4 text-right font-medium">Out 27+ weeks, WC 45+</th>
                  <th className="py-2 text-right font-medium">Median weeks so far</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.month} className="border-b border-light-gray/70">
                    <td className="py-2 pr-4 whitespace-nowrap">{monthShort(p.month)}</td>
                    <td className="py-2 pr-4 text-right">{fmt0(p.index)}</td>
                    <td className="py-2 pr-4 text-right">{fmt1(p.unemploymentRate)}%</td>
                    <td className="py-2 pr-4 text-right">{fmt1(p.ltuShare)}%</td>
                    <td className="py-2 pr-4 text-right">{fmt1(p.ltuShare45)}%</td>
                    <td className="py-2 text-right">{fmt0(p.medianWeeks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            The index is seasonally adjusted; the other columns are not seasonally adjusted (NSA) and are best compared
            with the same month a year earlier. The split of the unemployed into job losers and job leavers is reported
            in the monthly{' '}
            <Link href="/reports/latest" className="text-brand underline underline-offset-4">Displacement Report</Link>{' '}
            rather than in this index series. October 2025 is absent because the survey was not collected that month.
          </p>
        </section>

        {/* Methodology */}
        <section className="mt-12">
          <h2 className="text-xl font-bold tracking-tight text-navy">Methodology</h2>
          <ul className="mt-4 max-w-2xl list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground">
            <li>
              <strong>Source.</strong> U.S. Census Bureau Current Population Survey (CPS) basic monthly public-use
              microdata. No NextChapter customer data is used.
            </li>
            <li>
              <strong>White-collar.</strong> Labor-force members whose current or most recent job is in Census major
              occupation group 1 (management, business and financial) or 2 (professional and related) — CPS variable
              PRMJOCC1 in (1, 2).
            </li>
            <li>
              <strong>Long-term.</strong> Unemployed 27 weeks or more (PRUNEDUR ≥ 27), as a share of the white-collar
              labor force. Estimates use the composite weight PWCMPWGT, the weight BLS uses for labor-force estimates.
            </li>
            <li>
              <strong>Index.</strong> That long-term rate, shown as a 3-month moving average, divided by its 2019
              average and multiplied by 100 (2019 = 100).
            </li>
            <li>
              <strong>Seasonal adjustment.</strong> The index is seasonally adjusted with monthly factors; the companion
              columns above are not seasonally adjusted, so compare a month with the same month a year earlier rather
              than with an annual average.
            </li>
            <li>
              <strong>October 2025.</strong> The CPS was not collected that month during the federal shutdown; moving
              averages skip it and the chart leaves a gap.
            </li>
          </ul>
        </section>

        {/* How to cite + download */}
        <section className="mt-12 rounded-xl border border-light-gray bg-off-white p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">How to cite</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            NextChapter. <em>White-Collar Displacement Index</em> (2019 = 100). Retrieved from {URL}. Data and charts
            may be republished with attribution under{' '}
            <a href={LICENSE} className="text-brand underline underline-offset-4" rel="license">CC BY 4.0</a>.
          </p>
          <p className="mt-4">
            <a
              href={CSV_HREF}
              download
              className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-4 py-2 text-sm font-semibold text-brand hover:bg-brand hover:text-white"
            >
              Download the full series (CSV, 2015–{latest.month.slice(0, 4)})
            </a>
          </p>
        </section>
      </main>

      <section className="border-t border-light-gray bg-white px-6 py-16">
        <NewsletterSignup source="displacement-report" />
      </section>

      <PublicSiteFooter page="reports" />
    </div>
  )
}
