import Link from 'next/link'
import { Logo } from '@/components/Logo'
import type { CompetitorComparison } from '@/lib/marketing/competitor-comparisons'
import { WHERE_THEY_MAY_BE_STRONGER_NOTE } from '@/lib/marketing/competitor-comparisons'
import { ComparisonCtaLink } from './ComparisonCtaLink'

// Every sentence rendered here comes from competitor-comparisons.ts, whose NextChapter statements are keyed to
// docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md. Competitor columns are questions, never claims.
export function ComparisonPageTemplate({ comparison }: { comparison: CompetitorComparison }) {
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
        {/* Statements about NextChapter are listed in docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md.
            Nothing is claimed about the other vendor, so none of it can go stale. */}
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
          The NextChapter column describes our own product. The {comparison.name} column is a list of questions,
          not statements, because we have not verified current details of its offering. Confirm everything
          directly with {comparison.name} before you decide.
        </div>

        <h1 className="mt-8 text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          NextChapter vs. {comparison.name}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{comparison.bestForSummary}</p>

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-xl font-bold tracking-tight text-navy">Feature comparison</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-semibold text-navy">&nbsp;</th>
                  <th className="py-2 pr-4 font-semibold text-brand">NextChapter</th>
                  <th className="py-2 font-semibold text-navy">Ask {comparison.name}</th>
                </tr>
              </thead>
              <tbody>
                {comparison.featureComparison.map((row) => (
                  <tr key={row.aspect} className="border-b border-border align-top">
                    <td className="py-3 pr-4 font-medium text-foreground">{row.aspect}</td>
                    <td className="py-3 pr-4 text-foreground">{row.us}</td>
                    <td className="py-3 text-muted-foreground">{row.ask}</td>
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
              Ask {comparison.name}: {comparison.whatParticipantsKeep.ask}
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-navy">What the employer sees</h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground">{comparison.whatTheEmployerSees.us}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Ask {comparison.name}: {comparison.whatTheEmployerSees.ask}
            </p>
          </div>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-xl font-bold tracking-tight text-navy">What to check about any vendor</h2>
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
            Our vendor-neutral RFP template lists eight questions to put to any outplacement vendor. You can put them to {comparison.name} and to us.
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
            Plans
          </Link>
        </div>
      </main>
    </div>
  )
}
