import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'
import { PullTop } from '@/components/capture/PullCta'
import { NicheProviderLink } from '@/components/niches/NicheProviderLink'
import { NICHES, nicheBySlug } from '@/lib/niches/niches'
import { getNicheProviders } from '@/lib/niches/providers'
import { CAPABILITIES } from '@/lib/vision/capabilities'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

// The company list is read from the database on each request and kept by the CDN (next.config.ts), so the page does
// not need the database at build.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ niche: string }> }): Promise<Metadata> {
  const { niche } = await params
  return nicheBySlug(niche) ? pageMetadata(`/niches/${niche}`) : {}
}

export default async function NichePage({ params }: { params: Promise<{ niche: string }> }) {
  const { niche: slug } = await params
  const niche = nicheBySlug(slug)
  if (!niche) notFound()
  const path = `/niches/${niche.slug}`
  const providers = await getNicheProviders(niche)
  const ours = CAPABILITIES.filter((c) => c.ours === 'BUILT' && niche.areas.includes(c.area)).slice(0, 6)
  const others = NICHES.filter((n) => n.slug !== niche.slug).slice(0, 6)

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={breadcrumbJsonLd([{ name: 'By type', path: '/niches' }, { name: niche.label, path }])} />
      {providers.length > 0 && (
        <StructuredData
          data={{
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: niche.h1,
            itemListElement: providers.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name, url: p.url })),
          }}
        />
      )}
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6">
          <Link href="/" className="shrink-0"><Logo className="text-2xl" /></Link>
          <nav className="flex items-center gap-1.5 text-sm">
            <Link href="/niches" className="font-medium text-brand hover:text-navy">By type</Link>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-medium text-foreground">{niche.label}</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">{pageH1(path, niche.h1)}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{niche.what}</p>
        <PullTop name={niche.label} path={path} audience={niche.audience === 'people' ? 'seeker' : 'org'} />

        <section className="mt-10">
          <h2 className="text-xl font-bold tracking-tight text-navy">Who it is for</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground">{niche.whoFor}</p>
        </section>

        <section className="mt-10 border-t border-border pt-8">
          <h2 className="text-xl font-bold tracking-tight text-navy">What to check before you choose</h2>
          <ul className="mt-4 space-y-2">
            {niche.howToChoose.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-foreground">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 border-t border-border pt-8">
          <h2 className="text-xl font-bold tracking-tight text-navy">Companies in this group</h2>
          {providers.length > 0 ? (
            <>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {providers.length} companies, with a link to each one&apos;s own site. A listing is not a recommendation, and we have not verified current details, so confirm everything with the company.
              </p>
              <ul className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {providers.map((p) => (
                  <li key={p.host} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                    <NicheProviderLink nicheSlug={niche.slug} provider={p.name} host={p.host} url={p.url} />
                    <span className="text-xs text-muted-foreground">{p.host}</span>
                    {p.compareSlug && (
                      <Link href={`/vs/${p.compareSlug}`} className="text-xs text-muted-foreground underline underline-offset-2">Compare with NextChapter</Link>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">The list for this group is being updated. Check back soon.</p>
          )}
        </section>

        {ours.length > 0 && (
          <section className="mt-10 border-t border-border pt-8">
            <h2 className="text-xl font-bold tracking-tight text-navy">What NextChapter does in this area</h2>
            <ul className="mt-4 space-y-3">
              {ours.map((c) => (
                <li key={c.key} className="text-sm text-foreground"><span className="font-medium">{c.name}.</span> {c.description}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10 border-t border-border pt-8">
          <h2 className="text-xl font-bold tracking-tight text-navy">Related</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {niche.related.map((r) => (
              <li key={r.href}><Link href={r.href} className="text-brand underline underline-offset-2">{r.label}</Link></li>
            ))}
            {others.map((n) => (
              <li key={n.slug}><Link href={`/niches/${n.slug}`} className="text-muted-foreground underline underline-offset-2">{n.label}</Link></li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
