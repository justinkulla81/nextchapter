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

describe('territories', () => {
  it('maps territory slugs both ways and keeps them out of the state list', async () => {
    const { COLLEGE_TERRITORIES, territoryFromSlug, territorySlug } = await import('@/lib/seo/college-bar')
    expect(territoryFromSlug('puerto-rico')).toBe('PR')
    expect(territorySlug('VI')).toBe('u-s-virgin-islands')
    expect(territoryFromSlug(territorySlug('VI'))).toBe('VI')
    expect(Object.keys(COLLEGE_TERRITORIES)).toHaveLength(8)
    expect(territoryFromSlug('kentucky')).toBeNull()
  })
})

describe('majors to job functions', () => {
  it('maps the largest mapped fields, skips unmapped ones, no repeats', async () => {
    const { functionsForMajors } = await import('@/lib/seo/college-bar')
    const r = functionsForMajors([
      { field: 'Liberal arts & general studies', share: 0.4 },
      { field: 'Business & management', share: 0.3 },
      { field: 'Engineering', share: 0.2 },
      { field: 'Computer & information sciences', share: 0.1 },
    ])
    expect(r.fields).toEqual(['Business & management', 'Engineering', 'Computer & information sciences'])
    expect(r.functions.slice(0, 3)).toEqual(['Finance', 'Sales', 'Operations'])
    expect(new Set(r.functions).size).toBe(r.functions.length)
    expect(r.functions.length).toBeLessThanOrEqual(6)
  })
  it('returns nothing for a college with only unmapped fields', async () => {
    const { functionsForMajors } = await import('@/lib/seo/college-bar')
    expect(functionsForMajors([{ field: 'Theology', share: 1 }])).toEqual({ functions: [], fields: [] })
  })
})

describe('AI programs', () => {
  it('maps IPEDS award levels', async () => {
    const { aiLevelOf } = await import('@/lib/seo/college-bar')
    expect(['1', '2', '3', '5', '7', '17', '9', '21'].map(aiLevelOf)).toEqual(['certificate', 'certificate', 'associate', 'bachelor', 'master', 'doctorate', null, 'certificate'])
  })
  it('reads stored JSON defensively and writes one sentence', async () => {
    const { parseAiPrograms, aiProgramSentence } = await import('@/lib/seo/college-bar')
    expect(parseAiPrograms(null)).toBeNull()
    expect(parseAiPrograms({ year: 2024 })).toBeNull()
    const none = parseAiPrograms({ year: 2024, programs: [] })
    expect(none).toEqual({ year: 2024, programs: [] })
    expect(aiProgramSentence(none)).toBeNull()
    const a = parseAiPrograms({ year: 2024, programs: [{ track: 'ai', level: 'master', awards: 12 }, { track: 'bogus', level: 'master', awards: 3 }, { track: 'datasci', level: 'bachelor', awards: 40 }, { track: 'ai', level: 'bachelor', awards: 0 }] })
    expect(a?.programs).toHaveLength(2)
    expect(aiProgramSentence(a)).toBe('artificial intelligence, data science (bachelor, master)')
  })
})
