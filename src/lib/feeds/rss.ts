import { SITE_URL } from '@/lib/seo/facts'

export interface FeedItem { title: string; link: string; guid: string; date: Date; description: string }

export const xmlEscape = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

export function rssXml(opts: { title: string; description: string; path: string; selfPath: string; items: FeedItem[] }): string {
  const items = opts.items.map((i) => `    <item>
      <title>${xmlEscape(i.title)}</title>
      <link>${xmlEscape(i.link)}</link>
      <guid isPermaLink="false">${xmlEscape(i.guid)}</guid>
      <pubDate>${i.date.toUTCString()}</pubDate>
      <description>${xmlEscape(i.description)}</description>
    </item>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(opts.title)}</title>
    <link>${SITE_URL}${opts.path}</link>
    <description>${xmlEscape(opts.description)}</description>
    <language>en-us</language>
    <atom:link href="${SITE_URL}${opts.selfPath}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`
}

export function rssResponse(xml: string): Response {
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=86400' } })
}
