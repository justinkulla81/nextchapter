import { describe, expect, it } from 'vitest'
import { PLACE_MIN_JOBS, cleanCity, computeTitlePlaces, displayCity, parsePlace, placeKey, placeName, type PlaceRow } from '@/lib/seo/job-title-places'

const rows = (n: number, state: string, city: string | null, pay: number | null = null, start = 0): PlaceRow[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${state}-${city}-${start + i}`, state, city, company: ['Acme', 'Globex', 'Initech'][i % 3], posted: 1_000 + start + i, pay }))

describe('place keys', () => {
  it('names a city and a state the way the address spells them', () => {
    expect(placeKey('city', 'IL', 'Chicago')).toBe('chicago-il')
    expect(placeKey('city', 'NY', 'New York City')).toBe('new-york-ny')
    expect(placeKey('city', 'DC', 'Washington, DC')).toBe('washington-dc')
    expect(placeKey('state', 'TX')).toBe('texas')
    expect(placeKey('state', 'NY')).toBe('new-york')
    expect(placeName('city', 'IL', 'chicago')).toBe('Chicago, IL')
    expect(placeName('state', 'TX')).toBe('Texas')
  })
  it('leaves out names that are not a city', () => {
    for (const c of ['Remote', 'remotely based in boston', 'Multiple Locations', 'United States', '123', '', null, 'a', 'one two three four five']) expect(cleanCity(c)).toBeNull()
    expect(placeKey('city', 'ZZ', 'Chicago')).toBeNull()
  })
  it('capitalizes each part of a name', () => {
    expect(displayCity('san francisco')).toBe('San Francisco')
    expect(displayCity("o'fallon")).toBe("O'Fallon")
    expect(displayCity('winston-salem')).toBe('Winston-Salem')
  })
  it('reads a place back from an address', () => {
    expect(parsePlace('texas')).toEqual({ kind: 'state', state: 'TX', citySlug: null })
    expect(parsePlace('new-york')).toEqual({ kind: 'state', state: 'NY', citySlug: null })
    expect(parsePlace('chicago-il')).toEqual({ kind: 'city', state: 'IL', citySlug: 'chicago' })
    expect(parsePlace('san-francisco-ca')).toEqual({ kind: 'city', state: 'CA', citySlug: 'san-francisco' })
    expect(parsePlace('nowhere')).toBeNull()
    expect(parsePlace('chicago-zz')).toBeNull()
    expect(parsePlace('../x')).toBeNull()
  })
})

describe('computeTitlePlaces', () => {
  const titles = [
    { slug: 'controller', name: 'Controller', rows: [...rows(PLACE_MIN_JOBS.city, 'IL', 'Chicago', 150_000), ...rows(3, 'IL', 'Peoria', null, 100), ...rows(PLACE_MIN_JOBS.state, 'TX', null, null, 200)] },
    { slug: 'accountant', name: 'Accountant', rows: [...rows(12, 'IL', 'chicago', null, 300), ...rows(12, 'IL', 'Springfield', null, 400)] },
  ]
  const out = computeTitlePlaces(titles)
  const get = (slug: string, key: string) => out.find((p) => p.titleSlug === slug && p.key === key)

  it('gives a page only to pairs that meet the bar', () => {
    expect(get('controller', 'chicago-il')?.jobs).toBe(PLACE_MIN_JOBS.city)
    expect(get('controller', 'peoria-il')).toBeUndefined()
    expect(get('controller', 'texas')?.jobs).toBe(PLACE_MIN_JOBS.state)
    expect(get('controller', 'illinois')).toBeUndefined() // 13 listings in the state, under the state bar of 15
    expect(get('accountant', 'illinois')?.jobs).toBe(24)
  })
  it('needs at least three employers', () => {
    const one = computeTitlePlaces([{ slug: 'solo', name: 'Solo', rows: rows(20, 'OH', 'Dayton').map((r) => ({ ...r, company: 'Only Co' })) }])
    expect(one).toEqual([])
  })
  it('counts a city name spelled two ways once', () => {
    expect(get('accountant', 'chicago-il')?.jobs).toBe(12)
  })
  it('shows pay only when enough listings state it', () => {
    expect(get('controller', 'chicago-il')?.median).toBe(150_000)
    expect(get('accountant', 'chicago-il')?.median).toBeNull()
  })
  it('lists the newest listings first and keeps the other titles and places that have pages', () => {
    const c = get('controller', 'chicago-il')!
    expect(c.jobIds[0]).toBe(`IL-Chicago-${PLACE_MIN_JOBS.city - 1}`)
    expect(c.otherTitles.map((t) => t.slug)).toEqual(['accountant'])
    const a = get('accountant', 'chicago-il')!
    expect(a.nearby.map((n) => n.key)).toEqual(['springfield-il'])
    expect(a.otherTitles.map((t) => t.slug)).toEqual(['controller'])
  })
  it('never links to a place without a page', () => {
    const keys = new Set(out.map((p) => `${p.titleSlug}:${p.key}`))
    for (const p of out) {
      for (const n of p.nearby) expect(keys.has(`${p.titleSlug}:${n.key}`)).toBe(true)
      for (const t of p.otherTitles) expect(keys.has(`${t.slug}:${p.key}`)).toBe(true)
    }
  })
})
