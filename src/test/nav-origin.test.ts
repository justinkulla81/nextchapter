import { describe, expect, it } from 'vitest'
import { allowedNavOrigin } from '@/lib/nav/nav-origin'

const SITE = 'https://launchyournextchapter.com'

describe('allowedNavOrigin', () => {
  it('allows the site and its www host', () => {
    expect(allowedNavOrigin('https://launchyournextchapter.com', SITE)).toBe('https://launchyournextchapter.com')
    expect(allowedNavOrigin('https://www.launchyournextchapter.com', SITE)).toBe('https://www.launchyournextchapter.com')
  })
  it('allows www when the site is configured with www', () => {
    expect(allowedNavOrigin('https://launchyournextchapter.com', 'https://www.launchyournextchapter.com')).toBe('https://launchyournextchapter.com')
  })
  it.each([
    ['another site', 'https://evil.example.com'],
    ['a look-alike host', 'https://launchyournextchapter.com.evil.example'],
    ['another subdomain', 'https://candidate.launchyournextchapter.com'],
    ['plain http', 'http://launchyournextchapter.com'],
    ['an origin with a path', 'https://launchyournextchapter.com/x'],
    ['null', 'null'],
  ])('refuses %s', (_, origin) => expect(allowedNavOrigin(origin, SITE)).toBeNull())
  it('refuses when there is no origin or no site', () => {
    expect(allowedNavOrigin(null, SITE)).toBeNull()
    expect(allowedNavOrigin('https://launchyournextchapter.com', undefined)).toBeNull()
  })
})
