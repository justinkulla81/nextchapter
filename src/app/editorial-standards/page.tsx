import type { Metadata } from 'next'
import Link from 'next/link'
import { StructuredData } from '@/components/StructuredData'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { latestReport, reportPath } from '@/lib/reports'
import { canonical } from '@/lib/seo/canonical'
import { FACTS } from '@/lib/seo/facts'
import { organizationRef } from '@/lib/seo/jsonld'

const DESCRIPTION =
  'How NextChapter researches and sources its guides, reports and news, how that work is kept separate from what we sell, and how to report an error.'

export const metadata: Metadata = {
  title: 'Editorial standards',
  description: DESCRIPTION,
  ...canonical('/editorial-standards'),
}

// Last reviewed date for this page itself; change it when the policy changes.
const UPDATED = '2026-10-06'

const H2 = 'mt-12 text-xl font-semibold tracking-tight text-navy'
const LINK = 'text-brand underline underline-offset-4'

export default function EditorialStandardsPage() {
  const report = latestReport()
  const methodHref = report ? `${reportPath(report)}#method` : '/reports'

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Editorial standards',
          description: DESCRIPTION,
          dateModified: UPDATED,
          publisher: organizationRef(),
        }}
      />
      <PublicSiteHeader />

      <main className="mx-auto w-full max-w-3xl px-6 py-16 text-base leading-relaxed text-foreground">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">Editorial standards</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated October 6, 2026</p>
        <p className="mt-6">
          This page covers everything NextChapter publishes for readers: the guides in{' '}
          <Link href="/resources" className={LINK}>Resources</Link>, the{' '}
          <Link href="/reports" className={LINK}>Displacement Report</Link> and White-Collar Index, articles in{' '}
          <Link href="/insights" className={LINK}>Insights</Link>, and our takes in{' '}
          <Link href="/news" className={LINK}>News</Link>.
        </p>

        <h2 className={H2}>How we research and source</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5">
          <li>
            We start from primary sources: the Bureau of Labor Statistics, Census Bureau survey microdata, the
            Department of Labor, state agencies and their WARN filings, and SEC filings. Where we use a private
            dataset or survey, we name it.
          </li>
          <li>Every figure in a report is linked to its source or explained in the methodology, and the data files are published.</li>
          <li>
            When we comment on someone else’s article, we quote it briefly, credit it, and link to it. Our take is
            labeled as ours.
          </li>
          <li>Statistics never use NextChapter customer data.</li>
        </ul>

        <h2 className={H2}>What we sell, and how content stays separate</h2>
        <p className="mt-4">
          NextChapter sells career-transition software and services to professionals, employers and workforce
          programs. That gives us a commercial interest in the subjects we write about. To keep the two apart:
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5">
          <li>
            The measures in each Displacement Report are fixed in advance and reported every month, whether they move
            up or down.
          </li>
          <li>In the Displacement Report, NextChapter’s own services appear only in the closing “About NextChapter” section.</li>
          <li>We do not publish employer rankings or “worst employer” lists, and we never publish information about individual workers.</li>
          <li>We do not accept payment for coverage, and there are no paid or sponsored placements.</li>
        </ul>

        <h2 className={H2}>How we use AI</h2>
        <p className="mt-4">
          NextChapter is an AI company, and we use AI in our own research and writing the way we encourage job seekers to
          use it: to work faster and more thoroughly, with a person accountable for the result.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5">
          <li>
            AI tools help us gather and read sources, analyze public data, draft text and check our work against the
            sources we cite.
          </li>
          <li>
            Every figure comes from a named source or a published NextChapter calculation. AI is never the source of a
            number, a quote or a fact.
          </li>
          <li>
            The named author reviews every page before it is published and is responsible for it, whatever tools were
            used to produce it.
          </li>
          <li>Where AI does something readers should know about, such as producing a chart or a summary, we say so.</li>
        </ul>

        <h2 className={H2}>Bylines and review</h2>
        <p className="mt-4">
          Every guide, report and article names its author and the date it was last updated. A “Reviewed by” line
          appears only when a named expert has actually reviewed that page.
        </p>

        <h2 className={H2}>Methodology</h2>
        <p className="mt-4">
          The Displacement Report’s definitions, seasonal adjustment, margins of error and fixed list of monthly
          measures are in its{' '}
          <Link href={methodHref} className={LINK}>methodology appendix</Link>.
        </p>

        <h2 className={H2}>Corrections</h2>
        <p className="mt-4">
          When we get something wrong, we fix it on the page and add a dated note saying what changed. Updated data
          files are republished to match. To report an error, email{' '}
          <a href={`mailto:${FACTS.contactEmail}?subject=Correction`} className={LINK}>{FACTS.contactEmail}</a>{' '}
          with the page address and what you think is wrong.
        </p>
      </main>

      <PublicSiteFooter page="editorial" />
    </div>
  )
}
