import { describe, expect, it } from 'vitest'
import { FALLBACK_PALETTE, brandOrFallback, fallbackPair } from '@/lib/branding/fallback'
import { contrast } from '@/lib/branding/colors'

describe('fallback colors', () => {
  it('give the same pair for the same key, every time', () => {
    expect(fallbackPair('acme corp')).toEqual(fallbackPair('acme corp'))
  })
  it('spread different keys over the palette', () => {
    const seen = new Set(Array.from({ length: 200 }, (_, i) => fallbackPair(`company ${i}`).primary))
    expect(seen.size).toBeGreaterThan(8)
  })
  it('read: every primary carries white text at 4.5:1 or better', () => {
    for (const [primary] of FALLBACK_PALETTE) expect(contrast(primary, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })
  it('are marked as derived, never as a scanned brand', () => {
    expect(fallbackPair('x').secondaryDerived).toBe(true)
  })
  it('never replace a stored brand', () => {
    const real = { kind: 'EMPLOYER', sourceId: 'a', siteUrl: 'https://a.com', pair: fallbackPair('other'), candidates: [], source: 'MANUAL' as const, scannedAt: new Date() }
    expect(brandOrFallback(real, 'a')).toBe(real)
    expect(brandOrFallback(null, 'a').pair).toEqual(fallbackPair('a'))
  })
})
