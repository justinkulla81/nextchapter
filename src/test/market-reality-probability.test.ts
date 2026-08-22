// Pure math for the probability engine (Market Reality Redesign Part 1) —
// no Prisma, no server-only dep, same separation composite.ts's pure helpers
// get from their DB-calling wrapper.
import { describe, it, expect } from 'vitest'
import { cumulativeProbability, mapProbabilityToBand, PROBABILITY_BANDS, BAND_MIDPOINT } from '@/lib/scoring/market-reality/probability'

describe('cumulativeProbability', () => {
  it('is 0 with zero attempts', () => {
    expect(cumulativeProbability(0.05, 0)).toBe(0)
  })

  it('matches the known formula for a real N/p pair', () => {
    // 1 - (1-0.05)^10 ≈ 0.4013
    expect(cumulativeProbability(0.05, 10)).toBeCloseTo(0.4013, 3)
  })

  it('approaches 1 as attempts grow large, never exceeding it', () => {
    const result = cumulativeProbability(0.05, 500)
    expect(result).toBeLessThan(1)
    expect(result).toBeGreaterThan(0.99)
  })

  it('is a strictly increasing function of attempts for a fixed p', () => {
    const p = 0.02
    const a = cumulativeProbability(p, 10)
    const b = cumulativeProbability(p, 20)
    expect(b).toBeGreaterThan(a)
  })
})

describe('mapProbabilityToBand', () => {
  it('maps the exact band boundaries correctly', () => {
    expect(mapProbabilityToBand(0.08)).toBe('A')
    expect(mapProbabilityToBand(0.079999)).toBe('B')
    expect(mapProbabilityToBand(0.03)).toBe('B')
    expect(mapProbabilityToBand(0.029999)).toBe('C')
    expect(mapProbabilityToBand(0.01)).toBe('C')
    expect(mapProbabilityToBand(0.009999)).toBe('D')
    expect(mapProbabilityToBand(0.002)).toBe('D')
    expect(mapProbabilityToBand(0.001999)).toBe('F')
    expect(mapProbabilityToBand(0)).toBe('F')
  })

  it('handles a value well above the A floor', () => {
    expect(mapProbabilityToBand(0.5)).toBe('A')
  })
})

describe('BAND_MIDPOINT / PROBABILITY_BANDS consistency', () => {
  it('every band midpoint falls within its own band range', () => {
    for (const grade of ['A', 'B', 'C', 'D', 'F'] as const) {
      const midpoint = BAND_MIDPOINT[grade]
      const band = PROBABILITY_BANDS[grade]
      expect(midpoint).toBeGreaterThanOrEqual(band.min)
      if (band.max !== null) expect(midpoint).toBeLessThanOrEqual(band.max)
      // And the midpoint itself must map back to its own band.
      expect(mapProbabilityToBand(midpoint)).toBe(grade)
    }
  })
})
