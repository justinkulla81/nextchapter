import { describe, expect, it, vi } from 'vitest'
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/google/connection', () => ({ getAllGoogleConnections: async () => [], getValidAccessTokenFor: async () => '' }))
import { pagesShownInSearch, searchPath } from '@/lib/seo/shown-in-search'

describe('searchPath', () => {
  it('keeps only the path, without a trailing slash or query', () => {
    expect(searchPath('https://launchyournextchapter.com/conferences/mema-annual-conference?x=1')).toBe('/conferences/mema-annual-conference')
    expect(searchPath('https://launchyournextchapter.com/layoffs/')).toBe('/layoffs')
    expect(searchPath('https://launchyournextchapter.com/')).toBe('/')
    expect(searchPath('not a url')).toBeNull()
  })
})

describe('pagesShownInSearch', () => {
  it('is empty, never an error, when Search Console cannot be read', async () => {
    expect((await pagesShownInSearch()).size).toBe(0)
  })
})
