import { CiteThisReport } from '@/components/reports/CiteThisReport'
import type { Metadata } from 'next'
import Link from 'next/link'
import { StructuredData } from '@/components/StructuredData'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { ReportNextSteps } from '@/components/reports/ReportNextSteps'
import { SITE_URL } from '@/lib/reports'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { ShareBar } from '@/components/marketing/ShareBar'
import { organizationRef, personRef } from '@/lib/seo/jsonld'
import { REPORT_CSS } from '@/app/reports/white-collar-employment-report-september-2026/report-styles'
import { REPORT_BODY_HTML } from './report-body'
import { ReportDownloads } from './ReportDownloads'
import { titleMeta } from '@/lib/seo/title'
import { fitDescription } from '@/lib/seo/templates'

const SLUG = 'white-collar-employment-report-october-2026'
const URL = `${SITE_URL}/reports/${SLUG}`
const OG_IMAGE = `${SITE_URL}/reports/white-collar-employment-report-2026-10-og.png`
const CHART_URL = `${SITE_URL}/reports/october-2026-long-search-shares.png`
const PDF_HREF = '/reports/white-collar-employment-report-2026-10.pdf'
const PUBLISHED = '2026-11-06'
const MODIFIED = '2026-11-09'
const TITLE = 'NextChapter White Collar Employment Report: October 2026'

const FILES = [
  { label: 'Full report (PDF, 22 pages)', note: 'Version 1.11', href: PDF_HREF, type: 'pdf' as const },
  { label: 'Long-search shares by group (CSV)', note: 'Exhibits 1 and 3, with margins and counts', href: '/reports/white-collar-employment-report-2026-10-data.csv', type: 'data' as const },
  { label: 'Validation against BLS (CSV)', note: 'Our CPS pipeline vs BLS published figures', href: '/reports/white-collar-employment-report-2026-10-validation-vs-bls.csv', type: 'data' as const },
  { label: 'Long-Search Index series (CSV)', note: 'Monthly, 2019 = 100', href: '/reports/white-collar-employment-report-2026-10-long-search-index.csv', type: 'data' as const },
  { label: 'Industry and age scorecard (CSV)', note: 'Exhibit 4, with margins and counts', href: '/reports/white-collar-employment-report-2026-10-scorecard.csv', type: 'data' as const },
  { label: 'AI-skill posted pay (CSV)', note: 'Exhibit 9, all 89 function-and-level cells', href: '/reports/white-collar-employment-report-2026-10-ai-skill-pay.csv', type: 'data' as const },
  { label: 'Month-to-month flows (JSON)', note: 'Exit and entry rates, matched CPS, 2026 vs 2025', href: '/reports/white-collar-employment-report-2026-10-flows.json', type: 'data' as const },
  { label: 'Sectors and metros: Indeed postings (CSV)', note: 'Postings index vs a year ago and Feb 2020, with our exposure grouping', href: '/reports/white-collar-employment-report-2026-10-indeed-sectors-metros.csv', type: 'data' as const },
  { label: 'White-collar by Census division and state (JSON)', note: 'Employment, unemployment, long spells, Jan-Sep 2026 vs 2025', href: '/reports/white-collar-employment-report-2026-10-geo.json', type: 'data' as const },
  { label: 'AI-skill jobs by employer industry (CSV)', note: 'Outside and inside technology, Nov 8, 2026', href: '/reports/white-collar-employment-report-2026-10-ai-skill-by-industry.csv', type: 'data' as const },
  { label: 'Degree-holders by age (JSON)', note: 'Unemployment and long spells, Jan-Sep 2026 vs 2025', href: '/reports/white-collar-employment-report-2026-10-degree-age.json', type: 'data' as const },
  { label: 'Employer rankings (JSON)', note: 'Open jobs by function, Oct 26, 2026', href: '/reports/white-collar-employment-report-2026-10-employer-rankings.json', type: 'data' as const },
  { label: 'AI exposure exhibits (ZIP)', note: 'Anthropic Economic Index match', href: '/reports/white-collar-employment-report-2026-10-ai-exposure.zip', type: 'data' as const },
  { label: 'Methodology note (PDF)', note: 'Margins of error, with a worked example', href: '/reports/white-collar-employment-report-2026-10-methodology.pdf', type: 'method' as const },
]

export const metadata: Metadata = {
  title: titleMeta('October 2026 White Collar Employment Report: Long Unemployment Spells'),
  description: fitDescription(
    'October 2026 NextChapter White Collar Employment Report: hiring improved (+165,000 jobs, unemployment 4.1%), but 28.5% of unemployed white-collar workers had been out of work six months or more, up from 23.2%. Data, methods and downloads.',
  ),
  alternates: { canonical: `/reports/${SLUG}` },
  openGraph: {
    type: 'article',
    title: TITLE,
    description:
      'Hiring improved in October, but more unemployed white-collar workers are in long spells than a year ago. 28.5% had been out six months or more, up from 23.2%; 39.1% at ages 55 to 64. Data, methods and downloads.',
    url: URL,
    siteName: 'NextChapter',
    publishedTime: PUBLISHED,
    authors: ['Justin Kulla'],
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: 'Hiring improved in October, but more unemployed white-collar workers are in long spells than a year ago.',
    images: [OG_IMAGE],
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Report',
      headline: TITLE,
      datePublished: PUBLISHED,
      dateModified: MODIFIED,
      url: URL,
      mainEntityOfPage: URL,
      image: OG_IMAGE,
      version: '1.11',
      author: personRef(),
      publisher: organizationRef(),
      about: ['employment', 'long-term unemployment', 'white-collar labor market', 'knowledge workers', 'job search'],
      description:
        'Monthly report on U.S. employment: October hiring, the share of unemployed white-collar workers out of work six months or more, knowledge workers, employer hiring and AI task exposure of open jobs.',
    },
    {
      '@type': 'Dataset',
      name: 'White-collar long-duration unemployment by group, January to September 2026',
      description:
        'Share of unemployed workers out of work 27 weeks or more, by occupation group, age and education, from Census Current Population Survey microdata, with 90% margins of error, a validation against BLS figures, the White-Collar Long-Search Index series, employer rankings and AI exposure exhibits.',
      url: URL,
      creator: { '@type': 'Organization', name: 'NextChapter', url: SITE_URL },
      datePublished: PUBLISHED,
      license: 'https://creativecommons.org/licenses/by/4.0/',
      isAccessibleForFree: true,
      keywords: ['long-term unemployment', 'white-collar workers', 'knowledge workers', 'Current Population Survey', 'unemployment duration'],
      distribution: FILES.map((f) => ({
        '@type': 'DataDownload',
        name: f.label,
        encodingFormat: f.href.endsWith('.csv') ? 'text/csv' : f.href.endsWith('.json') ? 'application/json' : f.href.endsWith('.zip') ? 'application/zip' : 'application/pdf',
        contentUrl: `${SITE_URL}${f.href}`,
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Reports', item: `${SITE_URL}/reports` },
        { '@type': 'ListItem', position: 3, name: 'October 2026', item: URL },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What share of unemployed white-collar workers have been out of work six months or more?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: '28.5% in January to September 2026, up from 23.2% in the same months of 2025 (Census CPS microdata, not seasonally adjusted). For white-collar workers aged 55 to 64 the share is 39.1%, up from 27.0%.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is white-collar unemployment rising?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The white-collar unemployment rate is low: 2.63% in January to September 2026 against 2.48% a year earlier. The change is in the share of the unemployed already in long spells, not in how many people are out of work.',
          },
        },
        {
          '@type': 'Question',
          name: 'Does this show how long a newly unemployed worker will stay out of work?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'No. The measure covers spells in progress among people who are currently unemployed. It is not the probability that someone who just lost a job will still be unemployed six months later.',
          },
        },
        {
          '@type': 'Question',
          name: 'What are knowledge workers in this report?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Workers in white-collar occupations (Census major groups 1 and 2) with a bachelor\'s degree or more. They are about 30.7% of employed people. Among unemployed knowledge workers, 29.6% had been out six months or more, up from 24.8%.',
          },
        },
        {
          '@type': 'Question',
          name: 'What did the October 2026 jobs report show?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Employers added 165,000 jobs and the unemployment rate fell to 4.1% (BLS, seasonally adjusted); August and September were revised up by a combined 84,000 jobs.',
          },
        },
      ],
    },
  ],
}

export default function WhiteCollarEmploymentReportOctober2026() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <PublicSiteHeader current="reports" />

      <div className="border-b border-brand/30 bg-brand/5">
        <div className="mx-auto w-full max-w-5xl px-6 py-2.5 text-sm text-navy">
          <span className="font-semibold">About this edition.</span> It uses Census CPS microdata through September 2026. The early-warning section on
          early-career and senior white-collar unemployment is{' '}
          <Link href="/reports/early-warning" className="font-medium underline underline-offset-4">live through September</Link>
          {' '}and will be updated with the October data when Census publishes it.
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <div className="ncr" dangerouslySetInnerHTML={{ __html: REPORT_BODY_HTML }} />

      <section className="border-t border-light-gray bg-white">
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
          <AuthorByline updated={MODIFIED} className="mb-4" />
          <ReportDownloads edition="2026-10" files={FILES} pageUrl={URL} chartUrl={CHART_URL} chartAlt="Share of unemployed out of work six months or more, by group, Jan-Sep 2026 vs 2025" />
          <div className="mb-6"><ShareBar url={URL} title={TITLE} placement="report_edition" label="Send this report to someone" /></div>
          <CiteThisReport title={TITLE} url={URL} published="November 6, 2026" />
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">About the author</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-navy">Justin Kulla</span> is the founder of NextChapter; a former CTO
            and private-equity investor; and a lecturer at Stanford and MIT.{' '}
            <Link href="/authors/justin-kulla" className="text-brand underline underline-offset-4">
              More about Justin
            </Link>
            .
          </p>
        </div>
      </section>

      <ReportNextSteps page="report_edition" />

      <PublicSiteFooter page="reports" />
    </div>
  )
}
