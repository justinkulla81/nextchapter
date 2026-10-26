import { describe, it, expect, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/google/connection', () => ({ getAllGoogleConnections: vi.fn(), getValidAccessTokenFor: vi.fn() }))
import { pickSite } from '@/lib/google/search-console'

describe('pickSite', () => {
  it('prefers the Domain property over a URL-prefix one', () => {
    expect(
      pickSite([
        { siteUrl: 'https://launchyournextchapter.com/', permissionLevel: 'siteOwner' },
        { siteUrl: 'sc-domain:launchyournextchapter.com', permissionLevel: 'siteOwner' },
      ])
    ).toBe('sc-domain:launchyournextchapter.com')
  })
  it('falls back to a prefix property on the apex or www', () => {
    expect(pickSite([{ siteUrl: 'https://www.launchyournextchapter.com/', permissionLevel: 'siteFullUser' }])).toBe('https://www.launchyournextchapter.com/')
  })
  it('ignores unverified and unrelated properties', () => {
    expect(
      pickSite([
        { siteUrl: 'sc-domain:launchyournextchapter.com', permissionLevel: 'siteUnverifiedUser' },
        { siteUrl: 'https://example.com/', permissionLevel: 'siteOwner' },
      ])
    ).toBeNull()
  })
})
