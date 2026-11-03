import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup'
import { MONTH_TINTS, toneOf } from '@/components/rankings/tones'
import { archiveMonths } from '@/lib/rankings/awards'
import { RANKINGS_HERO } from '@/lib/rankings/art'
import { editionLabel } from '@/lib/rankings/build-edition'
import { readRankingIndex } from '@/lib/rankings/store'
import { TOPIC_BLURB, topicSlug } from '@/lib/rankings/topics'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 21600 // 6 hours: was hourly; every regeneration is a billed ISR write

export const metadata: Metadata = {
  title: titleMeta('Job market rankings: best cities by job type, pay and growth'),
  description: 'Monthly rankings of the best cities and counties for junior jobs, AI skills, remote work, software jobs, pay after cost of living and job growth, with the data and method behind each.',
  alternates: { canonical: '/rankings', types: { 'application/rss+xml': [{ url: '/feeds/rankings', title: 'NextChapter job market rankings' }] } },
  openGraph: { title: 'Job market rankings: best cities by job type, pay and growth', description: 'Monthly rankings of cities and counties for junior jobs, AI skills, remote work, pay after cost of living and job growth.', url: `${SITE_URL}/rankings`, type: 'website' },
}

const FAMILY_ORDER = ['Entry-level', 'Levels', 'AI', 'AI skills', 'Pay', 'Work style', 'Job families', 'Industries', 'Industry markets', 'AI and jobs', 'Function profiles', 'Industry profiles', 'Support', 'Hiring and layoffs', 'Conferences', 'Work arrangements', 'Markets', 'Growth', 'Best overall', 'Workforce', 'Research', 'Higher education', 'Degrees']

export default async function RankingsHub() {
  const index = await readRankingIndex()
  const newest = index.map((x) => x.edition).sort().reverse()[0]
  const LIST_FAMILIES = ['Job families', 'AI skills', 'Industry markets', 'Function profiles', 'Industry profiles', 'Support', 'Hiring and layoffs', 'Conferences', 'Work arrangements', 'Workforce', 'Research', 'Higher education', 'Degrees']
  const national = index.filter((x) => x.scopeKind === 'national' && !LIST_FAMILIES.includes(x.family))
  const months = archiveMonths(index)
  const families = FAMILY_ORDER.filter((f) => index.some((x) => x.family === f))
  return (
    <SeoPage
      look="scene"
      calm
      hero={RANKINGS_HERO}
      capture={{ kind: 'ranking', slug: 'rankings', label: 'professional', save: { q: '', loc: '' } }}
      trail={[{ name: 'Rankings', path: '/rankings' }]}
      h1="Job market rankings"
      lede={<>Which cities and counties lead for junior jobs, AI skills, remote work, pay after the cost of living and job growth. Rebuilt every month{newest ? ` (latest: ${editionLabel(newest)})` : ''} from open jobs we verify on employer career sites and from public Bureau of Labor Statistics and Census data. Every ranking shows its data, its method and its sources.</>}
      jsonLd={[{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Job market rankings', url: `${SITE_URL}/rankings`, mainEntity: { '@type': 'ItemList', itemListElement: national.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.title, url: `${SITE_URL}/rankings/${x.slug}` })) } }]}
    >
      {national.length > 0 && (
        <section aria-labelledby="national">
          <h2 id="national" className={H2}>The national rankings</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {national.map((x) => (
              <li key={x.slug} className={`rounded-xl p-5 ${toneOf(x.family).card}`}>
                <p className={`text-xs font-medium uppercase tracking-wide ${toneOf(x.family).label}`}>{x.family}</p>
                <h3 className="mt-1 text-base font-semibold text-navy"><Link href={`/rankings/${x.slug}`} className="hover:underline">{x.title}</Link></h3>
                <p className="mt-2 text-sm text-foreground">#1 {x.topName}: {x.topValueLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">{x.places} ranked · {editionLabel(x.edition)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="topics">
        <h2 id="topics" className={H2}>Browse by topic</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Each topic lists its rankings by region and state, with the city in first place for each.</p>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {families.map((f) => {
            const n = index.filter((x) => x.family === f).length
            if (!n) return null
            const tone = toneOf(f)
            return (
              <li key={f}>
                <Link href={`/rankings/topic/${topicSlug(f)}`} className={`block h-full rounded-xl p-5 hover:shadow-sm ${tone.card}`}>
                  <span className={`text-xs font-medium uppercase tracking-wide ${tone.label}`}>{n} {n === 1 ? 'ranking' : 'rankings'}</span>
                  <span className="mt-1 block text-base font-semibold text-navy">{f}</span>
                  {TOPIC_BLURB[f] && <span className="mt-1 block text-sm text-foreground">{TOPIC_BLURB[f]}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
      {months.length > 0 && (
        <section aria-labelledby="archive">
          <h2 id="archive" className={H2}>Past months</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Every edition stays online. Open a month to see all of its rankings, or open a ranking to see how it has moved.</p>
          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            {months.slice(0, 12).map((ed, i) => <li key={ed}><Link href={`/rankings/archive/${ed}`} className={`inline-flex rounded-full px-3 py-1.5 font-medium text-navy hover:underline ${MONTH_TINTS[i % MONTH_TINTS.length]}`}>{editionLabel(ed)}</Link></li>)}
            <li><Link href="/rankings/archive" className={`${LINK} inline-flex px-2 py-1.5`}>The full archive</Link></li>
          </ul>
        </section>
      )}
      <section aria-labelledby="how">
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
