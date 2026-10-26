import { describe, expect, it } from 'vitest'
import { COLLEGE_MIN_MAJORS, collegeIndexable, collegeSlugs, collegePath, slugify, unitidFromSlug } from '@/lib/seo/college-bar'

const ok = { enrollment: 4200, majors: 5, outcomes: 2, countyFips: '21111' }

describe('college page bar', () => {
  it('indexes a college with enrollment, fields of study, an outcome and a county', () => {
    expect(collegeIndexable(ok)).toBe(true)
  })
  it('keeps a college without enrollment out', () => {
    expect(collegeIndexable({ ...ok, enrollment: null })).toBe(false)
    expect(collegeIndexable({ ...ok, enrollment: 0 })).toBe(false)
  })
  it('needs the minimum fields of study', () => {
    expect(collegeIndexable({ ...ok, majors: COLLEGE_MIN_MAJORS })).toBe(true)
    expect(collegeIndexable({ ...ok, majors: COLLEGE_MIN_MAJORS - 1 })).toBe(false)
  })
  it('needs one outcome figure and a county', () => {
    expect(collegeIndexable({ ...ok, outcomes: 0 })).toBe(false)
    expect(collegeIndexable({ ...ok, countyFips: null })).toBe(false)
  })
})

describe('college slugs', () => {
  it('slugifies names', () => {
    expect(slugify("St. John's College & Seminary")).toBe('st-johns-college-and-seminary')
  })
  it('uses the name when it is unique in the state', () => {
    const m = collegeSlugs([{ unitid: '1', name: 'Berea College', city: 'Berea' }, { unitid: '2', name: 'Centre College', city: 'Danville' }])
    expect(m.get('1')).toBe('berea-college')
  })
  it('adds the city when two colleges share a name', () => {
    const m = collegeSlugs([{ unitid: '1', name: 'Sullivan University', city: 'Louisville' }, { unitid: '2', name: 'Sullivan University', city: 'Lexington' }])
    expect(m.get('1')).toBe('sullivan-university-louisville')
    expect(m.get('2')).toBe('sullivan-university-lexington')
  })
  it('adds the IPEDS id when name and city both collide', () => {
    const m = collegeSlugs([{ unitid: '111111', name: 'Beauty Academy', city: 'Reno' }, { unitid: '222222', name: 'Beauty Academy', city: 'Reno' }])
    expect(m.get('111111')).toBe('beauty-academy-111111')
    expect(m.get('222222')).toBe('beauty-academy-222222')
  })
  it('gives every college in a state a different slug', () => {
    const list = Array.from({ length: 30 }, (_, i) => ({ unitid: String(100000 + i), name: i % 3 ? 'Same Name College' : `College ${i}`, city: i % 2 ? 'Town' : null }))
    const slugs = [...collegeSlugs(list).values()]
    expect(new Set(slugs).size).toBe(slugs.length)
  })
  it('reads the IPEDS id off an id-suffixed address only', () => {
    expect(unitidFromSlug('beauty-academy-111111')).toBe('111111')
    expect(unitidFromSlug('berea-college')).toBeNull()
    expect(unitidFromSlug('college-2024')).toBeNull()
  })
  it('builds the page path', () => {
    expect(collegePath('kentucky', 'berea-college')).toBe('/higher-education/kentucky/berea-college')
  })
})

describe('college pings', () => {
  it('sends new and changed urls only', async () => {
    const { planCollegePings } = await import('@/lib/seo/college-bar')
    const cur = { a: '2026-10-01', b: '2026-10-02', c: '2026-10-03' }
    expect(planCollegePings(cur, { a: '2026-10-01', b: '2026-09-01' })).toEqual(['b', 'c'])
    expect(planCollegePings(cur, cur)).toEqual([])
  })
})
