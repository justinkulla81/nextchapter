import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'
import { SeatUtilizationMockup } from '@/components/marketing/SeatUtilizationMockup'

export const metadata: Metadata = {
  title: 'Why your outplacement report says nothing — NextChapter',
  description:
    'Outplacement is usually measured by utilization — logins, sessions completed — not by what a participant actually produced. Here is why that gap matters, and what to ask for instead.',
  alternates: { canonical: '/insights/outplacement-reporting' },
  openGraph: {
    title: 'Why your outplacement report says nothing',
    description: 'Utilization isn’t outcome. What to ask your provider to report instead.',
    url: 'https://launchyournextchapter.com/insights/outplacement-reporting',
    type: 'article',
  },
}

const LAST_UPDATED = '2026-08-15'

// Partners Master Build Script §D2.7's third category-narrative piece,
// carrying the argument named there: "outplacement is measured wrong...
// the industry sells access and reports on utilization. Nobody reports on
// what the participant produced." No placement-rate or speed claim
// anywhere in this file — §C1.3 / §D3 boundary — see the phase report's
// grep check.
export default function OutplacementReportingArticlePage() {
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Why your outplacement report says nothing',
    dateModified: LAST_UPDATED,
    author: { '@type': 'Organization', name: 'NextChapter' },
    publisher: { '@type': 'Organization', name: 'NextChapter' },
    mainEntityOfPage: 'https://launchyournextchapter.com/insights/outplacement-reporting',
  }

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={articleJsonLd} />
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
          Why your outplacement report says nothing
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated {LAST_UPDATED}</p>

        <div className="mt-8 space-y-4 text-base leading-relaxed text-foreground">
          <p>
            Most outplacement reporting measures utilization: how many participants logged in, how many
            sessions they completed, how many resources they opened. Utilization is easy to measure and easy
            to report, which is probably why it&apos;s what most vendors report. It is also not the same thing
            as an outcome. A participant can complete every session on a curriculum and still not have a
            resume that passes an applicant tracking system, a set of references ready to speak on their
            behalf, or a clear sense of what companies to target.
          </p>
          <p>
            The industry sells access — a coach, a portal, a job board — and reports on whether that access
            was used. Almost nobody reports on what the participant actually produced with it: a scored,
            structured view of where their search stands and what specifically is holding it back.
          </p>
          <p>
            This isn&apos;t a claim about how fast anyone gets hired — we don&apos;t have outcome data to make
            that claim yet, and we won&apos;t make it until we do. It&apos;s a claim about what gets measured
            in the meantime, and whether &ldquo;62% logged in this month&rdquo; tells an HR buyer anything
            useful about whether the program is working.
          </p>
        </div>

        <div className="mt-10">
          <h2 className="text-xl font-bold tracking-tight text-navy">What we report instead</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Every NextChapter candidate is scored across the same competency model — targeting, resume signal,
            networking, applications, and more. Employers see aggregate results across their cohort, live, not
            a quarterly summary of logins. They never see an individual&apos;s grade or activity — that
            boundary is contractual.
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
