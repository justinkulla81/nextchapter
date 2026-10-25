import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { insight } from '@/lib/seo/insights'
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/seo/jsonld'

export const metadata: Metadata = {
  title: 'Outplacement accounts after the contract ends',
  description:
    'What a participant keeps when an employer-sponsored outplacement seat ends depends on the provider. Here is what to ask before you sign, and what stays with the person at NextChapter.',
  alternates: { canonical: '/insights/outplacement-account-after-contract' },
  openGraph: {
    title: 'What happens to your outplacement account when the contract ends',
    description: 'What to ask before you sign, and what stays with the participant when a seat ends.',
    url: 'https://launchyournextchapter.com/insights/outplacement-account-after-contract',
    type: 'article',
  },
}

const ARTICLE = insight('outplacement-account-after-contract')

// Describes only what NextChapter does, as in src/lib/employer/seat-continuity.ts (docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md,
// row VS-2). Makes no claim about how other providers handle access.
export default function OutplacementAccountAfterContractArticlePage() {
  const jsonLd = articleJsonLd({
    headline: ARTICLE.title,
    path: '/insights/outplacement-account-after-contract',
    description: ARTICLE.description,
    dateModified: ARTICLE.lastUpdated,
  })
  const breadcrumbs = breadcrumbJsonLd([
    { name: 'Insights', path: '/insights' },
    { name: ARTICLE.title, path: '/insights/outplacement-account-after-contract' },
  ])

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <StructuredData data={breadcrumbs} />
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
        <AuthorByline updated={ARTICLE.lastUpdated} />

        <div className="mt-8 space-y-4 text-base leading-relaxed text-foreground">
          <p className="font-medium">
            What a participant keeps when the employer&apos;s contract term ends depends on the provider and the contract. Ask what stays with the person, and for how long, before you sign.
          </p>
          <p>
            An outplacement seat is bought for a term tied to the employer&apos;s contract. It is worth knowing
            before you sign what happens to the participant&apos;s account, data and access once that term
            ends: the resume drafts, the coaching notes, the login itself. The employer has paid for the
            benefit, and the person who used it should know what they keep.
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
            When an employer-sponsored seat ends, the person keeps their account, free, for as long as they
            want it, along with their profile, résumé, documents, search plan, contacts and notes. What the
            employer paid for stops: the coaching sessions and the recruiter network, if the program included
            it. Your search carries on as it is, and membership can pick up coaching or the recruiter network
            if you want them. The employer&apos;s program reporting, described on{' '}
            <Link href="/outplacement" className="text-primary underline underline-offset-4">
              the employers page
            </Link>
            , shows aggregate outcomes and does not name individuals.
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
