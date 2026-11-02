import { ogCard, OG_SIZE } from '@/lib/seo/og-card'
import { editionLabel } from '@/lib/rankings/build-edition'
import { readRanking, readRankingIndex } from '@/lib/rankings/store'

export const alt = 'NextChapter job market ranking'
export const size = OG_SIZE
export const contentType = 'image/png'
export const revalidate = 86400

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const entry = (await readRankingIndex().catch(() => [])).find((x) => x.slug === slug)
  const e = entry ? await readRanking(slug, entry.edition).catch(() => null) : null
  return ogCard({
    eyebrow: `NextChapter · Rankings${e ? ` · ${editionLabel(e.edition)}` : ''}`,
    headline: e?.title ?? 'Job market rankings',
    big: e ? `#1 ${e.rows[0].name}, ${e.rows[0].sub}: ${e.rows[0].valueLabel}` : undefined,
    sub: e ? e.rows.slice(1, 5).map((r) => `${r.rank}. ${r.name}`).join('   ') : undefined,
    footer: 'launchyournextchapter.com/rankings',
  })
}
