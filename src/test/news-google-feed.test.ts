import { describe, it, expect } from 'vitest'
import { parseGoogleFeed } from '@/lib/news/discover'
import { readLayoffHeadline } from '@/lib/warn/news-headline'

// discover.ts imports the database client; parseGoogleFeed is pure, and the
// import below only loads its module graph.

const XML = `<?xml version="1.0"?><rss><channel>
<item><title>Kroger to cut 3,000 corporate jobs over three years - Reuters</title>
<link>https://news.google.com/rss/articles/CBMiabc?oc=5</link><pubDate>Mon, 12 Oct 2026 15:00:00 GMT</pubDate>
<source url="https://www.reuters.com">Reuters</source></item>
<item><title>No link here</title><link></link></item>
</channel></rss>`

describe('parseGoogleFeed', () => {
  it('drops the publisher tail from the headline and keeps the publisher', () => {
    const [a, ...rest] = parseGoogleFeed(XML)
    expect(rest).toHaveLength(0)
    expect(a.title).toBe('Kroger to cut 3,000 corporate jobs over three years')
    expect(a.source).toBe('Reuters')
    expect(a.url).toMatch(/^https:\/\/news\.google\.com\//)
    expect(a.publishedAt?.toISOString()).toBe('2026-10-12T15:00:00.000Z')
    expect(readLayoffHeadline(a.title)).toMatchObject({ company: 'Kroger', employees: 3000 })
  })
})
