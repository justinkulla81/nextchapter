import { rssXml, type FeedItem } from '@/lib/feeds/rss'
import { SITE_URL } from '@/lib/seo/facts'
import { stateName } from '@/lib/seo/states'
import { TWELVE_MONTHS_MS, getPublicNotices, noticeDay } from '@/lib/warn/layoff-pages'

/** New layoff notices as feed items, newest collected first. `state` limits to one state. */
export async function layoffFeed(state: string | null, selfPath: string, pagePath: string): Promise<string> {
  const cutoff = Date.now() - TWELVE_MONTHS_MS
  const rows = (await getPublicNotices())
    .filter((n) => n.noticeDate.getTime() >= cutoff && (!state || n.state === state))
    .sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime())
    .slice(0, 100)
  const items: FeedItem[] = rows.map((n) => ({
    title: `${n.employer}: ${n.workers ? `${n.workers.toLocaleString('en-US')} workers, ` : ''}${stateName(n.state)}`,
    link: `${SITE_URL}/layoffs/company/${n.slug}`,
    guid: `nextchapter-warn-${n.id}`,
    date: n.fetchedAt,
    description: `WARN notice filed ${noticeDay(n.noticeDate)}${n.place ? ` for ${n.place}` : ''}${n.workers ? `, naming ${n.workers.toLocaleString('en-US')} workers` : ''}${n.type ? ` (${n.type})` : ''}.${n.sourceUrl ? ` State record: ${n.sourceUrl}` : ''}`,
  }))
  return rssXml({
    title: state ? `${stateName(state)} layoff notices (WARN)` : 'Layoff notices (WARN) from NextChapter',
    description: `New WARN Act layoff notices${state ? ` in ${stateName(state)}` : ''}, collected from state labor departments.`,
    path: pagePath,
    selfPath,
    items,
  })
}
