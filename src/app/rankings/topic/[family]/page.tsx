import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { toneOf } from '@/components/rankings/tones'
import { RANKINGS_HERO } from '@/lib/rankings/art'
import { editionLabel } from '@/lib/rankings/build-edition'
import { readRankingIndex } from '@/lib/rankings/store'
import { TOPIC_BLURB, topicSlug } from '@/lib/rankings/topics'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { titleMeta } from '@/lib/seo/title'
import type { RankingIndexEntry } from '@/lib/rankings/types'

export const revalidate = 21600
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

async function load(slug: string) {
  const index = await readRankingIndex()
  const family = index.map((x) => x.family).find((f) => topicSlug(f) === slug)
  if (!family) return null
  return { family, rows: index.filter((x) => x.family === family) }
}

export async function generateMetadata({ params }: { params: Promise<{ family: string }> }): Promise<Metadata> {
  const { family: slug } = await params
  const d = await load(slug)
  if (!d) return { robots: { index: false, follow: true } }
  return { title: titleMeta(`${d.family} job market rankings`), description: `${d.rows.length} monthly rankings for ${d.family.toLowerCase()}, each with the city or county in first place, its figure, the data and the method.`, ...canonical(`/rankings/topic/${slug}`) }
}

const KIND_ORDER: RankingIndexEntry['scopeKind'][] = ['national', 'region', 'state']
const KIND_HEAD = { national: 'Nationwide', region: 'By region', state: 'By state' } as const

export default async function RankingTopic({ params }: { params: Promise<{ family: string }> }) {
  const { family: slug } = await params
  const d = await load(slug)
  if (!d) redirect('/rankings') // an unknown topic goes to the hub, like unknown slugs elsewhere
  const tone = toneOf(d.family)
  const groups = KIND_ORDER.map((k) => ({ k, rows: d.rows.filter((x) => x.scopeKind === k) })).filter((g) => g.rows.length)
  const newest = d.rows.map((x) => x.edition).sort().reverse()[0]
  return (
    <SeoPage
      look="scene"
      calm
      hero={RANKINGS_HERO}
      trail={[{ name: 'Rankings', path: '/rankings' }, { name: d.family, path: `/rankings/topic/${slug}` }]}
      h1={`${d.family}: job market rankings`}
      lede={<>{TOPIC_BLURB[d.family] ?? `Rankings in the ${d.family.toLowerCase()} group.`} {d.rows.length} rankings{newest ? `, latest ${editionLabel(newest)}` : ''}. Open one to see the full list, the data and the method.</>}
      jsonLd={[{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${d.family}: job market rankings`, url: `${SITE_URL}/rankings/topic/${slug}`, mainEntity: { '@type': 'ItemList', itemListElement: d.rows.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.title, url: `${SITE_URL}/rankings/${x.slug}` })) } }]}
    >
      {groups.map((g) => (
        <section key={g.k} aria-labelledby={`g-${g.k}`}>
          {groups.length > 1 && <h2 id={`g-${g.k}`} className={H2}>{KIND_HEAD[g.k]}</h2>}
          <div className={`${groups.length > 1 ? 'mt-4' : ''} overflow-hidden rounded-xl bg-white`}>
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{d.family} rankings{groups.length > 1 ? `, ${KIND_HEAD[g.k].toLowerCase()}` : ''}</caption>
              <thead className={`text-xs uppercase tracking-wide ${tone.label}`}>
                <tr><th scope="col" className="px-4 py-3 font-medium">Ranking</th><th scope="col" className="px-4 py-3 font-medium">First place</th><th scope="col" className="hidden px-4 py-3 text-right font-medium sm:table-cell">Ranked</th></tr>
              </thead>
              <tbody>
                {g.rows.map((x) => (
                  <tr key={x.slug} className="border-t border-border/60 align-top">
                    <th scope="row" className="px-4 py-3 font-medium text-navy"><Link href={`/rankings/${x.slug}`} className="hover:text-brand hover:underline">{x.title}</Link></th>
                    <td className="px-4 py-3 text-foreground">{x.topName}<span className="block text-xs text-muted-foreground">{x.topValueLabel}</span></td>
                    <td className="hidden px-4 py-3 text-right text-muted-foreground sm:table-cell">{x.places}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="mt-8 text-sm"><Link href="/rankings" className={LINK}>All ranking topics</Link></p>
    </SeoPage>
  )
}
