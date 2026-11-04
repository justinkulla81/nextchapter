import { ogPoster, POSTER_SIZE } from '@/lib/seo/og-poster'
import { editionLabel } from '@/lib/rankings/build-edition'
import { readRanking, readRankingIndex } from '@/lib/rankings/store'

export const alt = 'NextChapter job market ranking'
export const size = POSTER_SIZE
export const contentType = 'image/png'
export const revalidate = 86400

/** The share card for a ranking: the top five as bars, or the leader as a giant "#1", in a palette and layout picked from the list. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const entry = (await readRankingIndex().catch(() => [])).find((x) => x.slug === slug)
  const e = entry ? await readRanking(slug, entry.edition).catch(() => null) : null
  if (!e || !e.rows.length) return ogPoster({ seed: slug, kicker: 'Rankings', big: '#1', unit: 'in job market rankings', title: 'NextChapter job market rankings' })
  const top = e.rows[0]
  const max = Math.max(...e.rows.slice(0, 5).map((r) => Math.abs(r.value)), 1)
  return ogPoster({
    seed: slug,
    kicker: `Ranking · ${editionLabel(e.edition)}`,
    big: '#1',
    unit: `${top.name}${top.sub ? `, ${top.sub}` : ''}`,
    title: e.title,
    detail: `${top.valueLabel} · ${e.rows.length.toLocaleString('en-US')} ${e.placeNoun} ranked`,
    bars: e.rows.slice(0, 5).map((r) => ({ label: r.name.length > 16 ? `${r.name.slice(0, 15)}…` : r.name, valueLabel: r.valueLabel, frac: r.bar ?? Math.abs(r.value) / max })),
  })
}
