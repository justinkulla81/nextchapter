import { describe, expect, it } from 'vitest'
import { HOUSING_WEIGHT, nonHousingParity, ownCostPerYear, payAfterLiving } from '@/lib/rankings/living-cost'

describe('pay after cost of living', () => {
  it('prices a year of owning the median home', () => {
    // $400k home: 30-year loan of $320k at 6.5% is about $24.3k a year, plus $6k tax and insurance.
    expect(ownCostPerYear(400_000)).toBeGreaterThan(30_000)
    expect(ownCostPerYear(400_000)).toBeLessThan(31_000)
  })

  it('takes housing out of the price parity', () => {
    expect(nonHousingParity({ rpp: 100, housingRpp: 100 })).toBeCloseTo(100)
    expect(nonHousingParity({ rpp: 110, housingRpp: 212 })).toBeLessThan(95)
    expect(nonHousingParity({ rpp: 104, housingRpp: null })).toBe(104)
    expect(HOUSING_WEIGHT).toBeGreaterThan(0.1)
  })

  it('ranks a cheap metro with decent pay above an expensive one with higher pay', () => {
    const sanJose = payAfterLiving(212_000, { rpp: 110.4, housingRpp: 211.9, home: 1_447_800, rent: 2840, basis: 'metro' }) as number
    const austin = payAfterLiving(140_000, { rpp: 98.1, housingRpp: 120.4, home: 465_000, rent: 1726, basis: 'metro' }) as number
    expect(austin).toBeGreaterThan(sanJose * 0.95)
    expect(sanJose).toBeLessThan(212_000 / 1.104 - 50_000)
  })

  it('has no figure without a home value', () => {
    expect(payAfterLiving(100_000, { rpp: 100, housingRpp: 100, home: null, rent: null, basis: 'state' })).toBeNull()
  })
})
