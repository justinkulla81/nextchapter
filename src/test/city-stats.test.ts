import { describe, expect, it } from 'vitest'
import { aggregateCityStats, cityOf, topCities, MIN_CITY_OPEN } from '@/lib/market/city-stats'

const at = (locationCity: string | null, locationState: string | null, location: string | null = null, workArrangement: string | null = null) => ({ locationCity, locationState, location, workArrangement })

describe('cityOf', () => {
  it('groups metro towns into their metro, only in the metro’s states', () => {
    expect(cityOf(at('Brooklyn', 'NY'))).toEqual({ city: 'New York Metro', state: 'NY' })
    expect(cityOf(at('Jersey City', 'NJ'))).toEqual({ city: 'New York Metro', state: 'NJ' })
    expect(cityOf(at('Portland', 'ME'))).toEqual({ city: 'Portland, ME', state: 'ME' })
    expect(cityOf(at('Aurora', 'IL'))).toEqual({ city: 'Aurora, IL', state: 'IL' })
  })
  it('reads "City, ST" from the location when the city is missing', () => {
    expect(cityOf(at(null, 'PA', 'West Chester, PA'))).toEqual({ city: 'West Chester, PA', state: 'PA' })
  })
  it('skips remote and placeless postings', () => {
    expect(cityOf(at('Boston', 'MA', null, 'remote'))).toBeNull()
    expect(cityOf(at(null, null, 'United States'))).toBeNull()
    expect(cityOf(at(null, 'GA', 'GEORGIA - VIRTUAL - GA01'))).toBeNull()
  })
  it('title-cases plain cities', () => {
    expect(cityOf(at('GRAND RAPIDS', 'MI'))?.city).toBe('Grand Rapids, MI')
    expect(cityOf(at('mclean', 'VA'))?.city).toBe('DC Metro')
  })
})

describe('aggregateCityStats', () => {
  const row = (fn: string, city: string, state: string, level = 'DIRECTOR', industryBucket: string | null = 'Insurance') => ({ fn, level, industryBucket, city: { city, state } })
  it('counts per function and per function in an industry, drops thin cells', () => {
    const rows = [
      ...Array.from({ length: 5 }, () => row('Finance', 'Chicago Metro', 'IL')),
      ...Array.from({ length: MIN_CITY_OPEN - 1 }, () => row('Finance', 'Omaha, NE', 'NE')),
    ]
    const out = aggregateCityStats(rows)
    expect(out.find((r) => r.kind === 'fn' && r.city === 'Chicago Metro')?.openNow).toBe(5)
    expect(out.find((r) => r.kind === 'fn_ind' && r.key === 'Finance|Insurance')?.openNow).toBe(5)
    expect(out.some((r) => r.city === 'Omaha, NE')).toBe(false)
  })
  it('names the state most of a metro’s postings are in', () => {
    const rows = [row('Finance', 'New York Metro', 'NJ'), row('Finance', 'New York Metro', 'NY'), row('Finance', 'New York Metro', 'NY')]
    expect(aggregateCityStats(rows).find((r) => r.kind === 'fn')?.state).toBe('NY')
  })
})

describe('topCities', () => {
  const rows = [
    { band: 'DIRECTOR', city: 'A', state: 'NY', openNow: 5 },
    { band: 'VP', city: 'A', state: 'NY', openNow: 4 },
    { band: 'DIRECTOR', city: 'B', state: 'TX', openNow: 8 },
    { band: 'ENTRY', city: 'C', state: 'CA', openNow: 50 },
  ]
  it('sums the member’s bands only', () => {
    expect(topCities(rows, ['DIRECTOR', 'VP']).map((c) => [c.city, c.openNow])).toEqual([['A', 9], ['B', 8]])
  })
  it('reads every band when the member has none', () => {
    expect(topCities(rows, [])[0].city).toBe('C')
  })
})
