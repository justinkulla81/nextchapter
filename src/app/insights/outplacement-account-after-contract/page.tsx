import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'

export const metadata: Metadata = {
  title: 'What happens to your outplacement account when the contract ends — NextChapter',
  description:
    'Most outplacement portal access ends when the employer contract ends. Here is what to ask before you sign, and how a permanent alumni account changes the calculus.',
  alternates: { canonical: '/insights/outplacement-account-after-contract' },
  openGraph: {
    title: 'What happens to your outplacement account when the contract ends',
    description: 'What to ask before you sign a program that leaves participants with a lapsed login.',
    url: 'https://launchyournextchapter.com/insights/outplacement-account-after-contract',
    type: 'article',
  },
}

const LAST_UPDATED = '2026-08-15'

// Partners Master Build Script §D2.7's fourth category-narrative piece.
// Ties directly to a real, shipped capability (Phase 8's free, permanent
// Alumni tier — Dossier stays live, references stay collected) rather than
// asserting anything about a specific competitor's data-retention practice.
export default function OutplacementAccountAfterContractArticlePage() {
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'What happens to your outplacement account when the contract ends',
    dateModified: LAST_UPDATED,
    author: { '@type': 'Organization', name: 'NextChapter' },
    publisher: { '@type': 'Organization', name: 'NextChapter' },
    mainEntityOfPage: 'https://launchyournextchapter.com/insights/outplacement-account-after-contract',
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
          What happens to your outplacement account when the contract ends
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated {LAST_UPDATED}</p>

        <div className="mt-8 space-y-4 text-base leading-relaxed text-foreground">
          <p>
            Outplacement is typically purchased on a term — six months, twelve months, tied to the employer&apos;s
            contract. What isn&apos;t always clear going in is what happens to the participant&apos;s account,
            data, and access once that term ends. In many programs, access ends with the contract: the resume
            drafts, the coaching notes, the login itself. The employer already paid for the benefit, but the
            person who used it is left with nothing durable to show for it once the clock runs out.
          </p>
          <p>
            This is worth asking about before you sign, not after — question 7 in our{' '}
            <Link href="/rfp-template" className="text-primary underline underline-offset-4">
              RFP template
            </Link>{' '}
            asks it directly: &ldquo;What happens to the participant&apos;s data and access at contract
            end?&rdquo; Ask for specifics — what&apos;s deleted, what&apos;s retained, and who controls that
            decision.
          </p>
        </div>

        <div className="mt-10 rounded-xl border border-light-gray bg-off-white p-6">
          <h2 className="text-lg font-bold tracking-tight text-navy">How NextChapter handles it</h2>
          <p className="mt-3 text-sm leading-relaxed text-foreground">
            Anyone placed through a NextChapter outplacement seat becomes a free, permanent alumnus — no
            separate purchase, no re-enrollment. Their Executive Dossier stays live, their collected references
            stay collected, and their account doesn&apos;t lapse when the employer&apos;s contract term ends.
            The employer&apos;s own reporting access to that cohort does end per the contract, consistent with
            the trust boundary we describe on{' '}
            <Link href="/outplacement" className="text-primary underline underline-offset-4">
              /employers
            </Link>
            : an employer never sees an individual&apos;s activity, grade, or whether they used the product,
            during the contract or after it.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-foreground">
            See what stays with the participant at{' '}
            <Link href="/dossier" className="text-primary underline underline-offset-4">
              /dossier
            </Link>{' '}
            and{' '}
            <Link href="/membership" className="text-primary underline underline-offset-4">
              /membership
            </Link>
            .
          </p>
        </div>

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/insights" className="underline underline-offset-4">
            ← All insights
          </Link>
          {' · '}
          <Link href="/vs" className="underline underline-offset-4">
            Compare providers
          </Link>
        </div>
      </main>
    </div>
  )
}
