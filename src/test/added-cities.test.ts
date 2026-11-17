import { describe, expect, it } from 'vitest'
import { addedCityFor, addedCityNear, cityLabel, cityMatchers } from '@/lib/jobs/added-cities'
import { geoRing, memberGeo, COMMUTE_MILES } from '@/lib/jobs/relevance'
import { readSearchExpansion } from '@/lib/profile/search-expansion'
import { resolveScope } from '@/lib/jobs/search-scope'

const AUSTIN = { name: 'Austin, TX', state: 'TX', lat: 30.2672, lon: -97.7431 }
const DFW = { name: 'Dallas-Fort Worth Metro', state: 'TX', lat: 32.7767, lon: -96.797 }

describe('added cities: the job text test (fit score)', () => {
  const m = cityMatchers([AUSTIN, DFW])
  it('matches the city, not the rest of its state', () => {
    expect(addedCityFor('Austin, TX', ['TX'], m)).toBe('Austin, TX')
    expect(addedCityFor('Houston, TX', ['TX'], m)).toBeNull()
  })
  it('matches every town a metro groups', () => {
    expect(addedCityFor('Plano, Texas', ['TX'], m)).toBe('Dallas-Fort Worth Metro')
    expect(addedCityFor('Irving, TX 75039', ['TX'], m)).toBe('Dallas-Fort Worth Metro')
  })
  it('needs the city’s state when the location names one', () => {
    expect(addedCityFor('Austin, MN', ['MN'], m)).toBeNull()
    expect(addedCityFor('Hybrid - Austin', [], m)).toBe('Austin, TX')
  })
  it('matches whole words only', () => {
    expect(addedCityFor('Austintown, TX', ['TX'], m)).toBeNull()
  })
})

describe('added cities: the distance test (board relevance)', () => {
  it('counts a job within commuting distance of an added city like home', () => {
    const roundRock = { lat: 30.5083, lon: -97.6789 }
    expect(addedCityNear([roundRock], [AUSTIN], COMMUTE_MILES)?.name).toBe('Austin, TX')
    const g = memberGeo({ anchor: { lat: 39.96, lon: -83.0 }, currentState: 'OH', remotePreference: 'onsite', addedCities: [AUSTIN] })
    expect(geoRing(g, { remote: false, coords: [roundRock], states: ['TX'] })).toEqual({ ring: 0, note: 'in Austin, a city you added' })
  })
  it('leaves the rest of the state out', () => {
    const g = memberGeo({ anchor: { lat: 39.96, lon: -83.0 }, currentState: 'OH', remotePreference: 'onsite', addedCities: [AUSTIN] })
    expect(geoRing(g, { remote: false, coords: [{ lat: 29.76, lon: -95.37 }], states: ['TX'] })).toBeNull()
  })
})

describe('added cities: storage and scope', () => {
  it('reads cities defensively', () => {
    const e = readSearchExpansion({ cities: [AUSTIN, { name: 'x', state: 'Texas', lat: 1, lon: 1 }, { name: 'y', state: 'TX' }, AUSTIN] })
    expect(e.cities).toEqual([AUSTIN])
    expect(readSearchExpansion({}).cities).toEqual([])
  })
  it('keeps cities on Broader and drops them on Narrow', () => {
    const expansion = readSearchExpansion({ cities: [AUSTIN] })
    expect(resolveScope({ scope: 'broader', expansion, options: [] }).expansion.cities).toEqual([AUSTIN])
    expect(resolveScope({ scope: 'narrow', expansion, options: [] }).expansion.cities).toEqual([])
  })
  it('names a city plainly', () => {
    expect(cityLabel('Austin, TX')).toBe('Austin')
    expect(cityLabel('Dallas-Fort Worth Metro')).toBe('Dallas-Fort Worth')
  })
})
