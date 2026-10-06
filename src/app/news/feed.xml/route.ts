import { getPublishedNews } from '@/lib/news/published'
import { newsDisplayTitle } from '@/lib/news/slug'
import { reportsNewestFirst } from '@/lib/reports'

export const revalidate = 300

const SITE = 'https://launchyournextchapter.com'

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/**
 * The News list as an RSS feed, for readers and aggregators.
 *
 * An item with our take points at its page here and carries the take as its
 * text; one without points at the source and carries the source's summary.
 */
export async function GET() {
  // Report editions come from the typed registry (robust even if the DB News
  // row isn't present); drop any 'report' DB item so an edition is never
  // listed twice.
  const items = (await getPublishedNews(50)).filter((i) => i.kind !== 'report')
  const editions = reportsNewestFirst().map((e) => {
    const link = `${SITE}/reports/${e.slug}`
    return `    <item>
      <title>${esc(`NextChapter Displacement Report — ${e.month}`)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="false">nextchapter-report-${esc(e.slug)}</guid>
      <pubDate>${new Date(`${e.publishedAt}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${esc(e.dek)}</description>
      <source url="${esc(link)}">NextChapter Research</source>
    </item>`
  })
  const newsItems = items.map((i) => {
    const link = i.slug ? `${SITE}/news/${i.slug}` : i.url
    const text = i.take ?? i.blurb ?? ''
    return `    <item>
      <title>${esc(newsDisplayTitle(i))}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="false">nextchapter-news-${esc(i.id)}</guid>
      <pubDate>${new Date(i.publishedAt).toUTCString()}</pubDate>${text ? `
      <description>${esc(text)}</description>` : ''}${i.source ? `
      <source url="${esc(i.url)}">${esc(i.source)}</source>` : ''}
    </item>`
  })
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>NextChapter News</title>
    <link>${SITE}/news</link>
    <atom:link href="${SITE}/news/feed.xml" rel="self" type="application/rss+xml" />
    <description>Articles, videos, podcasts and posts on the job market and searching for a job, picked by NextChapter.</description>
    <language>en-us</language>
${[...editions, ...newsItems].join('\n')}
  </channel>
</rss>
`
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } })
}
