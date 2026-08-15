import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'
import { COMPETITOR_COMPARISONS } from '@/lib/marketing/competitor-comparisons'

export const metadata: Metadata = {
  title: 'Compare outplacement providers — NextChapter',
  description:
    'Honest, two-sided comparisons of NextChapter against LHH, Randstad RiseSmart, Careerminds, and INTOO — pricing, reporting, what participants keep, and where each is genuinely stronger.',
  alternates: { canonical: '/vs' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Compare outplacement providers — NextChapter',
}

// Index page for the four /vs/[competitor] comparisons — Partners Master
// Build Script §D2.8. Not itself a page with comparative claims, so it
// carries no substantiation-file rows of its own.
export default function ComparisonIndexPage() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6">
          <Link href="/" className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
          <nav className="flex items-center gap-1.5 text-sm">
            <Link href="/employers" className="shrink-0 font-medium text-brand hover:text-navy">
              For Employers
            </Link>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-medium text-foreground">Compare</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          How NextChapter compares
        </h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          Written fairly, on purpose — including where each provider is genuinely stronger. A one-sided
          comparison gets dismissed as marketing; this one is built to be forwarded.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {COMPETITOR_COMPARISONS.map((c) => (
            <Link
              key={c.slug}
              href={`/vs/${c.slug}`}
              className="rounded-xl border border-light-gray bg-white p-6 transition-colors hover:border-brand hover:shadow-md"
            >
              <p className="text-lg font-semibold text-navy">NextChapter vs. {c.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.bestForSummary}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand">
                Compare <ChevronRight className="size-4" />
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/rfp-template" className="underline underline-offset-4">
            Outplacement RFP template &amp; vendor scorecard
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
