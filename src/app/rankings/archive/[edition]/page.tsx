import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { toneOf } from '@/components/rankings/tones'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { archiveMonths, editionHref } from '@/lib/rankings/awards'
import { editionLabel } from '@/lib/rankings/build-edition'
import { isEdition, readRanking, readRankingIndex } from '@/lib/rankings/store'
import { canonical } from '@/lib/seo/canonical'
import { SITE_URL } from '@/lib/seo/facts'
import { fitDescription } from '@/lib/seo/templates'
import { titleMeta } from '@/lib/seo/title'

// One month of the archive: every list published for that month, with its leader as it stood then. Reads one stored row per
// list (primary-key lookups), so it is built on first visit and kept a day.
export const revalidate = 86_400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

async function load(edition: string) {
  if (!isEdition(edition)) return null
  const index = await readRankingIndex().catch(() => [])
  if (!archiveMonths(index).includes(edition)) return null
  const lists = index.filter((x) => x.editions.includes(edition))
  const rows = await Promise.all(lists.map(async (x) => {
    const e = x.edition === edition ? null : await readRanking(x.slug, edition).catch(() => null)
    return { entry: x, topName: e?.rows[0]?.name ?? x.topName, topValueLabel: e?.rows[0]?.valueLabel ?? x.topValueLabel, places: e?.rows.length ?? x.places }
  }))
  return { index, newest: archiveMonths(index)[0], rows }
}

export async function generateMetadata({ params }: { params: Promise<{ edition: string }> }): Promise<Metadata> {
  const { edition } = await params
  const d = await load(edition)
  if (!d) return { robots: { index: false, follow: true } }
  return {
    title: titleMeta(`Job market rankings, ${editionLabel(edition)}`),
    description: fitDescription(`All ${d.rows.length} job market rankings for ${editionLabel(edition)}: the best cities and counties for junior jobs, AI skills, remote work, pay after cost of living and job growth, with each list's leader.`, 165),
    ...canonical(`/rankings/archive/${edition}`),
  }
}

export default async function RankingsMonth({ params }: { params: Promise<{ edition: string }> }) {
  const { edition } = await params
  const d = await load(edition)
  if (!d) notFound()
  const label = editionLabel(edition)
  const families = [...new Set(d.rows.map((r) => r.entry.family))]
  const months = archiveMonths(d.index)
  const at = months.indexOf(edition)
  const prev = months[at + 1]
  const next = at > 0 ? months[at - 1] : null
  return (
    <SeoPage
      look="scene"
      trail={[{ name: 'Rankings', path: '/rankings' }, { name: 'Archive', path: '/rankings/archive' }, { name: label, path: `/rankings/archive/${edition}` }]}
      h1={`Job market rankings, ${label}`}
      lede={<>All {d.rows.length} rankings for {label}, with the leader of each as it stood that month.</>}
      jsonLd={[{
        '@context': 'https://schema.org', '@type': 'CollectionPage', name: `Job market rankings, ${label}`, url: `${SITE_URL}/rankings/archive/${edition}`,
        mainEntity: { '@type': 'ItemList', itemListElement: d.rows.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.entry.title, url: `${SITE_URL}${editionHref(r.entry.slug, edition, r.entry.edition)}` })) },
      }]}
    >
      {families.map((f) => {
        const tone = toneOf(f)
        const list = d.rows.filter((r) => r.entry.family === f)
        return (
          <section key={f} aria-labelledby={`m-${f}`}>
            <h2 id={`m-${f}`} className={H2}>{f}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((r) => (
                <li key={r.entry.slug} className={`rounded-xl bg-white p-4`}>
                  <p className={`text-xs font-medium uppercase tracking-wide ${tone.label}`}>{r.entry.scopeName}</p>
                  <h3 className="mt-1 text-base font-semibold text-navy"><Link href={editionHref(r.entry.slug, edition, r.entry.edition)} className="hover:underline">{r.entry.title}</Link></h3>
                  <p className="mt-2 text-sm text-foreground">#1 {r.topName}: {r.topValueLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.places} ranked</p>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {prev && <Link href={`/rankings/archive/${prev}`} className={LINK}>← {editionLabel(prev)}</Link>}
        {next && <Link href={`/rankings/archive/${next}`} className={LINK}>{editionLabel(next)} →</Link>}
        <Link href="/rankings/archive" className={LINK}>All months</Link>
        <Link href="/rankings" className={LINK}>Current rankings</Link>
      </p>
    </SeoPage>
  )
}
