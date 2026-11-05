import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NewsFeed } from '@/components/news/NewsFeed'
import type { NewsItemView } from '@/lib/news/published'

vi.mock('server-only', () => ({}))

const item = (over: Partial<NewsItemView> = {}): NewsItemView => ({
  id: 'n1', kind: 'article', url: 'https://example.com/story', title: 'A story about severance terms', blurb: 'What it says.',
  imageUrl: null, source: 'Example', tags: ['worker_rights', 'tips'], take: null, slug: null,
  dateLabel: 'Nov 4, 2026', publishedAt: '2026-11-04T00:00:00.000Z', liveAt: '2026-11-04T00:00:00.000Z', ...over,
})

describe('news cards and journey tags', () => {
  it('links a journey tag to its page and leaves other tags as text', () => {
    const html = renderToStaticMarkup(<NewsFeed items={[item()]} placement="news" />)
    expect(html).toContain('href="/journeys/your-rights-at-work"')
    expect(html).toContain('Your rights at work')
    expect(html).not.toMatch(/href="[^"]*"[^>]*>Tips and tricks/)
  })
  it('never nests a link inside a link', () => {
    const html = renderToStaticMarkup(<NewsFeed items={[item(), item({ id: 'n2', title: null, blurb: 'A post.', kind: 'linkedin' })]} placement="news" />)
    expect(html).not.toMatch(/<a\b(?:(?!<\/a>)[\s\S])*<a\b/)
  })
  it('keeps the whole card clickable through the headline link', () => {
    const html = renderToStaticMarkup(<NewsFeed items={[item()]} placement="news" />)
    expect(html).toMatch(/<a href="https:\/\/example\.com\/story"[^>]*after:absolute[^>]*>A story about severance terms<\/a>/)
  })
  it('uses the call to action as the link when a post has no headline', () => {
    const html = renderToStaticMarkup(<NewsFeed items={[item({ title: null, kind: 'linkedin', blurb: 'A post.' })]} placement="news" />)
    expect(html).toMatch(/<a href="https:\/\/example\.com\/story"[^>]*after:absolute[^>]*>Open on LinkedIn →<\/a>/)
  })
  it('does not link a tag to the journey page it is already on', () => {
    const html = renderToStaticMarkup(<NewsFeed items={[item()]} placement="journey-your-rights-at-work" />)
    expect(html).not.toContain('href="/journeys/your-rights-at-work"')
    expect(html).toContain('Your rights at work')
  })
})
