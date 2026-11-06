import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'
import { PullTop } from '@/components/capture/PullCta'
import { NICHES } from '@/lib/niches/niches'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'
import { Squiggle } from '@/components/ui/squiggle'

export const metadata: Metadata = pageMetadata('/niches')

export default function NichesIndexPage() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Job search and career services by type', url: 'https://launchyournextchapter.com/niches' }} />
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6">
          <Link href="/" className="shrink-0"><Logo className="text-2xl" /></Link>
          <nav className="flex items-center gap-1.5 text-sm">
            <Link href="/vs" className="font-medium text-brand hover:text-navy">Compare</Link>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-medium text-foreground">By type</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-6 py-8">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">{pageH1('/niches', 'Job search and career services by type')}</h1>
        <Squiggle className="mt-2" />
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          Each page explains one kind of service, what to ask before you pay, and lists companies in it with a link to their own site.
        </p>
        <PullTop name="Services by type" path="/niches" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {NICHES.map((n) => (
            <Link key={n.slug} href={`/niches/${n.slug}`} className="rounded-xl border border-light-gray bg-white p-6 transition-colors hover:border-brand hover:shadow-md">
              <p className="text-lg font-semibold text-navy">{n.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{n.whoFor}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand">See the list <ChevronRight className="size-4" /></span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
