import { describe, expect, it } from 'vitest'
import { exposureFor } from '@/lib/skills/ai-exposure'
import { buildEdition, isPaid, median, prevFrom, publishedCuts, BARS } from '@/lib/segments/aggregate'
import { changeClause, cutSentence, CUTS } from '@/lib/segments/cuts'
import { SEGMENTS, segmentBySlug, segmentsOf } from '@/lib/segments/defs'
import type { BoardRow } from '@/lib/segments/types'

const row = (o: Partial<BoardRow> & { company: string }): BoardRow => ({
  id: Math.random().toString(36).slice(2), title: 'Program Manager', companyId: null, st: 'VA', city: 'Arlington', level: 'MID_IC',
  payMin: null, payMax: null, payPeriod: null, currency: 'USD', postedAt: null, createdAt: '2026-11-01T00:00:00Z',
  industry: null, reqTags: null, postingType: null, sourceCategory: null, socCode: null, sector: null, skills: [], noExperience: false, soc: null, ...o,
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
    for (const c of CUTS) expect(c.title(def)).toMatch(/defense and aerospace/i)
  })
})

describe('wave 2 segments', () => {
  const seg = (company: string, title = 'Analyst', industry: string | null = null, sector: string | null = null) => segmentsOf({ company, title, industry, reqTags: null, sector })
  it('has a group for every segment and 35 in all', () => {
    expect(SEGMENTS).toHaveLength(35)
    for (const s of SEGMENTS) expect(s.group).toBeTruthy()
  })
  it('places employers in the growth and energy segments', () => {
    expect(seg('Nucor Corporation')).toContain('steel-aluminum')
    expect(seg('Oklo Inc.')).toContain('clean-energy')
    expect(seg('Micron Technology, Inc.')).toContain('semiconductors')
    expect(seg('Bath Iron Works')).toContain('shipbuilding')
    expect(seg('Duke Energy Corporation')).toContain('utilities')
    expect(seg('Chevron U.S.A. Inc.')).toContain('oil-and-gas')
    expect(seg('Delta Air Lines')).toContain('airlines-aviation')
    expect(seg('OpenAI')).toContain('ai')
    expect(seg('Acme Corp', 'Machine Learning Engineer')).toContain('ai')
  })
  it('reads sectors and keeps look-alikes out', () => {
    expect(seg('Some Charity', 'Program Director', null, 'nonprofit')).toContain('nonprofits')
    expect(seg('State University', 'Registrar', null, 'academia')).toContain('education')
    expect(seg('Acme Corp', 'Program Director', null, null)).not.toContain('nonprofits')
    expect(seg('Human Resources Partners')).not.toContain('natural-resources')
    expect(seg('Automation Anywhere', 'Account Executive')).not.toContain('robotics-automation')
    expect(seg('Palo Alto Networks', 'Engineer')).not.toContain('telecom')
    expect(seg('Workspace Rentals')).not.toContain('space')
  })
})

describe('foundation and museum segments', () => {
  const seg = (company: string, sector: string | null = null) => segmentsOf({ company, title: 'Program Officer', industry: null, reqTags: null, sector })
  it('puts nonprofit foundations in the foundation list', () => {
    expect(seg('The Kresge Foundation', 'nonprofit')).toContain('foundation')
    expect(seg('Andrew W. Mellon Foundation', 'nonprofit')).toContain('foundation')
    expect(seg('University Of California San Francisco Foundation', 'nonprofit')).toContain('foundation')
  })
  it('keeps look-alikes and drug-maker patient programs out of it', () => {
    expect(seg('Foundation Risk Partners', null)).not.toContain('foundation')
    expect(seg('Foundation Building Materials', 'private')).not.toContain('foundation')
    expect(seg('Novartis Patient Assistance Foundation', 'nonprofit')).not.toContain('foundation')
  })
  it('puts museums, zoos, aquariums and science centers in the museum list', () => {
    expect(seg('Smithsonian Institution Museum Conservation Institute')).toContain('museum')
    expect(seg('Children\'s Museum of Houston')).toContain('museum')
    expect(seg('Monterey Bay Aquarium')).toContain('museum')
    expect(seg('Saint Louis Zoo')).toContain('museum')
    expect(seg('California Science Center')).toContain('museum')
  })
  it('keeps shops and near-matches out of it', () => {
    expect(seg('Aquarium Supply Co')).not.toContain('museum')
    expect(seg('Zoom Video Communications')).not.toContain('museum')
    expect(seg('Gallery Furniture')).not.toContain('museum')
  })
})

describe('least AI use list', () => {
  const exposure = new Map([['15-1252', { title: 'Software Developers', score: 0.42 }], ['47-2111', { title: 'Electricians', score: 0 }], ['11-9021', { title: 'Construction Managers', score: 0.02 }]])
  const now = new Date('2026-11-10T00:00:00Z')
  const rows = [
    ...Array.from({ length: 6 }, () => row({ company: 'A', soc: 'Electricians', socCode: '47-2111.00' })),
    ...Array.from({ length: 7 }, () => row({ company: 'B', soc: 'Construction Managers', socCode: '11-9021.00' })),
    ...Array.from({ length: 9 }, () => row({ company: 'C', soc: 'Software Developers', socCode: '15-1252.00' })),
    ...Array.from({ length: 3 }, () => row({ company: 'D', soc: 'Welders', socCode: '51-4121.00' })),
  ]
  it('orders roles by least observed use, and only lists measured roles with enough jobs', () => {
    const e = buildEdition('x', '2026-11', rows, null, now, exposure)
    const list = e.cuts['lowest-ai-exposure']!
    expect(list.map((r) => r.name)).toEqual(['Electricians', 'Construction Managers', 'Software Developers'])
    expect(list[0].valueLabel).toBe('0% of tasks')
    expect(list[1].valueLabel).toBe('2% of tasks')
  })
  it('publishes nothing without exposure data', () => {
    expect(buildEdition('x', '2026-11', rows, null, now).cuts['lowest-ai-exposure']).toBeUndefined()
    expect(exposureFor('47-2111.00', exposure)?.band).toBe('little')
  })
})

describe('employer name forms', () => {
  it('counts SEC-style names with a state ending as the same employer', () => {
    const rows = [...Array.from({ length: 4 }, () => row({ company: 'Rivian Automotive, Inc. / DE' })), ...Array.from({ length: 3 }, () => row({ company: 'Rivian Automotive' }))]
    const top = buildEdition('automotive-ev', '2026-11', rows, null, new Date('2026-11-10T00:00:00Z')).cuts['top-employers']!
    expect(top).toHaveLength(1)
    expect(top[0].value).toBe(7)
  })
  it('keeps contractors out of manufacturing and food makers out of mining', () => {
    expect(segmentsOf({ company: 'MasTec', title: 'Operations Manager', industry: 'industrial', reqTags: null })).not.toContain('us-manufacturing')
    expect(segmentsOf({ company: 'Ametek', title: 'Operations Manager', industry: 'industrial', reqTags: null })).toContain('us-manufacturing')
    expect(segmentsOf({ company: 'Flowers Foods', title: 'Analyst', industry: 'agriculture', reqTags: null })).not.toContain('natural-resources')
    expect(segmentsOf({ company: 'Code Metal', title: 'Engineer', industry: null, reqTags: null })).not.toContain('steel-aluminum')
    expect(segmentsOf({ company: 'Sikorsky Aircraft', title: 'Engineer', industry: null, reqTags: null })).not.toContain('airlines-aviation')
  })
})

describe('hiring momentum', () => {
  const now = new Date('2026-12-10T00:00:00Z')
  const mk = (a: number, b: number, c: number) => [...Array.from({ length: a }, () => row({ company: 'Alpha' })), ...Array.from({ length: b }, () => row({ company: 'Beta' })), ...Array.from({ length: c }, () => row({ company: 'Gamma' }))]
  it('has no list until there is an earlier month, then lists gainers only', () => {
    expect(buildEdition('x', '2026-11', mk(9, 6, 6), null, now).cuts.momentum).toBeUndefined()
    const nov = buildEdition('x', '2026-11', mk(9, 6, 6), null, now)
    expect(nov.counts?.length).toBe(3)
    const dec = buildEdition('x', '2026-12', mk(8, 12, 7), prevFrom(nov), now)
    const list = dec.cuts.momentum!
    expect(list.map((r) => [r.name, r.valueLabel])).toEqual([['Beta', '+6'], ['Gamma', '+1']])
    expect(list[0].sub).toBe('6 → 12 open')
  })
})

describe('live-data fixes', () => {
  const seg = (company: string, title = 'Engineer', industry: string | null = null) => segmentsOf({ company, title, industry, reqTags: null })
  it('keeps engineering consultancies out of manufacturing and power, and puts them in construction', () => {
    expect(seg('Sargent & Lundy', 'Process Engineer', 'industrial')).not.toContain('us-manufacturing')
    expect(seg('Sargent & Lundy', 'Substation Engineer')).not.toContain('utilities')
    expect(seg('Sargent & Lundy')).toContain('construction')
    expect(seg('Terracon Consultants', 'Geotechnical Engineer')).not.toContain('natural-resources')
  })
  it('keeps retailers, utilities and hardware makers out of the wrong lists', () => {
    expect(seg("O'Reilly Auto Parts")).not.toContain('automotive-ev')
    expect(seg('Ulta Beauty', 'Analyst', 'consumer')).not.toContain('consumer-packaged-goods')
    expect(seg('Pacific Gas & Electric', 'Analyst', 'energy')).not.toContain('oil-and-gas')
    expect(seg('Corsair Gaming')).not.toContain('casino-gaming')
    expect(seg("Love's Travel Stops")).not.toContain('tourism-hospitality')
    expect(seg('Carvana', 'Studio Operations Manager')).not.toContain('movies')
    expect(seg('Naval Air Systems Command')).not.toContain('shipbuilding')
    expect(seg('Alloy', 'Engineer')).not.toContain('steel-aluminum')
  })
})
