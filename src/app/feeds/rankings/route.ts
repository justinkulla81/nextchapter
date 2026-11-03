import { archiveMonths } from '@/lib/rankings/awards'
import { editionLabel } from '@/lib/rankings/build-edition'
import { readRankingIndex } from '@/lib/rankings/store'
import { feedResponse, type FeedItem } from '@/lib/feeds/rss'
import { SITE_URL } from '@/lib/seo/facts'

export const revalidate = 21600

const MONTHS_SHOWN = 6

// New job market rankings: one item per month ("November 2026: 349 rankings") and one for each national list's newest edition.
// The regional and state lists are reached from the month's page. Add ?format=json for JSON Feed.
export async function GET(req: Request) {
  const index = await readRankingIndex().catch(() => [])
  const months = archiveMonths(index).slice(0, MONTHS_SHOWN)
  const at = (edition: string) => new Date(`${edition}-01T12:00:00Z`)
  const items: FeedItem[] = [
    ...months.map((ed) => ({
      title: `Job market rankings, ${editionLabel(ed)}`,
      link: `${SITE_URL}/rankings/archive/${ed}`,
      guid: `nextchapter-rankings-month-${ed}`,
      date: at(ed),
      description: `All ${index.filter((x) => x.editions.includes(ed)).length} rankings for ${editionLabel(ed)}: cities, counties, job families, industries, AI skills and colleges, each with its data and method.`,
    })),
    ...index.filter((x) => x.scopeKind === 'national').map((x) => ({
      title: `${x.title}, ${editionLabel(x.edition)}`,
      link: `${SITE_URL}/rankings/${x.slug}`,
      guid: `nextchapter-ranking-${x.slug}-${x.edition}`,
      date: at(x.edition),
      description: `#1 ${x.topName}: ${x.topValueLabel}. ${x.places} ranked in the ${editionLabel(x.edition)} edition.`,
      categories: [x.family],
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime() || a.title.localeCompare(b.title))
  return feedResponse(req, {
    title: 'Job market rankings from NextChapter',
    description: 'Monthly rankings of the best cities, counties, job families, industries and AI skills for professional jobs: the national lists and a roundup for each month.',
    path: '/rankings', selfPath: '/feeds/rankings', items, hub: false,
  })
}
