import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'
import { CostCalculator } from '@/components/marketing/CostCalculator'
import { getCurrentPlan } from '@/lib/admin/plan-catalog'

export const metadata: Metadata = {
  title: 'What outplacement actually costs, and what you get — NextChapter',
  description:
    'Outplacement cost per employee, broken down by tier — plus an interactive calculator comparing published NextChapter pricing against typical incumbent ranges.',
  alternates: { canonical: '/insights/outplacement-cost-per-employee' },
  openGraph: {
    title: 'What outplacement actually costs, and what you get',
    description: 'Outplacement cost per employee, broken down by tier, with a live cost calculator.',
    url: 'https://launchyournextchapter.com/insights/outplacement-cost-per-employee',
    type: 'article',
  },
}

const LAST_UPDATED = '2026-08-15'

// Partners Master Build Script §D2.7's first category-narrative piece,
// carrying the §D2.4 cost calculator (seats × tier → real price via
// getCurrentPlan(), incumbent range from §A2.1). Targets the §C5 organic
// term "outplacement cost per employee."
export default async function OutplacementCostArticlePage() {
  const [core, plus, premium] = await Promise.all([
    getCurrentPlan('outplacement_core'),
    getCurrentPlan('outplacement_plus'),
    getCurrentPlan('outplacement_premium'),
  ])

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'What outplacement actually costs, and what you get',
    dateModified: LAST_UPDATED,
    author: { '@type': 'Organization', name: 'NextChapter' },
    publisher: { '@type': 'Organization', name: 'NextChapter' },
    mainEntityOfPage: 'https://launchyournextchapter.com/insights/outplacement-cost-per-employee',
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
          What outplacement actually costs, and what you get
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated {LAST_UPDATED}</p>

        <div className="mt-8 space-y-4 text-base leading-relaxed text-foreground">
          <p>
            Outplacement pricing is rarely published, which makes it hard to know whether a quote is
            reasonable. Industry pricing generally runs in three bands: a lower-cost, fully virtual tier
            (roughly $1,000–$3,000 per person), a mid-level tier commonly associated with larger established
            providers (roughly $3,500–$7,000 per person), and an executive tier (roughly $8,000–$15,000 or more
            per person, typically over a 6–12 month term). These are directional industry figures, not a
            specific vendor&apos;s current quote — always ask any vendor, including us, for their actual
            current pricing.
          </p>
          <p>
            The bigger question isn&apos;t just the number — it&apos;s what that number buys. A lower price
            with a large caseload and a templated curriculum isn&apos;t automatically a better deal than a
            higher price with a lower participant-to-coach ratio and real reporting. Before comparing prices,
            it&apos;s worth deciding what you actually need: coaching depth, reporting latency, what the
            participant keeps afterward, and how the price scales with volume.
          </p>
          <p>
            NextChapter publishes list pricing in full, with volume discounts disclosed up front (25+ seats
            −10%, 100+ seats −18%, 250+ seats −25%) — see the calculator below, which reads live from our
            actual pricing, or the full breakdown at{' '}
            <Link href="/pricing" className="text-primary underline underline-offset-4">
              /pricing
            </Link>
            .
          </p>
        </div>

        <div className="mt-10">
          <h2 className="text-xl font-bold tracking-tight text-navy">Estimate your cost</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your seat count and pick a tier. The NextChapter number is our real, published price. The
            incumbent range is a directional estimate — see the note below the calculator for its source.
          </p>
          <div className="mt-4">
            <CostCalculator
              prices={{
                outplacement_core: core?.priceCents ?? null,
                outplacement_plus: plus?.priceCents ?? null,
                outplacement_premium: premium?.priceCents ?? null,
              }}
            />
          </div>
        </div>

        <div className="mt-12 rounded-xl border border-light-gray bg-off-white p-6">
          <p className="text-sm font-semibold text-navy">Want to compare a specific vendor?</p>
          <p className="mt-2 text-sm text-muted-foreground">
            See our honest, two-sided comparisons at{' '}
            <Link href="/vs" className="text-primary underline underline-offset-4">
              /vs
            </Link>{' '}
            or run any vendor through our{' '}
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
          <Link href="/employers" className="underline underline-offset-4">
            NextChapter for employers
          </Link>
        </div>
      </main>
    </div>
  )
}
