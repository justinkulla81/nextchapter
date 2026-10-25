import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { insight } from '@/lib/seo/insights'
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { SeatUtilizationMockup } from '@/components/marketing/SeatUtilizationMockup'

export const metadata: Metadata = {
  title: 'What your outplacement report should show',
  description:
    'Utilization (logins, sessions completed) is not the same as what a participant produced. Here is why that gap matters, and what to ask your provider to report.',
  alternates: { canonical: '/insights/outplacement-reporting' },
  openGraph: {
    title: 'What your outplacement report should show',
    description: 'Utilization isn’t outcome. What to ask your provider to report instead.',
    url: 'https://launchyournextchapter.com/insights/outplacement-reporting',
    type: 'article',
  },
}

const ARTICLE = insight('outplacement-reporting')

// Makes no claim about how the industry reports or about any vendor: only what a report should show and what
// NextChapter does (docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md, rows VS-1 and VS-3). No placement-rate or speed claim.
export default function OutplacementReportingArticlePage() {
  const jsonLd = articleJsonLd({
    headline: ARTICLE.title,
    path: '/insights/outplacement-reporting',
    description: ARTICLE.description,
    dateModified: ARTICLE.lastUpdated,
  })
  const breadcrumbs = breadcrumbJsonLd([
    { name: 'Insights', path: '/insights' },
    { name: ARTICLE.title, path: '/insights/outplacement-reporting' },
  ])

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <StructuredData data={breadcrumbs} />
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6">
          <Link href="/" className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
          <Link href="/insights" className="text-sm text-muted-foreground hover:text-foreground">
            ← All insights
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          What your outplacement report should show
        </h1>
        <AuthorByline updated={ARTICLE.lastUpdated} />

        <div className="mt-8 space-y-4 text-base leading-relaxed text-foreground">
          <p className="font-medium">
            A report that counts logins and sessions completed shows use, not what participants produced. Ask your provider what it reports beyond use: a resume that passes an applicant tracking system, references ready to speak, and a clear list of target companies.
          </p>
          <p>
            Utilization is how many participants logged in, how many sessions they completed, how many
            resources they opened. It is easy to measure and report. It is not the same thing as an
            outcome. A participant can complete every session on a curriculum and still not have a
            resume that passes an applicant tracking system, a set of references ready to speak on their
            behalf, or a clear sense of what companies to target.
          </p>
          <p>
            Access to a coach, a portal or a job board is one thing; what the participant produced with it
            is another. When you evaluate a provider, ask whether its report shows where each search stands
            and what is holding it back, or just whether the access was used.
          </p>
          <p>
            This isn&apos;t a claim about how fast anyone gets hired — we don&apos;t have outcome data to make
            that claim yet, and we won&apos;t make it until we do. It&apos;s a claim about what gets measured
            in the meantime, and whether a figure such as &ldquo;62% logged in this month&rdquo; (an example, not a
            real number) tells an HR buyer whether the program is working.
          </p>
        </div>

        <div className="mt-10">
          <h2 className="text-xl font-bold tracking-tight text-navy">What we report instead</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            NextChapter gives the employer a live roster of enrolled people and their status, aggregate
            outcomes for the program, and a printable quarterly review. Aggregates need a group of at least
            10, and no individual&apos;s activity, grade or usage is shown to the employer.
          </p>
          <div className="mt-4">
            <SeatUtilizationMockup />
          </div>
        </div>

        <div className="mt-12 rounded-xl border border-light-gray bg-off-white p-6">
          <p className="text-sm font-semibold text-navy">Ask your current or prospective vendor directly</p>
          <p className="mt-2 text-sm text-muted-foreground">
            &ldquo;Can we see utilization the day a cohort is enrolled?&rdquo; and &ldquo;What is your
            reporting latency — real time, monthly, or quarterly?&rdquo; are two of the eight questions in our{' '}
            <Link href="/rfp-template" className="text-primary underline underline-offset-4">
              free RFP template
            </Link>
            .
          </p>
        </div>

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/insights" className="underline underline-offset-4">
            ← All insights
          </Link>
          {' · '}
          <Link href="/outplacement" className="underline underline-offset-4">
            NextChapter for employers
          </Link>
        </div>
      </main>
    </div>
  )
}
