import { describe, expect, it } from 'vitest'
import { firstDollarFigure } from '@/lib/vision/competitor-areas'

describe('firstDollarFigure', () => {
  it('reads millions, billions, thousands and plain dollars', () => {
    expect(firstDollarFigure('$63.4M (estimate, ZoomInfo) or $143.5M (estimate, GrowJo)')).toBe(63_400_000)
    expect(firstDollarFigure('$1.7 billion (2025 reported)')).toBe(1_700_000_000)
    expect(firstDollarFigure('$217.5K (estimate) per GrowJo')).toBe(217_500)
    expect(firstDollarFigure('$377,101 (reported 2024)')).toBe(377_101)
    expect(firstDollarFigure('~$20M ARR')).toBe(20_000_000)
  })
  it('leaves a range, an upper bound or a note with no dollar figure blank', () => {
    expect(firstDollarFigure('$25-100M (estimate per Owler)')).toBeNull()
    expect(firstDollarFigure('$1–10M (estimate)')).toBeNull()
    expect(firstDollarFigure('<$5 million (estimate per ZoomInfo)')).toBeNull()
    expect(firstDollarFigure('₹100-500 Cr annually')).toBeNull()
    expect(firstDollarFigure('Significant growth in 2023')).toBeNull()
  })
})

import { cleanRelationship } from '@/lib/vision/competitor-areas'
describe('cleanRelationship', () => {
  it('accepts the ruled-out value and falls back to DIRECT for anything unknown', () => {
    expect(cleanRelationship('NOT_A_COMPETITOR')).toBe('NOT_A_COMPETITOR')
    expect(cleanRelationship('PARTNER')).toBe('PARTNER')
    expect(cleanRelationship('nonsense')).toBe('DIRECT')
  })
})
