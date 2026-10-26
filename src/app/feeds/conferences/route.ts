import { rssResponse, rssXml, type FeedItem } from '@/lib/feeds/rss'
import { SITE_URL } from '@/lib/seo/facts'
import { getCatalogIndex } from '@/lib/seo/topic-data'

export const revalidate = 3600

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

// Conferences added or updated most recently, with their dates and place.
export async function GET() {
  const rows = (await getCatalogIndex().catch(() => []))
    .filter((c) => c.datesConfirmed && c.startDate && new Date(c.startDate).getTime() >= Date.now() - 86_400_000)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 100)
  const items: FeedItem[] = rows.map((c) => ({
    title: c.name,
    link: `${SITE_URL}/conferences/${c.id}`,
    guid: `nextchapter-conference-${c.id}-${c.updatedAt.slice(0, 10)}`,
    date: new Date(c.updatedAt),
    description: `${c.name}${c.organizer ? ` by ${c.organizer}` : ''}, ${day(c.startDate!)}${[c.city, c.state].filter(Boolean).length ? ` in ${[c.city, c.state].filter(Boolean).join(', ')}` : ''}.`,
  }))
  return rssResponse(rssXml({ title: 'Conferences and trade shows from NextChapter', description: 'Upcoming conferences with dates, costs and speaking opportunities, newest updates first.', path: '/conferences', selfPath: '/feeds/conferences', items }))
}
