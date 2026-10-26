import { describe, expect, it } from 'vitest'
import { B2B_ASSETS, isB2bAssetKey } from '@/lib/marketing/b2b-assets'
import { PORTAL_PAGES } from '@/lib/marketing/portal-pages'

describe('B2B assets', () => {
  it('points every asset at a page on this site', () => {
    for (const a of Object.values(B2B_ASSETS)) expect(a.href.startsWith('/')).toBe(true)
  })
  it('only lets a partner page name an asset that exists', () => {
    for (const page of Object.values(PORTAL_PAGES)) {
      if (page.content.asset) expect(isB2bAssetKey(page.content.asset)).toBe(true)
    }
  })
  it('rejects an unknown asset key', () => {
    expect(isB2bAssetKey('nope')).toBe(false)
  })
})
