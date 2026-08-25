import Link from 'next/link'
import { Logo } from '@/components/Logo'
import type { CompetitorComparison } from '@/lib/marketing/competitor-comparisons'
import { WHERE_THEY_MAY_BE_STRONGER_NOTE } from '@/lib/marketing/competitor-comparisons'
import { ComparisonCtaLink } from './ComparisonCtaLink'

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface OurPricing {
  core: number | null
  plus: number | null
  premium: number | null
}

// Partners Master Build Script §D2.8: "what each is best for · honest
// feature comparison · pricing comparison · what participants keep · what
// the employer sees · when to choose them instead." §C5: "including where
// LHH is stronger... converts better than a one-sided table." Every
// comparative sentence rendered here comes from competitor-comparisons.ts,
// which is itself keyed to docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md — see
// that file before changing any claim on this template.
export function ComparisonPageTemplate({
  comparison,
  ourPricing,
}: {
  comparison: CompetitorComparison
  ourPricing: OurPricing
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6">
          <Link href="/" className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
          <nav className="flex items-center gap-1.5 text-sm">
            <Link href="/vs" className="font-medium text-brand hover:text-navy">
              Compare
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-foreground">{comparison.shortName}</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-16">
        {/* Honesty banner — this build has no independently verified
            competitor data; see docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md. */}
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
          Every comparative statement below is sourced and dated in our{' '}
          <span className="font-medium">competitive claims substantiation file</span>, reviewed on a quarterly
          cycle. Pricing and feature information about {comparison.name} reflects our own published research as
          of this page&apos;s last review date and may not reflect their current offering — always confirm
          directly with {comparison.name} before relying on it for a purchase decision.
        </div>

        <h1 className="mt-8 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          NextChapter vs. {comparison.name}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{comparison.bestForSummary}</p>

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-xl font-bold tracking-tight text-navy">Pricing comparison</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-light-gray bg-off-white p-5">
              <p className="text-sm font-semibold text-navy">{comparison.name}</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{comparison.pricingRangeLabel}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{comparison.pricingRangeCaveat}</p>
            </div>
            <div className="rounded-xl border border-brand bg-white p-5">
              <p className="text-sm font-semibold text-brand">NextChapter</p>
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                <li>
                  Core — {ourPricing.core !== null ? formatUsd(ourPricing.core) : '—'} / seat (6 mo)
                </li>
                <li>
                  Plus — {ourPricing.plus !== null ? formatUsd(ourPricing.plus) : '—'} / seat (6 mo)
                </li>
                <li>
                  Premium — {ourPricing.premium !== null ? formatUsd(ourPricing.premium) : '—'} / seat (12 mo)
                </li>
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Published list prices, read live from our plan catalog. Volume pricing available: 25+ seats −10%
                · 100+ seats −18% · 250+ seats −25%. Full detail at{' '}
                <Link href="/pricing" className="underline underline-offset-4">
                  /pricing
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-xl font-bold tracking-tight text-navy">Honest feature comparison</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-semibold text-navy">&nbsp;</th>
                  <th className="py-2 pr-4 font-semibold text-brand">NextChapter</th>
                  <th className="py-2 font-semibold text-navy">{comparison.name}</th>
                </tr>
              </thead>
              <tbody>
                {comparison.featureComparison.map((row) => (
                  <tr key={row.aspect} className="border-b border-border align-top">
                    <td className="py-3 pr-4 font-medium text-foreground">{row.aspect}</td>
                    <td className="py-3 pr-4 text-foreground">{row.us}</td>
                    <td className="py-3 text-muted-foreground">{row.them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12 grid gap-6 border-t border-border pt-8 sm:grid-cols-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-navy">What participants keep</h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground">{comparison.whatParticipantsKeep.us}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {comparison.name}: {comparison.whatParticipantsKeep.them}
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-navy">What the employer sees</h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground">{comparison.whatTheEmployerSees.us}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {comparison.name}: {comparison.whatTheEmployerSees.them}
            </p>
          </div>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-xl font-bold tracking-tight text-navy">Where they may be stronger — genuinely</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {WHERE_THEY_MAY_BE_STRONGER_NOTE}
          </p>
          <ul className="mt-4 space-y-2">
            {comparison.whereTheyMayBeStrongerBullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3 text-sm text-foreground">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                {bullet}
              </li>
            ))}
          </ul>
          <blockquote className="mt-6 border-l-4 border-brand bg-off-white px-5 py-4 text-base leading-relaxed text-navy italic">
            &ldquo;{comparison.concessionParagraph}&rdquo;
          </blockquote>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-xl font-bold tracking-tight text-navy">When to choose {comparison.name} instead</h2>
          <ul className="mt-4 space-y-2">
            {comparison.whenToChooseThemInstead.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-foreground">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-16 rounded-xl bg-navy px-8 py-10 text-center text-white">
          <h2 className="text-2xl font-bold tracking-tight">Run your own comparison</h2>
          <p className="mx-auto mt-2 max-w-xl text-light-blue">
            Our vendor-neutral RFP template asks the eight questions that separate a real evaluation from a
            sales pitch — including the ones {comparison.name} answers differently than we do.
          </p>
          <ComparisonCtaLink competitorSlug={comparison.slug} />
        </div>

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/vs" className="underline underline-offset-4">
            ← Compare all providers
          </Link>
          {' · '}
          <Link href="/outplacement" className="underline underline-offset-4">
            NextChapter for employers
          </Link>
          {' · '}
          <Link href="/pricing" className="underline underline-offset-4">
            Full pricing
          </Link>
        </div>
      </main>
    </div>
  )
}
