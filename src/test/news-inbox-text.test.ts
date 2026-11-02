import { describe, expect, it } from 'vitest'
import { canAutoPublish, extractNewsLinks, noteBeforeFirstLink, type AutoPublishInput } from '@/lib/research/news-inbox-text'

const clean = (u: string) => {
  const url = new URL(u)
  for (const k of [...url.searchParams.keys()]) if (/^utm_/.test(k)) url.searchParams.delete(k)
  return url.toString()
}

describe('extractNewsLinks', () => {
  it('finds article links, strips tracking, drops housekeeping and our own site, and dedupes', () => {
    const text = [
      'Good one for the report: https://www.nytimes.com/2026/11/01/business/layoffs.html?utm_source=x.',
      'Also https://www.nytimes.com/2026/11/01/business/layoffs.html and https://example.com/a/unsubscribe?id=1',
      'https://mail.google.com/mail/u/0/#inbox https://launchyournextchapter.com/news (https://reuters.com/x)',
    ].join('\n')
    expect(extractNewsLinks(text, clean)).toEqual(['https://www.nytimes.com/2026/11/01/business/layoffs.html', 'https://reuters.com/x'])
  })
  it('returns nothing when there is no link', () => {
    expect(extractNewsLinks('no links here', clean)).toEqual([])
  })
})

describe('noteBeforeFirstLink', () => {
  it('keeps the comment and drops forwarding headers', () => {
    expect(noteBeforeFirstLink('Use for employers.\n---------- Forwarded message ---------\nFrom: a@b.c\nhttps://x.com/y')).toBe('Use for employers.')
  })
  it('is null when the email starts with the link', () => {
    expect(noteBeforeFirstLink('https://x.com/y')).toBeNull()
  })
})

describe('canAutoPublish', () => {
  const ok: AutoPublishInput = { website: true, political: false, tone: 'positive', credibilityTier: 'recognized', confidenceScore: 0.9, hasTitle: true }
  it('publishes a confident, credible, non-political story', () => {
    expect(canAutoPublish(ok, [])).toBe(true)
  })
  it('holds political, unsure, unknown-source, untitled and not-for-website stories', () => {
    expect(canAutoPublish({ ...ok, political: true }, [])).toBe(false)
    expect(canAutoPublish({ ...ok, confidenceScore: 0.84 }, [])).toBe(false)
    expect(canAutoPublish({ ...ok, credibilityTier: 'unknown' }, [])).toBe(false)
    expect(canAutoPublish({ ...ok, hasTitle: false }, [])).toBe(false)
    expect(canAutoPublish({ ...ok, website: false }, [])).toBe(false)
  })
  it('keeps News from being only bad news', () => {
    const negative = { ...ok, tone: 'negative' as const }
    expect(canAutoPublish(negative, ['negative', 'positive', 'neutral'])).toBe(true)
    expect(canAutoPublish(negative, ['negative', 'positive', 'negative'])).toBe(false)
    expect(canAutoPublish(ok, ['negative', 'negative', 'negative'])).toBe(true)
  })
})
