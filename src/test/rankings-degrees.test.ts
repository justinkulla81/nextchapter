import { describe, expect, it } from 'vitest'
import { OCCUPATIONS, degreeSpecs, fieldOf, rankDegreeCities, rankDegreeShare, rankDegrees, rankFields, rankLevels, rankOccupations, type GroupStat, type SocStat } from '@/lib/rankings/degrees-specs'
import { profileSpecs } from '@/lib/rankings/wave5-specs'
import { supportSpecs } from '@/lib/rankings/wave6-specs'
import { collegeSpecs, compositeSpecs, functionSpecs, industryCitySpecs, industrySpecs, skillSpecs, wave1Specs, wave2PlaceSpecs, workforceSpecs } from '@/lib/rankings/build-edition'
import { MEASURE_GUIDE } from '@/lib/rankings/guides'
import { MEASURE_SOURCES } from '@/lib/rankings/measures'

const E = '2026-11'
const fields = ['Nursing', 'Engineering', 'Law', 'Education', 'Accounting', 'Computer science and IT', 'Finance and economics']
const groups: GroupStat[] = [
  ...fields.map((k, i) => ({ kind: 'field' as const, key: k, n: 400 + i * 500, paid: 100, payMed: 70_000 + i * 5000 })),
  ...(['hs', 'bach', 'master', 'doctoral', 'assoc', 'none'] as const).map((k, i) => ({ kind: 'level' as const, key: k, n: 1000 + i * 700, paid: 200, payMed: 50_000 + i * 9000 })),
]

describe('degree lists', () => {
  it('has unique addresses, a guide and sources for every measure', () => {
    const specs = degreeSpecs()
    const all = [...wave1Specs(['TX']), ...wave2PlaceSpecs(), ...functionSpecs(), ...skillSpecs(), ...industrySpecs(), ...workforceSpecs(), ...collegeSpecs([]), ...industryCitySpecs(), ...compositeSpecs(), ...profileSpecs(), ...supportSpecs(), ...specs]
    expect(new Set(all.map((s) => s.slug)).size).toBe(all.length)
    for (const s of specs) { expect(MEASURE_GUIDE[s.measure]).toBeDefined(); expect(MEASURE_SOURCES[s.measure].length).toBeGreaterThan(0) }
    expect(specs.length).toBe(5 + 3 + 11 + 4 + 22)
  })
  it('knows the education of real occupations and assigns fields only to four-year-degree ones', () => {
    expect(OCCUPATIONS['11-1011'].e).toBe('bach')
    expect(Object.keys(OCCUPATIONS).length).toBeGreaterThan(800)
    expect(fieldOf('29-1141', 'bach')).toBe('Nursing')
    expect(fieldOf('13-2011', 'bach')).toBe('Accounting')
    expect(fieldOf('15-1252', 'bach')).toBe('Computer science and IT')
    expect(fieldOf('29-2061', 'postnd')).toBeNull()
  })
  it('ranks fields most and fewest from the same counts, and by pay', () => {
    const s = (slug: string) => degreeSpecs().find((x) => x.slug === slug)!
    const most = rankFields(s('degree-fields-with-the-most-open-jobs'), groups, E, 'x', null)!
    const few = rankFields(s('degree-fields-with-the-fewest-open-jobs'), groups, E, 'x', null)!
    expect(most.rows[0].name).toBe('Finance and economics')
    expect(few.rows[0].name).toBe('Nursing')
    expect(most.placeNoun).toBe('degrees')
    expect(rankFields(s('degree-fields-with-the-highest-posted-pay'), groups, E, 'x', null)!.rows[0].valueLabel).toBe('$100k')
    expect(rankFields(s('degree-fields-projected-to-grow-fastest'), groups, E, 'x', null)!.rows[0].valueLabel).toMatch(/^[+−]/)
  })
  it('ranks education levels and needs the minimum count of levels', () => {
    const e = rankLevels(degreeSpecs().find((x) => x.slug === 'education-levels-with-the-most-open-jobs')!, groups, E, 'x', null)!
    expect(e.rows[0].name).toBe('No formal educational credential')
    expect(rankLevels(degreeSpecs().find((x) => x.slug === 'education-levels-with-the-most-open-jobs')!, groups.slice(0, 9), E, 'x', null)).toBeNull()
  })
  it('ranks occupations within an education group only', () => {
    const socs: SocStat[] = Object.keys(OCCUPATIONS).map((soc, i) => ({ soc, n: 150 + (i % 50) * 10, paid: 40, payMed: 50_000 + (i % 40) * 1000 }))
    const spec = degreeSpecs().find((x) => x.slug === 'occupations-needing-a-bachelors-degree-with-the-most-open-jobs')!
    const e = rankOccupations(spec, socs, E, 'x', null)!
    expect(e.rows.every((r) => r.sub === 'Bachelor\'s degree')).toBe(true)
    const none = rankOccupations(degreeSpecs().find((x) => x.slug === 'occupations-needing-no-college-degree-projected-to-shrink-most')!, socs, E, 'x', null)!
    expect(none.rows[0].value).toBeLessThanOrEqual(none.rows[1].value)
  })
  it('ranks job families by degree share, ascending for the fewest', () => {
    const stats = Array.from({ length: 10 }, (_, i) => ({ kind: 'function' as const, key: `F${i}`, coded: 2000, degree4: 1000 + i * 90 }))
    const hi = rankDegreeShare(degreeSpecs().find((x) => x.slug === 'job-families-where-the-most-jobs-need-a-four-year-degree')!, stats, E, 'x', null)!
    const lo = rankDegreeShare(degreeSpecs().find((x) => x.slug === 'job-families-where-the-fewest-jobs-need-a-four-year-degree')!, stats, E, 'x', null)!
    expect(hi.rows[0].name).toBe('F9')
    expect(lo.rows[0].name).toBe('F0')
  })
  it('ranks cities and skips one dominated by a single employer', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ st: 'TX', city: `c${i}`, coded: 400, below: 80 + i }))
    const base = (r: { st: string; city: string }) => ({ st: r.st, city: r.city, n: 400, employers: ['A'], topShare: r.city === 'c11' ? 0.8 : 0.1 }) as never
    const spec = degreeSpecs().find((x) => x.slug === 'cities-with-the-most-jobs-that-do-not-need-a-four-year-degree')!
    const e = rankDegreeCities(spec, rows, base, (c) => ({ name: c.city, href: null }), E, 'x', null)!
    expect(e.rows).toHaveLength(11)
    expect(e.rows[0].name).toBe('c10')
    expect(rankDegrees(spec, { socs: [], groups: [], entities: [], cityRows: rows, base, info: (c) => ({ name: c.city, href: null }) }, E, 'x', null)!.rows).toHaveLength(11)
  })
})
