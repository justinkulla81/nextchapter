import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { RankingView } from '@/components/rankings/RankingView'
import { editionLabel } from '@/lib/rankings/build-edition'
import { readRanking, readRankingIndex } from '@/lib/rankings/store'
import { canonical } from '@/lib/seo/canonical'
import { fitDescription } from '@/lib/seo/templates'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 21600 // 6 hours: was hourly; every regeneration is a billed ISR write
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

async function load(slug: string) {
  const index = await readRankingIndex()
  const entry = index.find((x) => x.slug === slug)
  const e = entry ? await readRanking(slug, entry.edition) : null
  return e ? { e, index } : null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const d = await load(slug)
  if (!d) return { robots: { index: false, follow: true } }
  return { title: titleMeta(`${d.e.title}, ${editionLabel(d.e.edition)}`), description: fitDescription(d.e.lead, 165), ...canonical(`/rankings/${slug}`) }
}

export default async function RankingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = await load(slug)
  // A list that has no edition yet (or an old address) goes to the rankings index, not a 404.
  if (!d) redirect('/rankings')
  return <RankingView e={d.e} index={d.index} latest />
}
