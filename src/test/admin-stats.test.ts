// Part B Prompt 7's σ-deviation utility (src/lib/admin/stats.ts) has no
// real caller yet — see that file's header comment — so this is the only
// thing exercising it before observations.ts and the eventual /admin/issues
// and /admin/population pages do.
import { describe, it, expect } from 'vitest'
import { mean, standardDeviation, zScore, findSegmentDeviations, SIGNIFICANT_DEVIATION_THRESHOLD } from '@/lib/admin/stats'

describe('mean', () => {
  it('averages a set of values', () => {
    expect(mean([2, 4, 6])).toBe(4)
  })

  it('returns 0 for an empty set rather than NaN', () => {
    expect(mean([])).toBe(0)
  })
})

describe('standardDeviation', () => {
  it('computes population standard deviation', () => {
    // [2, 4, 4, 4, 5, 5, 7, 9] has a well-known population stdDev of 2.
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 5)
  })

  it('is 0 when every value is identical', () => {
    expect(standardDeviation([5, 5, 5, 5])).toBe(0)
  })

  it('returns 0 for an empty set', () => {
    expect(standardDeviation([])).toBe(0)
  })
})

describe('zScore', () => {
  it('computes how many standard deviations a value sits from the mean', () => {
    expect(zScore(80, 50, 10)).toBe(3)
    expect(zScore(20, 50, 10)).toBe(-3)
  })

  it('returns 0 when stdDev is 0, instead of dividing by zero', () => {
    expect(zScore(100, 50, 0)).toBe(0)
    expect(Number.isFinite(zScore(100, 50, 0))).toBe(true)
  })
})

describe('findSegmentDeviations', () => {
  interface Segment {
    name: string
    rate: number
  }

  it('flags segments whose rate deviates more than 1.5 sigma from the overall rate', () => {
    // Overall rate is 50%. Most segments cluster near it; Engineering is a
    // clear outlier.
    const segments: Segment[] = [
      { name: 'Engineering', rate: 20 },
      { name: 'Sales', rate: 52 },
      { name: 'Marketing', rate: 48 },
      { name: 'Operations', rate: 51 },
      { name: 'Finance', rate: 49 },
    ]

    const result = findSegmentDeviations(segments, (s) => s.rate, 50)
    const engineering = result.find((r) => r.segment.name === 'Engineering')
    const sales = result.find((r) => r.segment.name === 'Sales')

    expect(engineering?.deviates).toBe(true)
    expect(Math.abs(engineering!.zScore)).toBeGreaterThan(SIGNIFICANT_DEVIATION_THRESHOLD)
    expect(sales?.deviates).toBe(false)
  })

  it('flags nothing when every segment sits close to the overall rate', () => {
    const segments: Segment[] = [
      { name: 'A', rate: 49 },
      { name: 'B', rate: 50 },
      { name: 'C', rate: 51 },
      { name: 'D', rate: 50 },
    ]
    const result = findSegmentDeviations(segments, (s) => s.rate, 50)
    expect(result.every((r) => !r.deviates)).toBe(true)
  })

  it('respects a custom threshold', () => {
    const segments: Segment[] = [
      { name: 'A', rate: 40 },
      { name: 'B', rate: 50 },
      { name: 'C', rate: 60 },
    ]
    // A very high threshold should suppress every flag.
    const strict = findSegmentDeviations(segments, (s) => s.rate, 50, 100)
    expect(strict.every((r) => !r.deviates)).toBe(true)

    // A threshold of 0 should flag anything with any deviation at all.
    const lenient = findSegmentDeviations(segments, (s) => s.rate, 50, 0)
    expect(lenient.some((r) => r.deviates)).toBe(true)
  })
})
