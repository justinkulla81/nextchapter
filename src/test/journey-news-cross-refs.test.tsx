import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import NewsletterWeeklyEmail from '@/emails/newsletter-weekly'
import { buildJourneyWeekBrief } from '@/lib/newsletter/journey-week'
import { rssCategories } from '@/lib/news/feed-categories'
import type { NewsItemView } from '@/lib/news/published'

vi.mock('server-only', () => ({}))

const NOW = Date.UTC(2026, 10, 9, 12)
const DAY = 86_400_000
const item = (id: string, title: string, tags: NewsItemView['tags'], daysAgo: number, over: Partial<NewsItemView> = {}): NewsItemView => ({
  id, kind: 'article', url: `https://src.test/${id}`, title, blurb: null, imageUrl: null, source: 'Outlet', tags, take: null, slug: null,
  dateLabel: 'x', publishedAt: new Date(NOW - daysAgo * DAY).toISOString(), liveAt: new Date(NOW - daysAgo * DAY).toISOString(), ...over,
})

describe('weekly email journey block', () => {
  const APP = 'https://site.test'
  it('groups the last seven days by journey, newest first, two at most', () => {
    const brief = buildJourneyWeekBrief([
      item('a', 'Old', ['worker_rights'], 9),
      item('b', 'Rights one', ['worker_rights'], 1),
      item('c', 'Rights two', ['worker_rights', 'benefits'], 2),
      item('d', 'Rights three', ['worker_rights'], 3),
      item('e', 'No journey', ['news'], 1),
    ], APP, NOW)
    expect(brief!.map((g) => g.slug)).toEqual(['your-rights-at-work', 'white-collar-benefits'])
    expect(brief![0].stories.map((s) => s.title)).toEqual(['Rights one', 'Rights two'])
    expect(brief![1].stories.map((s) => s.title)).toEqual(['Rights two'])
    expect(brief![0].url).toBe('https://site.test/journeys/your-rights-at-work?utm_source=newsletter&utm_medium=email&utm_campaign=newsletter_weekly')
  })
  it('is left out when nothing new was published for a journey', () => {
    expect(buildJourneyWeekBrief([item('a', 'Old', ['worker_rights'], 9), item('b', 'Plain', ['news'], 1)], APP, NOW)).toBeNull()
    expect(buildJourneyWeekBrief([], APP, NOW)).toBeNull()
  })
  it('sends a story with our own page to that page, and the rest to the source', () => {
    const brief = buildJourneyWeekBrief([item('a', 'Take', ['side_income'], 1, { slug: 'take-abc123', take: 'our words' }), item('b', 'Plain', ['side_income'], 2)], APP, NOW)
    expect(brief![0].stories[0].url).toContain('https://site.test/news/take-abc123?utm_source=newsletter')
    expect(brief![0].stories[1].url).toBe('https://src.test/b')
  })
  it('renders in the email only when there is a block', () => {
    const base = { introCopy: null, articleTitle: 'T', articleUrl: 'https://x.test/a', articleSummary: null, newsUrl: 'https://x.test/news', signupUrl: 'https://x.test/s', unsubscribeUrl: 'https://x.test/u' }
    const brief = buildJourneyWeekBrief([item('b', 'Rights one', ['worker_rights'], 1)], APP, NOW)
    const html = renderToStaticMarkup(NewsletterWeeklyEmail({ ...base, journeys: brief }))
    expect(html).toContain('At work this week')
    expect(html).toContain('Your rights at work and on the way out')
    expect(html).toContain('Rights one')
    expect(html).toContain('https://site.test/journeys/your-rights-at-work')
    expect(renderToStaticMarkup(NewsletterWeeklyEmail({ ...base, journeys: null }))).not.toContain('At work this week')
  })
})

describe('RSS journey categories', () => {
  it('puts the journey page in the domain of a journey tag and leaves other tags plain', () => {
    expect(rssCategories(['news', 'worker_rights', 'pay_and_costs'], 'https://site.test')).toEqual([
      '<category>News</category>',
      '<category domain="https://site.test/journeys/your-rights-at-work">Your rights at work</category>',
      '<category domain="https://site.test/journeys/pay-and-cost-of-living">Pay and cost of living</category>',
    ])
    expect(rssCategories([], 'https://site.test')).toEqual([])
  })
  it('carries them into the feed', async () => {
    vi.doMock('@/lib/news/published', () => ({ getPublishedNews: async () => [item('a', 'A & B', ['benefits', 'tips'], 1)] }))
    const { GET } = await import('@/app/news/feed.xml/route')
    const xml = await (await GET()).text()
    expect(xml).toContain('<title>A &amp; B</title>')
    expect(xml).toContain('<category domain="https://launchyournextchapter.com/journeys/white-collar-benefits">Benefits</category>')
    expect(xml).toContain('<category>Tips and tricks</category>')
    // Categories sit inside the item they belong to.
    expect(xml).toMatch(/<item>\s*<title>A &amp; B<\/title>[\s\S]*?<category domain[\s\S]*?<\/item>/)
  })
})
