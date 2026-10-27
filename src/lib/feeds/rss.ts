import { SITE_URL } from '@/lib/seo/facts'

export interface FeedItem {
  title: string
  link: string
  guid: string
  date: Date
  /** Plain-text summary. */
  description: string
  /** Optional HTML body (content:encoded / JSON Feed content_html). */
  html?: string
  categories?: string[]
  /** Absolute URL of a share image shown by readers that support it. */
  image?: string
}

export interface FeedDoc {
  title: string
  description: string
  /** Page the feed describes, e.g. `/layoffs`. */
  path: string
  /** The feed's own path, e.g. `/feeds/layoffs`. */
  selfPath: string
  items: FeedItem[]
  /** Channel logo; defaults to the site logo. */
  icon?: string
  /** WebSub hub; readers that support it get new items pushed. */
  hub?: boolean
}

export const WEBSUB_HUB = 'https://pubsubhubbub.appspot.com/'
export const FEED_LOGO = `${SITE_URL}/icon.png`
export const FEED_LICENSE = 'Data from state WARN records, compiled by NextChapter; licensed CC BY 4.0 with credit to NextChapter and a link to the item.'

export const xmlEscape = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/** CDATA cannot contain "]]>"; split it so an employer name cannot end the section early. */
const cdata = (v: string) => `<![CDATA[${v.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`

export function rssXml(opts: FeedDoc): string {
  const items = opts.items.map((i) => `    <item>
      <title>${xmlEscape(i.title)}</title>
      <link>${xmlEscape(i.link)}</link>
      <guid isPermaLink="false">${xmlEscape(i.guid)}</guid>
      <pubDate>${i.date.toUTCString()}</pubDate>
${(i.categories ?? []).map((c) => `      <category>${xmlEscape(c)}</category>\n`).join('')}      <description>${xmlEscape(i.description)}</description>
${i.html ? `      <content:encoded>${cdata(i.html)}</content:encoded>\n` : ''}${i.image ? `      <media:content url="${xmlEscape(i.image)}" medium="image" type="image/png" width="1200" height="630"/>\n` : ''}    </item>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${xmlEscape(opts.title)}</title>
    <link>${SITE_URL}${opts.path}</link>
    <description>${xmlEscape(opts.description)}</description>
    <language>en-us</language>
    <copyright>${xmlEscape(FEED_LICENSE)}</copyright>
    <ttl>15</ttl>
    <generator>NextChapter</generator>
    <image>
      <url>${xmlEscape(opts.icon ?? FEED_LOGO)}</url>
      <title>${xmlEscape(opts.title)}</title>
      <link>${SITE_URL}${opts.path}</link>
    </image>
    <atom:link href="${SITE_URL}${opts.selfPath}" rel="self" type="application/rss+xml"/>
${opts.hub ? `    <atom:link href="${WEBSUB_HUB}" rel="hub"/>\n` : ''}${items}
  </channel>
</rss>
`
}

/** JSON Feed 1.1 of the same document, for readers and bots that prefer JSON. */
export function jsonFeed(opts: FeedDoc): string {
  return JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: opts.title,
    description: opts.description,
    home_page_url: `${SITE_URL}${opts.path}`,
    feed_url: `${SITE_URL}${opts.selfPath}?format=json`,
    icon: opts.icon ?? FEED_LOGO,
    language: 'en-US',
    ...(opts.hub ? { hubs: [{ type: 'WebSub', url: WEBSUB_HUB }] } : {}),
    items: opts.items.map((i) => ({
      id: i.guid,
      url: i.link,
      title: i.title,
      summary: i.description,
      content_text: i.description,
      ...(i.html ? { content_html: i.html } : {}),
      date_published: i.date.toISOString(),
      ...(i.image ? { image: i.image } : {}),
      ...(i.categories?.length ? { tags: i.categories } : {}),
    })),
  }, null, 2)
}

// Short edge cache: a WebSub hub fetches the feed right after a ping, so a long cache would hand it the old list.
const CACHE = 'public, s-maxage=120, stale-while-revalidate=3600'

export function rssResponse(xml: string): Response {
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': CACHE } })
}

/** RSS by default, JSON Feed with `?format=json`. */
export function feedResponse(req: Request, doc: FeedDoc): Response {
  if (new URL(req.url).searchParams.get('format') === 'json') {
    return new Response(jsonFeed(doc), { headers: { 'Content-Type': 'application/feed+json; charset=utf-8', 'Cache-Control': CACHE } })
  }
  return rssResponse(rssXml(doc))
}
