import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'
import { getCurrentPlan } from '@/lib/admin/plan-catalog'

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export const metadata = {
  title: 'Pricing — NextChapter',
  description: 'Real prices, published — candidate plans, membership, and outplacement list pricing.',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Pricing — NextChapter',
}

// Partners Master Build Script §C3.4 — "publish candidate and membership
// prices... publish outplacement list prices with 'volume pricing
// available.'" Every number here reads live from PlanCatalogEntry via
// getCurrentPlan(), never hardcoded — see the plan-catalog.ts comment
// flagging this exact page as the intended caller.
export default async function PricingPage() {
  const [free, resume, coachingPlus, coachingPremium, executive, membershipMonthly, membershipAnnual, core, plus, premium] =
    await Promise.all([
      getCurrentPlan('dtc_free'),
      getCurrentPlan('dtc_resume'),
      getCurrentPlan('dtc_coaching_plus'),
      getCurrentPlan('dtc_coaching_premium'),
      getCurrentPlan('dtc_executive'),
      getCurrentPlan('membership_monthly'),
      getCurrentPlan('membership_annual'),
      getCurrentPlan('outplacement_core'),
      getCurrentPlan('outplacement_plus'),
      getCurrentPlan('outplacement_premium'),
    ])

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6">
          <Link href="/" className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
          <nav className="flex items-center gap-1.5 text-sm">
            <span className="font-medium text-foreground">Pricing</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
            Every price, published.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
            No negotiation on candidate or membership pricing. Volume pricing available on outplacement —
            ask, we&apos;ll quote it in the walkthrough.
          </p>
        </div>

        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight text-navy">For candidates</h2>
          <p className="mt-1 text-sm text-muted-foreground">NextChapter is free for candidates, always.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { plan: free, name: 'Free', description: 'Market Reality Report, Resume Studio, job matching, community, company pages.' },
              { plan: resume, name: 'Resume', description: 'Everything free, plus one human resume review, unlimited versions, per-job tailoring, full ATS matrix.' },
              { plan: coachingPlus, name: 'Coaching Plus', description: '1 session/month, resume review included, priority support.' },
              { plan: coachingPremium, name: 'Coaching Premium', description: '4 sessions/month, mock interviews with recorded feedback, negotiation support, named coach.' },
              { plan: executive, name: 'Executive', description: 'Everything in Coaching Premium, plus a named personal executive recruiter and weekly strategy sessions.' },
            ].map((tier) => (
              <div key={tier.name} className="rounded-xl border border-light-gray bg-white p-5 shadow-sm">
                <p className="font-semibold text-navy">{tier.name}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {tier.plan
                    ? tier.plan.priceCents === 0
                      ? 'Free'
                      : `${formatUsd(tier.plan.priceCents)}${tier.plan.billingPeriod === 'MONTHLY' ? '/mo' : ''}`
                    : '—'}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{tier.description}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Resume-only candidates still receive the Market Reality Grade — Your Evidence and Your Effort
            are visible but locked until you go further.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight text-navy">Alumni &amp; membership</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-light-gray bg-white p-5 shadow-sm">
              <p className="font-semibold text-navy">Alumni</p>
              <p className="mt-1 text-2xl font-bold text-foreground">Lifetime free</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Dossier stays live, remain an insider, give references, refer others, quarterly market
                pulse. You may also qualify for a $500 offer bonus.
              </p>
            </div>
            <div className="rounded-xl border border-light-gray bg-white p-5 shadow-sm">
              <p className="font-semibold text-navy">Membership</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {membershipMonthly ? formatUsd(membershipMonthly.priceCents) : '—'}/mo
                {membershipAnnual && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    or {formatUsd(membershipAnnual.priceCents)}/yr
                  </span>
                )}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Annual Dossier refresh, quarterly comp-benchmarked market check, Benefits Network, board and
                advisory listings, priority coach booking, break-glass reactivation.
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Membership is offered at placement — free for 12 months to anyone placed through a Premium
            outplacement seat.{' '}
            <Link href="/membership" className="text-primary underline underline-offset-4">
              Learn more →
            </Link>
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-bold tracking-tight text-navy">Outplacement — employer pays</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            List prices below. Volume pricing available: 25+ seats −10% · 100+ seats −18% · 250+ seats −25%.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { plan: core, name: 'Core' },
              { plan: plus, name: 'Plus' },
              { plan: premium, name: 'Premium' },
            ].map((tier) => (
              <div key={tier.name} className="rounded-xl border border-light-gray bg-white p-5 shadow-sm">
                <p className="font-semibold text-navy">{tier.name}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {tier.plan ? formatUsd(tier.plan.priceCents) : '—'}
                </p>
                <p className="text-xs text-muted-foreground">per seat</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Running a large-scale reduction or multi-year contract? Enterprise engagements beyond our
            standard volume tiers are custom-quoted —{' '}
            <Link href="/outplacement#walkthrough" className="text-primary underline underline-offset-4">
              contact us
            </Link>
            .
          </p>
          <p className="mt-4 text-sm">
            <Link href="/outplacement" className="text-primary underline underline-offset-4">
              See the full tier comparison and a sample compliance pack →
            </Link>
          </p>
          <p className="mt-2 text-sm">
            <Link href="/insights/outplacement-cost-per-employee" className="text-primary underline underline-offset-4">
              Estimate your cost against a typical incumbent range →
            </Link>
          </p>
        </section>

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/vs" className="underline underline-offset-4">
            Compare providers
          </Link>
          {' · '}
          <Link href="/rfp-template" className="underline underline-offset-4">
            RFP template
          </Link>
          {' · '}
          <Link href="/insights" className="underline underline-offset-4">
            Insights
          </Link>
        </div>
      </main>
    </div>
  )
}
