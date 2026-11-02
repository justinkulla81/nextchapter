import { describe, expect, it } from 'vitest'
import { extractNewsLinks, noteBeforeFirstLink } from '@/lib/research/news-inbox-text'

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
