import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup'
import { editionLabel } from '@/lib/rankings/build-edition'
import { readRankingIndex } from '@/lib/rankings/store'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 3600

export const metadata: Metadata = {
  title: titleMeta('Job market rankings: best cities by job type, pay and growth'),
  description: 'Monthly rankings of the best cities and counties for junior jobs, AI skills, remote work, software jobs, pay after cost of living and job growth, with the data and method behind each.',
  ...canonical('/rankings'),
}

const FAMILY_ORDER = ['Entry-level', 'Levels', 'AI', 'AI skills', 'Pay', 'Work style', 'Job families', 'Markets', 'Growth']

export default async function RankingsHub() {
  const index = await readRankingIndex()
  const newest = index.map((x) => x.edition).sort().reverse()[0]
  const LIST_FAMILIES = ['Job families', 'AI skills']
  const national = index.filter((x) => x.scopeKind === 'national' && !LIST_FAMILIES.includes(x.family))
  const families = FAMILY_ORDER.filter((f) => index.some((x) => x.family === f))
  return (
    <SeoPage
      trail={[{ name: 'Rankings', path: '/rankings' }]}
      h1="Job market rankings"
      lede={<>Which cities and counties lead for junior jobs, AI skills, remote work, pay after the cost of living and job growth. Rebuilt every month{newest ? ` (latest: ${editionLabel(newest)})` : ''} from open jobs we verify on employer career sites and from public Bureau of Labor Statistics and Census data. Every ranking shows its data, its method and its sources.</>}
      jsonLd={[{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Job market rankings', url: `${SITE_URL}/rankings`, mainEntity: { '@type': 'ItemList', itemListElement: national.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.title, url: `${SITE_URL}/rankings/${x.slug}` })) } }]}
    >
      {national.length > 0 && (
        <section aria-labelledby="national" className="mt-10">
          <h2 id="national" className={H2}>The national rankings</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {national.map((x) => (
              <li key={x.slug} className="rounded-xl border border-border bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{x.family}</p>
                <h3 className="mt-1 text-base font-semibold text-navy"><Link href={`/rankings/${x.slug}`} className="hover:underline">{x.title}</Link></h3>
                <p className="mt-2 text-sm text-foreground">#1 {x.topName}: {x.topValueLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">{x.places} ranked · {editionLabel(x.edition)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {families.map((f) => {
        const regional = index.filter((x) => x.family === f && (LIST_FAMILIES.includes(f) || x.scopeKind !== 'national'))
        if (!regional.length) return null
        return (
          <section key={f} aria-labelledby={`f-${f}`} className="mt-12">
            <h2 id={`f-${f}`} className={H2}>{f === 'Job families' || f === 'AI skills' ? f : `${f}: by region and state`}</h2>
            <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {regional.map((x) => <li key={x.slug}><Link href={`/rankings/${x.slug}`} className={LINK}>{x.title}</Link></li>)}
            </ul>
          </section>
        )
      })}
      <section aria-labelledby="how" className="mt-12">
        <h2 id="how" className={H2}>How the rankings are made</h2>
        <div className="mt-3 max-w-3xl space-y-3 text-sm text-foreground">
          <p>Each ranking has a sample bar: a place is ranked only if enough openings sit behind its figure. Each page gives the formula, the sources and the data date, and older months stay online at their own addresses.</p>
          <p>Our job data covers professional roles on the career sites of employers we track, so the rankings describe that market. They rank conditions we can measure, such as how many openings are entry-level or ask for AI skills, not how pleasant a place is to live or work.</p>
        </div>
      </section>
      <div className="mt-12"><NewsletterSignup source="rankings" /></div>
    </SeoPage>
  )
}
