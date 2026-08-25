import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'

export const metadata: Metadata = {
  title: 'Outplacement insights — NextChapter',
  description:
    'What outplacement actually costs, the questions to ask a vendor, why utilization reporting misses the point, and what happens to your account when the contract ends.',
  alternates: { canonical: '/insights' },
}

const ARTICLES = [
  {
    href: '/insights/outplacement-cost-per-employee',
    title: 'What outplacement actually costs, and what you get',
    description: 'Cost per employee by tier, plus a live calculator against published NextChapter pricing.',
  },
  {
    href: '/insights/outplacement-vendor-questions',
    title: 'The questions to ask an outplacement vendor',
    description: 'Eight questions that separate a real evaluation from a sales pitch.',
  },
  {
    href: '/insights/outplacement-reporting',
    title: 'Why your outplacement report says nothing',
    description: 'Utilization isn’t outcome. What to ask your provider to report instead.',
  },
  {
    href: '/insights/outplacement-account-after-contract',
    title: 'What happens to your outplacement account when the contract ends',
    description: 'What to ask before you sign, and how a permanent alumni account changes the calculus.',
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Outplacement insights — NextChapter',
}

export default function InsightsIndexPage() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6">
          <Link href="/" className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
          <nav className="flex items-center gap-1.5 text-sm">
            <Link href="/outplacement" className="font-medium text-brand hover:text-navy">
              For Employers
            </Link>
            <ChevronRight className="size-4 text-muted-foreground" />
            <span className="font-medium text-foreground">Insights</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">Outplacement insights</h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          Truthful, specific, and built from real product capability — not filler.
        </p>

        <div className="mt-10 space-y-4">
          {ARTICLES.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="block rounded-xl border border-light-gray bg-white p-6 transition-colors hover:border-brand hover:shadow-md"
            >
              <p className="text-lg font-semibold text-navy">{a.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{a.description}</p>
            </Link>
          ))}
        </div>

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/rfp-template" className="underline underline-offset-4">
            Outplacement RFP template
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
