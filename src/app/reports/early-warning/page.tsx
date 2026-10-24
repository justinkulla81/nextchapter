import type { Metadata } from 'next'
import Link from 'next/link'
import { StructuredData } from '@/components/StructuredData'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { EarlyWarningPanels, buildEarlyWarning } from '@/components/reports/EarlyWarningPanels'
import { SITE_URL, latestReport } from '@/lib/reports'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'

const SLUG = 'early-warning'
const URL = `${SITE_URL}/reports/${SLUG}`
const LICENSE = 'https://creativecommons.org/licenses/by/4.0/'

// The page always shows the newest data snapshot. Each monthly edition page from
// October 2026 shows its own snapshot through the same EarlyWarningPanels section.
const { lead: LEAD } = buildEarlyWarning()

export function generateMetadata(): Metadata {
  const title = 'Are young graduates the canary? Early-warning labor indicators | NextChapter'
  return {
    title: { absolute: title },
    description: LEAD,
    alternates: { canonical: `/reports/${SLUG}` },
    openGraph: { type: 'article', title, description: LEAD, url: URL, siteName: 'NextChapter' },
    twitter: { card: 'summary_large_image', title, description: LEAD },
  }
}

const datasetJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'NextChapter early-warning labor indicators',
  description:
    'Monthly U.S. unemployment and employment rates for young graduates, early-career and senior white-collar workers, with a year-over-year lead-lag test, job cuts citing AI by country, and a like-for-like comparison with ten peer economies.',
  url: URL,
  creator: { '@type': 'Organization', name: 'NextChapter', url: SITE_URL },
  license: LICENSE,
  isAccessibleForFree: true,
  distribution: [
    { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${SITE_URL}/reports/us-early-warning.csv` },
    { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE_URL}/reports/early-warning-peers.json` },
    { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${SITE_URL}/reports/ai-layoffs-monthly.csv` },
  ],
}

export default function EarlyWarningPage() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={datasetJsonLd} />
      <StructuredData data={breadcrumbJsonLd([{ name: 'White Collar Employment Report', path: '/reports' }, { name: 'Early warning', path: `/reports/${SLUG}` }])} />
      <PublicSiteHeader current="reports" />

      <main className="mx-auto w-full max-w-4xl px-6 py-14">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link href="/reports" className="hover:text-foreground">White Collar Employment Report</Link>
          <span aria-hidden> › </span>
          <span className="text-foreground">Early warning</span>
        </nav>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-navy sm:text-4xl">Early-warning labor indicators</h1>
        <p className="mt-3 max-w-2xl text-lg text-foreground">{LEAD}</p>
        {latestReport() && <AuthorByline updated={latestReport()!.publishedAt} />}

        <EarlyWarningPanels />
      </main>

      <section className="border-t border-light-gray bg-white px-6 py-16">
        <NewsletterSignup source="employment-report" />
      </section>
      <PublicSiteFooter page="reports" />
    </div>
  )
}
