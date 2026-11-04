import { describe, expect, it } from 'vitest'
import nextConfig from '../../next.config'
import { INDUSTRIES } from '@/lib/seo/topics'

// #887 renamed the industry to "Non-profit & Social Impact", which changed its slug. The old address must keep working.
describe('old nonprofit industry slug', () => {
  it('the industry now has the hyphenated slug', () => {
    expect(INDUSTRIES.some((i) => i.slug === 'non-profit-and-social-impact')).toBe(true)
    expect(INDUSTRIES.some((i) => i.slug === 'nonprofit-and-social-impact')).toBe(false)
  })
  it('redirects the old slug permanently everywhere the industry slug is used', async () => {
    const redirects = (await nextConfig.redirects?.()) ?? []
    for (const base of ['/industries', '/feeds/industries', '/embed/hiring']) {
      const r = redirects.find((x) => x.source === `${base}/nonprofit-and-social-impact/:path*`)
      expect(r, base).toBeTruthy()
      expect(r?.destination).toBe(`${base}/non-profit-and-social-impact/:path*`)
      expect(r?.permanent).toBe(true)
    }
  })
})
