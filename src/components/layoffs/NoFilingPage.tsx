import Link from 'next/link'
import { PublicSiteHeader, PublicSiteFooter } from '@/components/marketing/PublicSiteChrome'
import { LayoffAlertForm } from '@/components/layoffs/LayoffAlertForm'
import { StructuredData } from '@/components/StructuredData'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'

const LINK = 'text-brand underline underline-offset-4'

/**
 * An employer we know that has no state layoff filing and no press-reported layoff on record: the plain answer to "is X laying
 * off?", with the one thing worth doing (an email if that changes). The page is noindex, so thousands of these never read as thin
 * content to a search engine, but it is a real page for a person or an assistant that asks.
 */
export function NoFilingPage({ name, slug, asOf, employerPageHref }: { name: string; slug: string; asOf: string; employerPageHref: string | null }) {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={breadcrumbJsonLd([{ name: 'Layoff tracker', path: '/layoffs' }, { name: name, path: `/layoffs/company/${slug}` }])} />
      <PublicSiteHeader current="news" />
      <main className="flex-1 bg-off-white py-8" data-look="scene" data-calm>
        <div className="mx-auto max-w-3xl px-6">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <Link href="/layoffs" className="hover:text-foreground">Layoff tracker</Link>
            <span aria-hidden> › </span>
            <span className="text-foreground">{name}</span>
            <span className="ml-3">As of {asOf}</span>
          </nav>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-navy [text-wrap:balance] sm:text-4xl">Is {name} laying off employees?</h1>
          <p className="mt-4 text-lg text-navy">
            NextChapter has no layoff filing and no press-reported layoff for {name} on record, as of {asOf}.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            We read the layoff notices states publish and the layoffs the press reports. A layoff that has not been published or reported is not here.
            Independent page. Not from or affiliated with {name}.
          </p>
          <div className="mt-8 rounded-xl border border-border bg-white p-5">
            <h2 className="text-base font-semibold text-navy">Get an email if {name} files a layoff notice</h2>
            <div className="mt-3">
              <LayoffAlertForm employer={slug} employerName={name} source="layoffs:company:none" inline />
            </div>
          </div>
          <ul className="mt-8 list-disc space-y-1.5 pl-5 text-sm">
            {employerPageHref && <li><Link href={employerPageHref} className={LINK}>{name}: open jobs and what it pays</Link></li>}
            <li><Link href="/layoffs/this-week" className={LINK}>Layoffs reported this week</Link></li>
            <li><Link href="/layoffs" className={LINK}>The layoff tracker</Link></li>
            <li><Link href="/start/laid-off" className={LINK}>Start here: a plan for the weeks after a layoff</Link></li>
          </ul>
        </div>
      </main>
      <PublicSiteFooter page="layoffs" cta={false} />
    </div>
  )
}
