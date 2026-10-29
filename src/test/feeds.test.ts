import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/warn/layoff-pages', () => ({ TWELVE_MONTHS_MS: 365 * 86_400_000, getPublicNotices: async () => [], noticeDay: (d: Date) => d.toISOString().slice(0, 10) }))
const announcedAt = new Date(Date.now() - 2 * 86_400_000)
vi.mock('@/lib/warn/company-announcements', () => ({
  getAnnouncements: async () => new Map([['tiktok', { slug: 'tiktok', name: 'TikTok', latest: announcedAt, items: [{ id: 'a1', date: announcedAt, kind: 'layoff', summary: 'Reported layoffs across trust and safety', workers: null, sourceUrl: 'https://news.example/tiktok', rssPublishedAt: announcedAt }, { id: 'a2', date: announcedAt, kind: 'layoff', summary: 'Not published yet', workers: null, sourceUrl: null, rssPublishedAt: null }] }]]),
  hasRecentAnnouncement: () => true,
}))
vi.mock('@/lib/seo/topic-data', () => ({ getRecentNotices: async () => [] }))
vi.mock('@/lib/layoffs/weekly', () => ({ getWeeks: async () => [], getWeekNotices: async () => null }))

import { allFeeds, opml } from '@/lib/feeds/catalog'
import { allLayoffFeed, feedLink, layoffFeed, noticeContext } from '@/lib/feeds/layoff-feed'
import { jsonFeed, rssXml } from '@/lib/feeds/rss'
import { changedFeeds } from '@/lib/syndication/indexnow-layoffs'

const day = 86_400_000
const notice = (id: string, o: Record<string, unknown> = {}) => ({
  id, state: 'TX', employer: 'Acme', slug: 'acme', place: null, workers: 50, noticeDate: new Date(Date.now() - 5 * day), noticeDateKnown: true,
  fetchedAt: new Date(), effectiveDate: null, type: null, sourceUrl: null, board: null, ...o,
}) as never

describe('feeds', () => {
  it('lists a feed for every state, every industry, and the three headline feeds', () => {
    const feeds = allFeeds()
    expect(feeds.filter((f) => f.key.startsWith('state-')).length).toBeGreaterThanOrEqual(51)
    expect(feeds.filter((f) => f.key.startsWith('industry-')).length).toBeGreaterThan(20)
    expect(feeds.some((f) => f.path === '/feeds/layoffs-100plus.xml')).toBe(true)
    expect(new Set(feeds.map((f) => f.key)).size).toBe(feeds.length)
  })

  it('writes OPML with one xmlUrl per feed and escaped text', () => {
    const x = opml()
    expect(x.match(/xmlUrl=/g)?.length).toBe(allFeeds().length)
    expect(x).toContain('<opml version="2.0">')
    expect(x).not.toMatch(/&(?!amp;|lt;|gt;|quot;)/)
  })

  it('tags item links with the feed they came from', () => {
    expect(feedLink('/layoffs/company/acme', 'layoffs-all')).toBe('https://launchyournextchapter.com/layoffs/company/acme?utm_source=rss&utm_medium=feed&utm_campaign=layoffs-all')
  })

  it('states the context a notice has from our own counts only', () => {
    const all = [notice('1', { workers: 300 }), ...Array.from({ length: 12 }, (_, i) => notice(`o${i}`, { slug: `x${i}`, workers: 10 + i }))]
    const big = noticeContext(all[0], all)
    expect(big.facts.join(' ')).toContain('largest Texas notice')
    const again = [notice('a', { noticeDate: new Date(Date.now() - 20 * day) }), notice('b')]
    expect(noticeContext(again[1], again).facts.join(' ')).toContain('second of 2 notices from this employer')
    expect(noticeContext(notice('z', { workers: null }), [notice('z', { workers: null })]).facts).toEqual([])
  })

  it('writes RSS with a hub, categories and an image, and a JSON Feed of the same items', () => {
    const doc = {
      title: 'T & Co', description: 'd', path: '/layoffs', selfPath: '/feeds/layoffs', hub: true,
      items: [{ title: 'A <b>', link: 'https://x.test/a', guid: 'g1', date: new Date(0), description: 'plain', html: '<p>hi ]]> there</p>', categories: ['Texas'], image: 'https://x.test/i.png' }],
    }
    const xml = rssXml(doc)
    expect(xml).toContain('rel="hub"')
    expect(xml).toContain('<category>Texas</category>')
    expect(xml).toContain('media:content')
    expect(xml).toContain('T &amp; Co')
    expect(xml.match(/<!\[CDATA\[/g)!.length).toBeGreaterThan(1)
    const j = JSON.parse(jsonFeed(doc))
    expect(j.version).toContain('jsonfeed.org')
    expect(j.items[0]).toMatchObject({ id: 'g1', tags: ['Texas'] })
    expect(j.hubs[0].type).toBe('WebSub')
  })

  it('pings the all-states feeds always and a state feed only for a state page', () => {
    const feeds = changedFeeds(['/layoffs', '/layoffs/texas', '/layoffs/company/acme', '/layoffs/week'])
    expect(feeds).toContain('https://launchyournextchapter.com/feeds/layoffs/texas')
    expect(feeds).toContain('https://launchyournextchapter.com/feeds/layoffs-weekly.xml')
    expect(feeds.some((f) => f.includes('company') || f.endsWith('/week'))).toBe(false)
  })

  it('puts a new announcement-only employer page in the all-states feed, but not in a filtered feed', async () => {
    const all = await allLayoffFeed()
    const item = all.items.find((i) => i.guid === 'nextchapter-announcement-a1')
    expect(item?.title).toBe('TikTok: Reported layoffs across trust and safety')
    expect(item?.link).toContain('/layoffs/company/tiktok')
    expect(item?.description).toContain('not a WARN filing')
    // Only what an admin published: the unpublished announcement stays out of the feed.
    expect(all.items.some((i) => i.guid === 'nextchapter-announcement-a2')).toBe(false)
    const large = await layoffFeed({ minWorkers: 100, title: 't', description: 'd', selfPath: '/feeds/x', pagePath: '/layoffs', campaign: 'x' })
    expect(large.items).toHaveLength(0)
  })
})
