import { describe, it, expect } from 'vitest'
import { buildCorpus, resolveMemberPivot, type MemberForPivot, type OccupationRows } from '@/lib/occupations/corpus'
import { ALL_OCCUPATIONS, ALT_TITLES, DATA_SCIENTISTS, MARKETING_MANAGERS, SALES_MANAGERS } from './fixtures/occupations-sample'

// Synthetic fixtures (see occupations-sample.ts), shaped as the database rows.
const rows: OccupationRows = {
  occupations: ALL_OCCUPATIONS.map((o) => ({
    onetSocCode: o.onetSocCode,
    socCode: o.socCode,
    title: o.title,
    jobZone: o.jobZone,
    isTarget: o.isTarget,
    elements: o.elements.map((e) => ({ kind: e.kind, elementId: e.elementId, elementName: e.name, importance: e.importance, level: e.level })),
    techSkills: o.techSkills.map((t) => ({ example: t.example, commodity: t.commodity ?? null, hotTechnology: !!t.hotTechnology })),
  })),
  altTitles: ALT_TITLES,
  wages: [
    { socCode: '11-2021', year: 2023, wageMedian: 150_000, topCoded: false },
    { socCode: '11-2021', year: 2024, wageMedian: 160_000, topCoded: false },
    { socCode: '11-2022', year: 2024, wageMedian: 176_000, topCoded: false },
    { socCode: '15-2051', year: 2024, wageMedian: 239_200, topCoded: true },
  ],
  projections: [{ socCode: '11-2022', changePct: 4, annualOpenings: 31_000 }],
  related: [{ onetSocCode: '11-2021.00', relatedOnetSocCode: '11-2022.00' }],
}
const corpus = buildCorpus(rows)
const member = (over: Partial<MemberForPivot> = {}): MemberForPivot => ({
  resumeLatestJobTitle: 'VP Marketing',
  primaryFunction: 'Marketing',
  targetFunction: null,
  keywords: ['hubspot', 'salesforce', 'excel', 'google analytics'],
  ...over,
})

describe('buildCorpus', () => {
  it('keeps only in-scope occupations', () => {
    const titles = corpus.profiles.map((p) => p.title)
    expect(titles).toContain('Data Scientists')
    expect(titles).not.toContain('Food Service Managers')
    expect(titles).not.toContain('Secretaries and Administrative Assistants')
  })
  it('takes the latest year of national pay and keeps the top-coded flag', () => {
    expect(corpus.pay.get('11-2021')?.medianWage).toBe(160_000)
    expect(corpus.pay.get('15-2051')?.topCoded).toBe(true)
  })
  it('indexes related occupations by O*NET-SOC code', () => {
    expect(corpus.related.get('11-2021.00')?.has('11-2022.00')).toBe(true)
  })
})

describe('resolveMemberPivot', () => {
  it('maps the latest title to an occupation and ranks the others', () => {
    const r = resolveMemberPivot(corpus, member())
    if (r.status !== 'ok') throw new Error('expected ok')
    expect(r.current).toEqual({ title: MARKETING_MANAGERS.title, socCode: '11-2021', basis: 'title' })
    expect(r.paths.map((p) => p.socCode)).not.toContain('11-2021')
    const scores = r.paths.map((p) => p.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
    const sales = r.paths.find((p) => p.socCode === SALES_MANAGERS.socCode)
    expect(sales).toMatchObject({ medianWage: 176_000, payChangePct: 10, growthPct: 4, annualOpenings: 31_000, onetRelated: true })
  })
  it('falls back to the primary function when the title does not map', () => {
    const r = resolveMemberPivot(corpus, member({ resumeLatestJobTitle: 'Chief Happiness Officer' }))
    expect(r).toMatchObject({ status: 'ok', current: { socCode: '11-2021', basis: 'function' } })
  })
  it('reports unmapped when neither the title nor the function maps', () => {
    expect(resolveMemberPivot(corpus, member({ resumeLatestJobTitle: null, primaryFunction: 'General' }))).toEqual({ status: 'unmapped' })
    expect(resolveMemberPivot(corpus, member({ resumeLatestJobTitle: 'Chief Happiness Officer', primaryFunction: null }))).toEqual({ status: 'unmapped' })
  })
  it('reports unavailable before any data is imported', () => {
    const empty = buildCorpus({ occupations: [], altTitles: [], wages: [], projections: [], related: [] })
    expect(resolveMemberPivot(empty, member())).toEqual({ status: 'unavailable' })
  })
  it('shows the considered role separately, even below the match cut-off, and not twice', () => {
    const r = resolveMemberPivot(corpus, member({ targetFunction: 'Data Science' }))
    if (r.status !== 'ok') throw new Error('expected ok')
    expect(r.considering?.socCode).toBe(DATA_SCIENTISTS.socCode)
    expect(r.paths.map((p) => p.socCode)).not.toContain(DATA_SCIENTISTS.socCode)
    // Top-coded pay: shown as a floor, with no pay difference.
    expect(r.considering).toMatchObject({ medianWage: 239_200, medianIsFloor: true, payChangePct: null })
    expect(r.considering?.toolsMissing.length).toBeGreaterThan(0)
  })
  it('has no considered role when the target is the member own occupation or unmapped', () => {
    const same = resolveMemberPivot(corpus, member({ targetFunction: 'Marketing' }))
    expect(same.status === 'ok' && same.considering).toBeNull()
    const none = resolveMemberPivot(corpus, member({ targetFunction: 'General' }))
    expect(none.status === 'ok' && none.considering).toBeNull()
  })
  it('returns plain JSON, so it can cross the server-client boundary', () => {
    const r = resolveMemberPivot(corpus, member({ targetFunction: 'Data Science' }))
    expect(JSON.parse(JSON.stringify(r))).toEqual(r)
  })
})
