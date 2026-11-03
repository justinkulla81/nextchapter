import { describe, expect, it } from 'vitest'
import { buildEdition, isPaid, median, prevFrom, publishedCuts, BARS } from '@/lib/segments/aggregate'
import { changeClause, cutSentence, CUTS } from '@/lib/segments/cuts'
import { SEGMENTS, segmentBySlug, segmentsOf } from '@/lib/segments/defs'
import type { BoardRow } from '@/lib/segments/types'

const row = (o: Partial<BoardRow> & { company: string }): BoardRow => ({
  id: Math.random().toString(36).slice(2), title: 'Program Manager', companyId: null, st: 'VA', city: 'Arlington', level: 'MID_IC',
  payMin: null, payMax: null, payPeriod: null, currency: 'USD', postedAt: null, createdAt: '2026-11-01T00:00:00Z',
  industry: null, reqTags: null, postingType: null, sourceCategory: null, skills: [], noExperience: false, soc: null, ...o,
})
const of = (company: string, title = 'Program Manager', industry: string | null = null, reqTags: string | null = null) => segmentsOf({ company, title, industry, reqTags })

describe('segment rules', () => {
  it('has unique slugs and at least one rule each', () => {
    expect(new Set(SEGMENTS.map((s) => s.slug)).size).toBe(SEGMENTS.length)
    for (const s of SEGMENTS) expect(s.rules.length).toBeGreaterThan(0)
  })
  it('matches employers whole, not by a shared word', () => {
    expect(of('Target Corporation')).toContain('retail')
    expect(of('Targeted Genomics')).not.toContain('retail')
    expect(of('Lockheed Martin Corporation')).toContain('defense')
    expect(of('Palo Alto Networks')).not.toContain('tv')
  })
  it('reads crawler industry codes and clearance tags', () => {
    expect(of('Acme Health', 'Analyst', 'healthcare')).toContain('healthcare')
    expect(of('Unknown Co', 'Analyst', null, 'clearance:secret')).toContain('defense')
    expect(of('Unknown Co', 'Analyst')).toEqual([])
  })
  it('keeps look-alikes out', () => {
    expect(of('Aya Travel Nurse Staffing', 'Recruiter')).not.toContain('tourism-hospitality')
    expect(of('Marriott International')).toContain('tourism-hospitality')
    expect(of('Epic Games Video Games Studio')).not.toContain('casino-gaming')
    expect(of('Bellagio Casino Resort', 'Director')).toContain('casino-gaming')
    expect(of('Houston Sports Medicine Clinic')).not.toContain('sports')
    expect(of('Acme Corp', 'Data Center Technician')).toContain('data-centers')
    expect(of('Acme Corp', 'Data Center Sales Executive')).not.toContain('data-centers')
  })
  it('leaves out search firms and staffing agencies, and takes longer forms of an employer name', () => {
    expect(segmentsOf({ company: 'Gecko Hospitality', title: 'Hotel General Manager', industry: null, reqTags: null, sourceCategory: 'search_firm' })).toEqual([])
    expect(segmentsOf({ company: 'Marriott International', title: 'Hotel General Manager', industry: null, reqTags: null, postingType: 'recruiter_search' })).toEqual([])
    expect(of('Hilton Worldwide')).toContain('tourism-hospitality')
    expect(of('Hilton Grand Prairie Landscaping')).not.toContain('tourism-hospitality')
    expect(of('Hill Country Christian School', 'Athletic Director')).not.toContain('sports')
    expect(of('Dive Studios', 'Producer')).not.toContain('movies')
  })
  it('finds a segment by slug', () => {
    expect(segmentBySlug('defense')?.name).toBe('Defense and aerospace')
    expect(segmentBySlug('nope')).toBeNull()
  })
})

const paid = (n = 100_000) => ({ payMin: n, payMax: n + 20_000, payPeriod: 'year' as const })

describe('edition build', () => {
  const now = new Date('2026-11-10T00:00:00Z')
  it('counts one employer under every spelling and ranks by openings', () => {
    const rows = [
      ...Array.from({ length: 4 }, () => row({ company: 'Lockheed Martin Corp' })),
      ...Array.from({ length: 2 }, () => row({ company: 'Lockheed Martin Corporation' })),
      ...Array.from({ length: 3 }, () => row({ company: 'Northrop Grumman' })),
    ]
    const e = buildEdition('defense', '2026-11', rows, null, now)
    const top = e.cuts['top-employers']!
    expect(top[0]).toMatchObject({ rank: 1, value: 6 })
    expect(top[0].name).toMatch(/Lockheed/)
    expect(top).toHaveLength(2)
    expect(e.total).toBe(9)
  })
  it('publishes pay lists only with enough stated pay', () => {
    const few = Array.from({ length: 10 }, () => row({ company: 'A Co', soc: 'Engineers', ...paid() }))
    expect(buildEdition('x', '2026-11', few, null, now).cuts['highest-paying-roles']).toBeUndefined()
    expect(buildEdition('x', '2026-11', few, null, now).payMed).toBeNull()
    const many = Array.from({ length: BARS.segmentPaid }, (_, i) => row({ company: `Co ${i % 5}`, soc: 'Engineers', ...paid(90_000 + i * 1000) }))
    const e = buildEdition('x', '2026-11', many, null, now)
    expect(e.cuts['highest-paying-roles']?.[0].name).toBe('Engineers')
    expect(e.payMed).not.toBeNull()
  })
  it('does not rank a city where one employer posts half the openings', () => {
    const dominated = Array.from({ length: 12 }, (_, i) => row({ company: i < 8 ? 'Big Co' : `Other ${i}`, st: 'TX', city: 'Plano' }))
    const spread = Array.from({ length: 12 }, (_, i) => row({ company: `Co ${i}`, st: 'OH', city: 'Dayton' }))
    const cities = buildEdition('x', '2026-11', [...dominated, ...spread], null, now).cuts['top-cities']!
    expect(cities.map((c) => c.name)).toEqual(['Dayton, OH'])
  })
  it('reports places moved since last month', () => {
    const mk = (a: number, b: number) => [...Array.from({ length: a }, () => row({ company: 'Alpha' })), ...Array.from({ length: b }, () => row({ company: 'Beta' }))]
    const prev = buildEdition('x', '2026-10', mk(9, 5), null, now)
    const e = buildEdition('x', '2026-11', mk(5, 9), prevFrom(prev), now)
    const top = e.cuts['top-employers']!
    expect(top[0]).toMatchObject({ name: 'Beta', change: 1 })
    expect(top[1]).toMatchObject({ name: 'Alpha', change: -1 })
    expect(e.prev).toMatchObject({ edition: '2026-10', total: 14 })
    expect(changeClause(e)).toMatch(/same number|more|fewer/)
  })
  it('lists only the last seven days as new, and entry-level roles', () => {
    const rows = [
      row({ company: 'A', postedAt: '2026-11-09T00:00:00Z' }),
      row({ company: 'B', postedAt: '2026-10-01T00:00:00Z', createdAt: '2026-10-01T00:00:00Z' }),
      row({ company: 'C', level: 'ENTRY_IC', postedAt: '2026-11-08T00:00:00Z' }),
      row({ company: 'D', noExperience: true, postedAt: '2026-10-05T00:00:00Z', createdAt: '2026-10-05T00:00:00Z' }),
    ]
    const e = buildEdition('x', '2026-11', rows, null, now)
    expect(e.newest.map((j) => j.company).sort()).toEqual(['A', 'C'])
    expect(e.entry.total).toBe(2)
    expect(publishedCuts(e)).toContain('newest')
    expect(publishedCuts(e)).toContain('entry-level')
  })
  it('judges pay by the same rule as the rankings', () => {
    expect(isPaid({ payMin: 80_000, payMax: 100_000, payPeriod: 'year', currency: 'USD' })).toBe(true)
    expect(isPaid({ payMin: 40, payMax: 60, payPeriod: 'hour', currency: 'USD' })).toBe(false)
    expect(isPaid({ payMin: 80_000, payMax: 100_000, payPeriod: 'year', currency: 'EUR' })).toBe(false)
    expect(median([3, 1, 2, 4])).toBe(2.5)
  })
})

describe('copy', () => {
  it('reads each list from its own numbers and every cut has a heading', () => {
    const def = segmentBySlug('defense')!
    const rows = Array.from({ length: 6 }, () => row({ company: 'Boeing', soc: 'Engineers', ...paid() }))
    const e = buildEdition('defense', '2026-11', rows, null, new Date('2026-11-10T00:00:00Z'))
    expect(cutSentence(def, 'top-employers', e)).toContain('Boeing')
    expect(cutSentence(def, 'entry-level', e)).toContain('entry-level')
    for (const c of CUTS) expect(c.title(def)).toMatch(/defense and aerospace/)
  })
})
