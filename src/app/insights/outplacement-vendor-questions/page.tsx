import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'
import { RFP_QUESTIONS } from '@/lib/marketing/rfp-template-content'

export const metadata: Metadata = {
  title: 'The questions to ask an outplacement vendor — NextChapter',
  description:
    'Eight questions that separate a real outplacement evaluation from a sales pitch — deliverable retention, reporting latency, reference completion, and more.',
  alternates: { canonical: '/insights/outplacement-vendor-questions' },
  openGraph: {
    title: 'The questions to ask an outplacement vendor',
    description: 'Eight questions that separate a real outplacement evaluation from a sales pitch.',
    url: 'https://launchyournextchapter.com/insights/outplacement-vendor-questions',
    type: 'article',
  },
}

const LAST_UPDATED = '2026-08-15'

// Partners Master Build Script §D2.7's second category-narrative piece,
// built directly from the §D2.2 RFP question set so the two assets
// reinforce each other rather than duplicating separate content.
export default function OutplacementVendorQuestionsArticlePage() {
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'The questions to ask an outplacement vendor',
    dateModified: LAST_UPDATED,
    author: { '@type': 'Organization', name: 'NextChapter' },
    publisher: { '@type': 'Organization', name: 'NextChapter' },
    mainEntityOfPage: 'https://launchyournextchapter.com/insights/outplacement-vendor-questions',
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
          The questions to ask an outplacement vendor
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated {LAST_UPDATED}</p>

        <div className="mt-8 space-y-4 text-base leading-relaxed text-foreground">
          <p>
            Most outplacement RFPs ask about years in business, client logos, and caseload capacity. Those
            questions are easy for any established vendor to answer well, and they don&apos;t tell you much
            about what a departing employee will actually experience. The eight questions below are harder to
            answer — and the answers actually differentiate one program from another.
          </p>
          <p>
            Ask every finalist the same eight questions, in writing, and compare the answers side by side
            rather than the sales pitch. We built a{' '}
            <Link href="/rfp-template" className="text-primary underline underline-offset-4">
              free, vendor-neutral RFP template and scorecard
            </Link>{' '}
            around exactly this list, with no vendor named anywhere in it — use it with any provider you&apos;re
            evaluating.
          </p>
        </div>

        <ol className="mt-10 space-y-6">
          {RFP_QUESTIONS.map((q, i) => (
            <li key={q.question} className="rounded-xl border border-light-gray bg-off-white p-5">
              <p className="font-semibold text-navy">
                {i + 1}. {q.question}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{q.whyItMatters}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 space-y-4 text-base leading-relaxed text-foreground">
          <p>
            One pattern worth naming: references are commonly collected late in a search, often only once an
            offer is already on the table. Structuring reference collection earlier — before you&apos;re
            meeting with a client or hiring manager — is a design choice a program either makes or doesn&apos;t,
            and it&apos;s worth asking about directly (question 4 above).
          </p>
        </div>

        <div className="mt-12 rounded-xl border border-light-gray bg-off-white p-6">
          <p className="text-sm font-semibold text-navy">See how a specific vendor stacks up</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Honest, two-sided comparisons — including where each provider is genuinely stronger — at{' '}
            <Link href="/vs" className="text-primary underline underline-offset-4">
              /vs
            </Link>
            .
          </p>
        </div>

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/insights" className="underline underline-offset-4">
            ← All insights
          </Link>
          {' · '}
          <Link href="/rfp-template" className="underline underline-offset-4">
            Get the RFP template
          </Link>
        </div>
      </main>
    </div>
  )
}
