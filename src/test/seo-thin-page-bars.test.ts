import { describe, expect, it } from 'vitest'
import { COUNTY_MIN_POPULATION, meetsCountyBar } from '@/lib/places/places'
import { NONPROFIT_ORG_PAGES_INDEXED } from '@/lib/seo/nonprofit-pages'
import { ASSOCIATION_MIN_INDEXABLE_CONFERENCES } from '@/lib/seo/topic-quality'
import { SEARCH_FIRM_MIN_PUBLIC_ROLES, isSearchFirmIndexable } from '@/lib/seo/search-firm-bar'

// The thin-page audit of 2026-10-26 (scripts/seo/page-quality.py) set these bars; see each constant's comment.
describe('thin-page bars', () => {
  it('keeps a small county with no qualifying city out of search', () => {
    expect(meetsCountyBar(2_300, 0)).toBe(false)
    expect(meetsCountyBar(null, 0)).toBe(false)
    expect(meetsCountyBar(COUNTY_MIN_POPULATION - 1, 0)).toBe(false)
  })
  it('offers a county that is large or has a city page of its own', () => {
    expect(meetsCountyBar(COUNTY_MIN_POPULATION, 0)).toBe(true)
    expect(meetsCountyBar(2_300, 1)).toBe(true)
  })
  it('leaves individual nonprofit pages out of search until they carry their own content', () => {
    expect(NONPROFIT_ORG_PAGES_INDEXED).toBe(false)
  })
  it('asks more of association and search-firm pages', () => {
    expect(ASSOCIATION_MIN_INDEXABLE_CONFERENCES).toBeGreaterThanOrEqual(4)
    expect(isSearchFirmIndexable(SEARCH_FIRM_MIN_PUBLIC_ROLES - 1)).toBe(false)
    expect(SEARCH_FIRM_MIN_PUBLIC_ROLES).toBeGreaterThanOrEqual(5)
  })
})
