import type { Metadata } from 'next'
import Link from 'next/link'
import Script from 'next/script'
import { StructuredData } from '@/components/StructuredData'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { ReportEnhancements } from '@/components/reports/ReportEnhancements'
import { SITE_URL } from '@/lib/reports'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { organizationRef, personRef } from '@/lib/seo/jsonld'
import { REPORT_CSS } from './report-styles'
import { REPORT_BODY_HTML } from './report-body'

const SLUG = 'displacement-report-september-2026'
const URL = `${SITE_URL}/reports/${SLUG}`
const OG_IMAGE = `${SITE_URL}/reports/displacement-report-2026-09-og.png?v=1.72`
const PDF_HREF = '/reports/displacement-report-2026-09.pdf'
const PDF_FILENAME = 'NextChapter-Displacement-Report-September-2026.pdf'
const BRIEF_HREF = '/reports/displacement-report-2026-09-brief.pdf'
const REPO_URL = 'https://github.com/justinkulla81/nextchapter-displacement-report'
const PUBLISHED = '2026-10-05'
const MODIFIED = '2026-10-06'

export const metadata: Metadata = {
  title: {
    absolute:
      'September 2026 White-Collar Jobs & Layoffs Report: AI, Long-Term Unemployment | NextChapter',
  },
  description:
    'September 2026 NextChapter Displacement Report: White-Collar Long-Term Unemployment Index 162 (2019=100); white-collar long-term unemployment up about a third; layoffs, AI attribution in SEC filings, Q3 addendum on revenue per employee, AI in SEC restructuring filings and industry productivity; career ladders, college AI programs, WIOA retraining, immigration and H-1B, an AI use-case watch, hidden displacement, the rewiring constraint, AI exposure by occupation, degree holders by education and experience, college costs and student debt, total factor productivity, states and policy.',
  alternates: { canonical: `/reports/${SLUG}` },
  openGraph: {
    type: 'article',
    title: 'NextChapter Displacement Report — September 2026',
    description:
      'Fewer layoffs, longer searches. Monthly data on white-collar job loss, AI, long-term unemployment and the safety net.',
    url: URL,
    siteName: 'NextChapter',
    publishedTime: PUBLISHED,
    modifiedTime: MODIFIED,
    authors: ['Justin Kulla'],
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'NextChapter Displacement Report — September 2026' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NextChapter Displacement Report — September 2026',
    description:
      'Fewer layoffs, longer searches. Monthly data on white-collar job loss, AI, long-term unemployment and the safety net.',
    images: [OG_IMAGE],
  },
}

// Report + FAQ (ported from the authored HTML) + breadcrumb + author, as one graph.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Report',
      headline: 'NextChapter Displacement Report: September 2026',
      datePublished: PUBLISHED,
      dateModified: MODIFIED,
      url: URL,
      mainEntityOfPage: URL,
      image: OG_IMAGE,
      version: '1.72',
      author: personRef(),
      publisher: organizationRef(),
      about: ['white-collar unemployment', 'long-term unemployment', 'layoffs', 'AI and jobs', 'workforce policy'],
      description:
        'Monthly report on U.S. white-collar job displacement: the White-Collar Long-Term Unemployment Index, jobs and hiring, layoffs and AI attribution, long-term unemployment by occupation and age, applications and AI in hiring, skills, states and policy, September 2026.',
    },
    {
      // The report's own datasets (the index series has its own Dataset on the
      // White-Collar Long-Term Unemployment Index page).
      '@type': 'Dataset',
      name: 'NextChapter Displacement Report — September 2026 data',
      description:
        'The full report and brief (PDF), report figures (CSV), the SEC Item 2.05 AI-coding dataset, and the Q3 2026 revenue-per-employee sample.',
      url: URL,
      creator: { '@type': 'Organization', name: 'NextChapter', url: SITE_URL },
      license: 'https://creativecommons.org/licenses/by/4.0/',
      isAccessibleForFree: true,
      isBasedOn: {
        '@type': 'SoftwareSourceCode',
        name: 'NextChapter Displacement Report replication materials',
        codeRepository: REPO_URL,
        url: `${SITE_URL}/reports/replication`,
      },
      distribution: [
        { '@type': 'DataDownload', name: 'Full report (50 pages)', encodingFormat: 'application/pdf', contentUrl: `${SITE_URL}${PDF_HREF}` },
        { '@type': 'DataDownload', name: 'Brief (11 pages)', encodingFormat: 'application/pdf', contentUrl: `${SITE_URL}${BRIEF_HREF}` },
        { '@type': 'DataDownload', name: 'Report figures', encodingFormat: 'text/csv', contentUrl: `${SITE_URL}/reports/displacement-report-2026-09-data.csv` },
        { '@type': 'DataDownload', name: 'SEC Item 2.05 AI coding', encodingFormat: 'text/csv', contentUrl: `${SITE_URL}/reports/sec-item205-ai-coding-2026.csv` },
        { '@type': 'DataDownload', name: 'Q3 2026 revenue per employee', encodingFormat: 'text/csv', contentUrl: `${SITE_URL}/reports/displacement-report-2026-q3-revenue-per-employee.csv` },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Reports', item: `${SITE_URL}/reports` },
        { '@type': 'ListItem', position: 3, name: 'September 2026', item: URL },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is the NextChapter White-Collar Long-Term Unemployment Index?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'A monthly measure of long-term unemployment among managers and professionals (27+ weeks unemployed as a share of the white-collar labor force), seasonally adjusted, 3-month average, 2019 = 100, calculated by NextChapter from Census CPS microdata. It was 162 in August 2026.',
          },
        },
        {
          '@type': 'Question',
          name: 'What was the U.S. unemployment rate in September 2026?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: '4.2%, up from 4.1% in August and down from 4.4% in September 2025, according to BLS. Employers added 29,000 jobs.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is immigration causing long-term unemployment among professionals?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Not on NextChapter\'s data. Long-term unemployment among U.S.-born white-collar workers rose from 0.52% to 0.73% of their labor force (January–August 2025 vs 2026), while the noncitizen share of the white-collar workforce stayed at 6.3%.',
          },
        },
        {
          '@type': 'Question',
          name: 'How many people are long-term unemployed?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: '1.94 million people had been unemployed 27 weeks or more in September 2026, 27.1% of all unemployed, up from 23.6% a year earlier. About two in three have been looking a year or more.',
          },
        },
        {
          '@type': 'Question',
          name: 'How many layoffs have been blamed on AI in 2026?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Employers attributed 120,136 announced job cuts to AI from January through September 2026, about 21% of announced cuts (Challenger, Gray & Christmas). 16 of 170 SEC restructuring filings (9.4%) cite AI in the restructuring disclosure itself.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is AI causing higher unemployment?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Most 2026 research, including from the Yale Budget Lab and the Federal Reserve, finds no broad AI effect on unemployment yet. Stanford and others find reduced hiring of young workers in highly AI-exposed jobs.',
          },
        },
        {
          '@type': 'Question',
          name: 'How many applications does it take to get a job in 2026?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Employers received about 244 applications per job in 2025 (Greenhouse) and more than 300 per hire in 2026 (Ashby). Among Huntr job-tracker users, two-thirds of offers came within 50 applications, roughly 24 to 48 applications per interview.',
          },
        },
        {
          '@type': 'Question',
          name: 'When is the next BLS jobs report?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The October 2026 report comes out Friday, November 6, 2026 at 8:30 a.m. Eastern, and the November report on Friday, December 4.',
          },
        },
      ],
    },
  ],
}

export default function DisplacementReportSeptember2026() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <PublicSiteHeader current="reports" />

      {/* Correction notice, linking to the correction boxes in Chapters 03 and 07. */}
      <div className="border-b border-warning/40 bg-warning/10">
        <div className="mx-auto w-full max-w-5xl px-6 py-2.5 text-sm text-navy">
          <span className="font-semibold">Corrected October 6, 2026.</span>{' '}
          The count of SEC restructuring filings citing AI was revised from 2 to 16 (
          <a href="#correction" className="font-medium underline underline-offset-4">Chapter 03</a>), and the fall in
          participation for ages 55+ comes from an aging population, not older workers leaving work (
          <a href="#correction-2" className="font-medium underline underline-offset-4">Chapter 07</a>).
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <div className="ncr" dangerouslySetInnerHTML={{ __html: REPORT_BODY_HTML }} />

      {/* Author box — site styles, outside the scoped report CSS. */}
      <section className="border-t border-light-gray bg-white">
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
          <AuthorByline updated={MODIFIED} className="mb-6" />
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

      <PublicSiteFooter page="reports" />

      {/* Client enhancements: Logo in the cover, newsletter in the in-content
          slot, the PDF email gate, and the scroll/time pop-up. */}
      <ReportEnhancements pdfHref={PDF_HREF} pdfFilename={PDF_FILENAME} popupPlacement="report-edition" />
      <Script src="/reports/report-charts.js" strategy="afterInteractive" />
    </div>
  )
}
