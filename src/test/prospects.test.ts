import { describe, expect, it } from 'vitest'
import { PROSPECTS } from '@/lib/prospects/config'

describe('prospect pages', () => {
  it('keys match slugs and each has the facts a page needs', () => {
    for (const [key, p] of Object.entries(PROSPECTS)) {
      expect(p.slug).toBe(key)
      expect(p.places.length).toBeGreaterThan(0)
      expect(p.areaId).toMatch(/^\d{5}$/)
      expect(p.headline.length).toBeGreaterThan(10)
      expect(p.claimLine.length).toBeGreaterThan(10)
    }
  })
  it('has the three test pages', () => {
    expect(Object.keys(PROSPECTS).sort()).toEqual(['brown-forman', 'live-in-lou', 'washington-jefferson'])
  })
  it('keeps job places specific to the city and state, so another Louisville is not counted', () => {
    for (const p of Object.values(PROSPECTS)) for (const pat of p.places) expect(pat).toMatch(/, (KY|PA|Kentucky|Pennsylvania)/)
  })
})
