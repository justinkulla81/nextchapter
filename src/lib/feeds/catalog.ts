import { SITE_URL } from '@/lib/seo/facts'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { INDUSTRIES } from '@/lib/seo/topics'
import { LARGE_NOTICE_WORKERS } from '@/lib/feeds/layoff-feed'

export interface FeedEntry { key: string; title: string; blurb: string; path: string; page: string }
export interface FeedGroup { id: string; title: string; blurb: string; feeds: FeedEntry[] }

/** Every public feed, in one place: the /feeds page, the OPML file, llms.txt and the WebSub pings read this list. */
export function feedGroups(): FeedGroup[] {
  return [
    {
      id: 'start', title: 'Start here', blurb: 'The three feeds most people keep.',
      feeds: [
        { key: 'weekly', title: 'Weekly layoff summary', blurb: 'One item a week: notices filed, workers named, the largest.', path: '/feeds/layoffs-weekly.xml', page: '/layoffs/week' },
        { key: '100plus', title: `Large layoffs (${LARGE_NOTICE_WORKERS}+ workers)`, blurb: 'Only notices naming 100 or more workers, any state. A few a week.', path: '/feeds/layoffs-100plus.xml', page: '/layoffs' },
        { key: 'all', title: 'All layoff notices', blurb: 'Every new WARN notice we collect, all states.', path: '/feeds/layoffs', page: '/layoffs' },
      ],
    },
    {
      id: 'states', title: 'Layoff notices by state', blurb: 'New WARN notices from one state labor department.',
      feeds: ALL_STATE_CODES.map((c) => ({ key: `state-${stateSlug(c)}`, title: `${stateName(c)} layoff notices`, blurb: '', path: `/feeds/layoffs/${stateSlug(c)}`, page: `/layoffs/${stateSlug(c)}` })),
    },
    {
      id: 'industries', title: 'Layoff notices by industry', blurb: 'New WARN notices from employers in one industry, any state.',
      feeds: INDUSTRIES.map((i) => ({ key: `industry-${i.slug}`, title: `${i.name} layoff notices`, blurb: '', path: `/feeds/industries/${i.slug}`, page: `/industries/${i.slug}` })),
    },
    {
      id: 'other', title: 'Conferences', blurb: 'Conferences and trade shows with dates, costs and calls for speakers.',
      feeds: [{ key: 'conferences', title: 'Conferences and trade shows', blurb: 'Upcoming events, newest updates first.', path: '/feeds/conferences', page: '/conferences' }],
    },
  ]
}

export const allFeeds = (): FeedEntry[] => feedGroups().flatMap((g) => g.feeds)
export const feedUrl = (f: FeedEntry) => `${SITE_URL}${f.path}`

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** OPML 2.0: import it into a feed reader to subscribe to everything, or keep only the folders you want. */
export function opml(): string {
  const body = feedGroups().map((g) => `      <outline text="${esc(g.title)}" title="${esc(g.title)}">
${g.feeds.map((f) => `        <outline type="rss" text="${esc(f.title)}" title="${esc(f.title)}" xmlUrl="${esc(feedUrl(f))}" htmlUrl="${esc(SITE_URL + f.page)}"/>`).join('\n')}
      </outline>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>NextChapter feeds</title>
    <dateModified>${new Date().toUTCString()}</dateModified>
    <ownerName>NextChapter</ownerName>
    <docs>https://opml.org/spec2.opml</docs>
  </head>
  <body>
${body}
  </body>
</opml>
`
}
