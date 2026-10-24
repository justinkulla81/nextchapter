import type { Metadata } from 'next'
import Link from 'next/link'
import { StructuredData } from '@/components/StructuredData'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup'
import { SITE_URL, reportsNewestFirst, latestReport, reportPath } from '@/lib/reports'
import { wcIndexSummary, monthLabel } from '@/lib/reports-wc-index'
import { LONGER_SEARCH_BODY, LONGER_SEARCH_FIGURES, LONGER_SEARCH_HEADLINE } from '@/lib/marketing/longer-search-message'

const URL = `${SITE_URL}/reports`

export const metadata: Metadata = {
  title: { absolute: 'White Collar Employment Report: White-Collar Labor Data | NextChapter' },
  description:
    'The NextChapter White Collar Employment Report is a monthly, independent read on the U.S. white-collar labor market — hiring, job changes, search length, AI attribution, what public programs are adding, and the White-Collar Long-Search Index.',
  alternates: { canonical: '/reports' },
  openGraph: {
    type: 'website',
    title: 'NextChapter White Collar Employment Report',
    description: 'Monthly, independent data on how people are working, being hired and changing jobs, AI and public programs.',
    url: URL,
    siteName: 'NextChapter',
    images: [{ url: `${SITE_URL}/reports/white-collar-employment-report-2026-09-og.png`, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', title: 'NextChapter White Collar Employment Report' },
}

const monthShortLabel = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

// Release calendar — "published within two business days of the BLS jobs report."
const RELEASE_CALENDAR = [
  { date: 'Nov 6, 2026', what: 'BLS jobs report for October. The October edition publishes within two business days.' },
  { date: 'Dec 4, 2026', what: 'BLS jobs report for November. The November edition follows.' },
  { date: 'Mid-Oct / Nov', what: 'Census microdata for September and October land; the White-Collar Index updates.' },
]

export default function ReportsHubPage() {
  const editions = reportsNewestFirst()
  const latest = latestReport()
  const { latest: idx } = wcIndexSummary()
  const latestIndex = Math.round(idx.index)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'NextChapter White Collar Employment Report',
    url: URL,
    description:
      'Monthly, independent data on the U.S. white-collar labor market: hiring, job changes, search length, AI attribution, public programs and the White-Collar Long-Search Index.',
    isPartOf: { '@type': 'WebSite', name: 'NextChapter', url: SITE_URL },
  }

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <PublicSiteHeader current="reports" />

      <main className="mx-auto w-full max-w-4xl px-6 py-14">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">NextChapter White Collar Employment Report</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          An independent, monthly read on the U.S. white-collar labor market — hiring and job changes, how long
          searches take, how often AI is actually cited, and what public programs are adding. Every figure comes from public data, with the methods and
          data files published.
        </p>

        {/* Primary cards: the Index and the latest edition */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <Link
            href="/reports/white-collar-index"
            className="group rounded-xl border border-light-gray bg-white p-6 transition-colors hover:border-brand"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">White-Collar Long-Search Index</p>
            <div className="mt-3 text-5xl font-bold tracking-tight text-navy tabular-nums">{latestIndex}</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {monthLabel(idx.month)} · 2019 = 100. Long-term unemployment (27+ weeks) among managers and professionals.
            </p>
            <p className="mt-4 text-sm font-semibold text-brand group-hover:underline">See the index and history →</p>
          </Link>

          {latest && (
            <Link
              href={reportPath(latest)}
              className="group rounded-xl border border-light-gray bg-white p-6 transition-colors hover:border-brand"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-brand">Latest edition · {latest.month}</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-navy">{latest.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{latest.dek}</p>
              <p className="mt-4 text-sm font-semibold text-brand group-hover:underline">Read the {latest.month} report →</p>
            </Link>
          )}
        </div>

        <Link
          href="/reports/early-warning"
          className="group mt-5 block rounded-xl border border-light-gray bg-white p-6 transition-colors hover:border-brand"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">Early warning</p>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-navy">Are young graduates the canary?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Unemployment for graduates, early-career and senior white-collar workers, a test of who moves first, job cuts that cite AI by
            country, and ten peer economies side by side.
          </p>
          <p className="mt-4 text-sm font-semibold text-brand group-hover:underline">See the early-warning indicators →</p>
        </Link>

        {/* Approved message, backed by exact report figures with sources */}
        <section className="mt-14" aria-labelledby="longer-search">
          <h2 id="longer-search" className="text-xl font-bold tracking-tight text-navy">{LONGER_SEARCH_HEADLINE}</h2>
          <div className="mt-3 max-w-2xl space-y-3 text-base leading-relaxed text-foreground">
            {LONGER_SEARCH_BODY.map((p) => <p key={p}>{p}</p>)}
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            {LONGER_SEARCH_FIGURES.map((f) => (
              <div key={f.id} className="rounded-xl border border-light-gray bg-white p-5">
                <dt className="text-3xl font-bold tracking-tight text-navy tabular-nums">{f.value}</dt>
                <dd className="mt-2 text-sm text-foreground">{f.label}.</dd>
                <dd className="mt-1 text-sm text-muted-foreground">{f.comparison}</dd>
                <dd className="mt-3 text-xs leading-relaxed text-muted-foreground">Source: {f.source}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Margins of error are 90% intervals using the BLS generalized variance method. The report measures how long
            searches last and does not establish why. Methods and data are public on the{' '}
            <Link href="/reports/replication" className="text-brand underline underline-offset-4">replication page</Link>.
          </p>
        </section>

        {/* Archive */}
        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight text-navy">All editions</h2>
          <ul className="mt-4 divide-y divide-light-gray border-t border-light-gray">
            {editions.map((e) => (
              <li key={e.slug} className="py-4">
                <Link href={reportPath(e)} className="group block">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="font-semibold text-navy group-hover:text-brand">{e.month}: {e.title}</span>
                    <span className="text-xs text-muted-foreground">{monthShortLabel(e.publishedAt)}</span>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{e.dek}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Release calendar */}
        <section className="mt-14 rounded-xl border border-light-gray bg-off-white p-6">
          <h2 className="text-xl font-bold tracking-tight text-navy">Release calendar</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The BLS jobs report comes out at 8:30 a.m. Eastern, usually on the first Friday of the month. Each edition
            publishes within two business days of it; the White-Collar Index refreshes when the Census microdata lands,
            usually one to two weeks later.
          </p>
          <dl className="mt-5 divide-y divide-light-gray border-t border-light-gray">
            {RELEASE_CALENDAR.map((r) => (
              <div key={r.date} className="grid grid-cols-[7rem_1fr] gap-4 py-3 text-sm">
                <dt className="font-semibold text-brand">{r.date}</dt>
                <dd className="text-foreground">{r.what}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <section className="border-t border-light-gray bg-white px-6 py-16">
        <NewsletterSignup source="employment-report" />
      </section>

      <PublicSiteFooter page="reports" />
    </div>
  )
}
