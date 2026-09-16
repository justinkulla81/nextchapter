import { describe, it, expect } from 'vitest'
import { buildTrackedHtml, extractUrls } from '@/lib/crm/outreach'

describe('extractUrls', () => {
  it('finds every distinct URL, deduped, in first-seen order', () => {
    const text = 'See https://a.com/x and https://b.com. Also https://a.com/x again.'
    expect(extractUrls(text)).toEqual(['https://a.com/x', 'https://b.com.'])
  })
  it('returns nothing for plain text with no links', () => {
    expect(extractUrls('Just saying hello, no links here.')).toEqual([])
  })
})

describe('buildTrackedHtml', () => {
  it('rewrites a known URL to its tracked redirect and appends the open pixel', () => {
    const urlToLinkId = new Map([['https://example.com/deck', 'link_1']])
    const html = buildTrackedHtml('Take a look: https://example.com/deck', urlToLinkId, 'track_1')
    expect(html).toContain('<a href="http://localhost:3000/api/crm/outreach/click/link_1">https://example.com/deck</a>')
    expect(html).toContain('src="http://localhost:3000/api/crm/outreach/open/track_1"')
  })
  it('leaves a URL untouched when it has no matching link id', () => {
    const html = buildTrackedHtml('Visit https://untracked.com please', new Map(), 'track_1')
    expect(html).toContain('https://untracked.com')
    expect(html).not.toContain('<a href')
  })
  it('splits blank-line-separated paragraphs and preserves single line breaks', () => {
    const html = buildTrackedHtml('Hi there,\nHope you are well.\n\nBest,\nJustin', new Map(), 'track_1')
    expect(html).toContain('<p>Hi there,<br>Hope you are well.</p>')
    expect(html).toContain('<p>Best,<br>Justin</p>')
  })
  it('escapes HTML-significant characters in the composed text', () => {
    const html = buildTrackedHtml('Rate < 5% & > expectations', new Map(), 'track_1')
    expect(html).toContain('Rate &lt; 5% &amp; &gt; expectations')
  })
})
