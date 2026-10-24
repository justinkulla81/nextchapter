import { describe, expect, it } from 'vitest'
import { canonicalUrlKey, isDeepLinkOnly, isPublicHttpUrl, nameKey, yearFromText } from './canonical'

describe('canonicalUrlKey', () => {
  it('ignores scheme, www, tracking params, fragment and trailing slash', () => {
    const a = canonicalUrlKey('https://www.HRTechConference.com/?utm_source=x&fbclid=1#top')
    expect(a).toBe('hrtechconference.com')
    expect(canonicalUrlKey('http://hrtechconference.com/')).toBe(a)
  })
  it('keeps meaningful params in a stable order', () => {
    expect(canonicalUrlKey('https://a.org/e?id=2&b=1')).toBe('a.org/e?b=1&id=2')
  })
  it('rejects non-http and junk', () => {
    expect(canonicalUrlKey('mailto:a@b.c')).toBeNull()
    expect(canonicalUrlKey('not a url')).toBeNull()
  })
})

describe('isPublicHttpUrl', () => {
  it('refuses private and local targets', () => {
    for (const u of ['http://localhost:3000', 'http://127.0.0.1', 'http://10.0.0.5', 'http://192.168.1.1', 'http://172.20.1.1', 'http://169.254.169.254/latest', 'http://[::1]/', 'http://intranet/', 'http://x.internal', 'ftp://a.com', 'https://user:pw@a.com'])
      expect(isPublicHttpUrl(u), u).toBe(false)
  })
  it('allows ordinary public pages', () => {
    expect(isPublicHttpUrl('https://hrtechconference.com/2027')).toBe(true)
    expect(isPublicHttpUrl('http://172.32.0.1')).toBe(true)
  })
})

describe('isDeepLinkOnly', () => {
  it('flags login-walled hosts and their subdomains', () => {
    expect(isDeepLinkOnly('https://www.linkedin.com/events/123')).toBe(true)
    expect(isDeepLinkOnly('https://uk.eventbrite.com/e/1')).toBe(true)
    expect(isDeepLinkOnly('https://notlinkedin.com')).toBe(false)
    expect(isDeepLinkOnly('https://www.eventbrite.com/e/1')).toBe(true)
    expect(isDeepLinkOnly('https://hrtechconference.com')).toBe(false)
  })
})

describe('nameKey and yearFromText', () => {
  it('collides the same event written two ways', () => {
    expect(nameKey('HR Tech 2027')).toBe(nameKey('The HR Tech Conference'))
  })
  it('finds a year in text or url', () => {
    expect(yearFromText('Summit 2027')).toBe(2027)
    expect(yearFromText(null, 'https://x.com/hrtech2026')).toBe(2026)
    expect(yearFromText('Room 12045')).toBeNull()
    expect(yearFromText('x', 'https://x.com/2026/')).toBe(2026)
  })
})
