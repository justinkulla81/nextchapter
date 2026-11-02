import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { RankingView } from '@/components/rankings/RankingView'
import { editionLabel } from '@/lib/rankings/build-edition'
import { isEdition, readRanking, readRankingIndex } from '@/lib/rankings/store'
import { canonical } from '@/lib/seo/canonical'
import { fitDescription } from '@/lib/seo/templates'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 86_400
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

// A dated edition. While it is the newest one, its address and the list's own address show the same page, so it names the
// list's address as canonical; once a newer edition exists it stands on its own and is offered to search engines.
async function load(slug: string, edition: string) {
  if (!isEdition(edition)) return null
  const [index, e] = await Promise.all([readRankingIndex(), readRanking(slug, edition)])
  const entry = index.find((x) => x.slug === slug)
  return e && entry ? { e, index, latest: entry.edition === edition } : null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; edition: string }> }): Promise<Metadata> {
  const { slug, edition } = await params
  const d = await load(slug, edition)
  if (!d) return { robots: { index: false, follow: true } }
  return {
    title: titleMeta(`${d.e.title}, ${editionLabel(edition)}`), description: fitDescription(d.e.lead, 165),
    ...canonical(d.latest ? `/rankings/${slug}` : `/rankings/${slug}/${edition}`),
  }
}

export default async function RankingEditionPage({ params }: { params: Promise<{ slug: string; edition: string }> }) {
  const { slug, edition } = await params
  const d = await load(slug, edition)
  if (!d) notFound()
  if (d.latest) permanentRedirect(`/rankings/${slug}`)
  return <RankingView e={d.e} index={d.index} latest={false} />
}
