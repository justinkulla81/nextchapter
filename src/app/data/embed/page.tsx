import type { Metadata } from 'next'
import occupations from '@/lib/ai-check/occupations.json'
import { checkSlug } from '@/lib/ai-check/slug'
import { PublicSiteFooter, PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { EmbedBuilder } from '@/components/data/EmbedBuilder'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { INDUSTRIES } from '@/lib/seo/topics'

export const metadata: Metadata = pageMetadata('/data/embed')

export default function EmbedPage() {
  const states = ALL_STATE_CODES.map((c) => ({ slug: stateSlug(c), label: stateName(c) }))
  const industries = INDUSTRIES.filter((i) => i.rule).map((i) => ({ slug: i.slug, label: i.name }))
  const jobs = [...occupations].sort((a, b) => a.title.localeCompare(b.title)).map((o) => ({ slug: checkSlug(o.title, o.soc), label: o.title }))
  return (
    <div className="flex flex-1 flex-col">
      <PublicSiteHeader />
      <main className="flex-1 bg-off-white py-12">
        <div className="mx-auto max-w-5xl px-6">
          <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">{pageH1('/data/embed', 'Embeddable widgets')}</h1>
          <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
            Show live layoff notices, a layoffs-by-month chart, open jobs, unemployment benefits or the AI exposure of any job on your own site, with one snippet. The data stays current on its own. Free to use; keep the link under the frame.
          </p>
          <div className="mt-8">
            <EmbedBuilder states={states} industries={industries} jobs={jobs} />
          </div>
          <p className="mt-8 max-w-3xl text-sm text-muted-foreground">
            Sources: layoff notices are WARN filings with state labor departments; jobs are verified open on the employer’s own career site within the last week; benefits come from each state agency’s published rules, checked against the agency’s own pages.
          </p>
        </div>
      </main>
      <PublicSiteFooter page="seo" />
    </div>
  )
}
