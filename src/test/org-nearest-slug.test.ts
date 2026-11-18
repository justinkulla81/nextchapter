import { describe, expect, it } from 'vitest'
import { nearestOrgSlug } from '@/lib/seo/org-pages'

const florida = ['ocala-metro-chamber-and-economic-partnership', 'orlando-economic-partnership', 'miami-dade-beacon-council', 'miami-chamber']

describe('nearestOrgSlug', () => {
  it('trims a stray hyphen from a cut-off link', () => {
    expect(nearestOrgSlug(florida, 'miami-chamber-')).toBe('miami-chamber')
    expect(nearestOrgSlug(florida, '-miami--chamber')).toBe('miami-chamber')
  })
  it('keeps the merged-records rule: a longer address starting with one slug', () => {
    expect(nearestOrgSlug(florida, 'orlando-economic-partnership-orlando')).toBe('orlando-economic-partnership')
  })
  it('a first word that starts exactly one slug finds it (the 2026-11-18 404)', () => {
    expect(nearestOrgSlug(florida, 'ocala-marion-county-')).toBe('ocala-metro-chamber-and-economic-partnership')
  })
  it('an ambiguous or unknown first word finds nothing', () => {
    expect(nearestOrgSlug(florida, 'miami-economic')).toBeNull()
    expect(nearestOrgSlug(florida, 'tampa-bay-edc')).toBeNull()
    expect(nearestOrgSlug(florida, '-')).toBeNull()
  })
})
