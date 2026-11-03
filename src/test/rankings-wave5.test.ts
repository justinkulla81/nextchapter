import { describe, expect, it } from 'vitest'
import { METRICS, aiJobSpecs, cityProfileSpecs, entitySpecs, profileSpecs, rankAiJobs, rankEntities, rankProfileCities, type EntityStat, type ProfileCityRow } from '@/lib/rankings/wave5-specs'
import { collegeSpecs, compositeSpecs, functionSpecs, industryCitySpecs, industrySpecs, skillSpecs, wave1Specs, wave2PlaceSpecs, workforceSpecs } from '@/lib/rankings/build-edition'
import type { CityStat } from '@/lib/rankings/types'

const ent = (key: string, i: number, extra: Partial<EntityStat> = {}): EntityStat => ({ kind: 'function', key, n: 2000, entry: 200 + i * 10, entryAi: 20 + i, ai: 100, remote: 100 + i * 20, hybrid: 100, mgmt: 100 + i * 10, eq: 100, noexp: 100, training: 100, paid: 800, payMed: 120_000, ...extra })
const names = ['Operations', 'Sales', 'Finance', 'Legal', 'Marketing', 'Product', 'Design', 'Security', 'Clinical']

describe('wave 5 lists', () => {
  it('builds the entity, city and AI sets with unique addresses that never collide with other lists', () => {
    expect(entitySpecs()).toHaveLength(METRICS.length * 2)
    expect(cityProfileSpecs()).toHaveLength(3 * 11)
    expect(aiJobSpecs()).toHaveLength(3)
    const all = [...wave1Specs(['TX']), ...wave2PlaceSpecs(), ...functionSpecs(), ...skillSpecs(), ...industrySpecs(), ...workforceSpecs(), ...collegeSpecs([]), ...industryCitySpecs(), ...compositeSpecs(), ...profileSpecs()]
    expect(new Set(all.map((s) => s.slug)).size).toBe(all.length)
  })
  it('ranks job families on a share, highest first, with the family page as the link', () => {
    const spec = entitySpecs().find((s) => s.slug === 'functions-with-the-most-remote-jobs')!
    const e = rankEntities(spec, names.map((n, i) => ent(n, i)), '2026-11', 'x', null)!
    expect(e.rows[0].name).toBe('Clinical')
    expect(e.rows[0].valueLabel).toBe('13%')
    expect(e.rows[0].href).toContain('/functions/')
    expect(e.placeNoun).toBe('job families')
    expect(e.lead).toContain('remote')
  })
  it('ranks lowest first for the fewest people-management roles, and ignores families that are too small', () => {
    const spec = entitySpecs().find((s) => s.measure === 'pf_lowmgmt' && s.fn === 'function')!
    const stats = [...names.map((n, i) => ent(n, i)), ent('Tiny', 0, { n: 300, mgmt: 0 })]
    const e = rankEntities(spec, stats, '2026-11', 'x', null)!
    expect(e.rows.some((r) => r.name === 'Tiny')).toBe(false)
    expect(e.rows[0].name).toBe('Operations')
    expect(e.rows[0].bar).toBe(1)
  })
  it('measures entry-level AI as a share of entry-level roles only', () => {
    const spec = entitySpecs().find((s) => s.measure === 'pf_entryai' && s.fn === 'function')!
    const e = rankEntities(spec, names.map((n, i) => ent(n, i)), '2026-11', 'x', null)!
    expect(e.rows[0].stats[1].label).toBe('Entry-level openings')
  })
  it('ranks cities on no-experience share and drops one-employer towns', () => {
    const spec = cityProfileSpecs().find((s) => s.slug === 'cities-with-the-most-no-experience-jobs')!
    const rows: ProfileCityRow[] = Array.from({ length: 10 }, (_, i) => ({ st: 'TX', city: `c${i}`, n: 300, entry: 100, entryAi: 10, noexp: 20 + i * 5, hybrid: 10 }))
    const base = (r: ProfileCityRow): CityStat => ({ st: r.st, city: r.city, n: r.n, entry: 0, ai: 0, remote: 0, paid: 0, payMed: null, eng: 0, engPaid: 0, engPay: null, mid: 0, exec: 0, employers: [], topShare: r.city === 'c9' ? 0.9 : 0.1 })
    expect(rankProfileCities(spec, rows.slice(0, 6), base, (c) => ({ name: c.city.toUpperCase(), href: null }), '2026-11', 'x', null)).toBeNull()
    rows.push({ st: 'TX', city: 'c10', n: 300, entry: 100, entryAi: 10, noexp: 200, hybrid: 10 })
    const ok = rankProfileCities(spec, rows, base, (c) => ({ name: c.city.toUpperCase(), href: null }), '2026-11', 'x', null)!
    expect(ok.rows.some((r) => r.name === 'C9')).toBe(false)
    expect(ok.rows[0].name).toBe('C10')
  })
  it('ranks job groups by AI exposure, most or least first, and job families by the AI pay premium', () => {
    const groups = ['15', '13', '11', '23', '25', '27', '29', '41', '43'].map((soc, i) => ({ soc, n: 400 + i, paid: 100, payMed: 100_000 }))
    const most = rankAiJobs(aiJobSpecs()[0], groups, [], '2026-11', 'x', null)!
    expect(most.rows[0].name).toBe('Computer and mathematical')
    const least = rankAiJobs(aiJobSpecs()[1], groups, [], '2026-11', 'x', null)!
    expect(least.rows[0].value).toBeLessThan(least.rows[1].value)
    const prem = Array.from({ length: 9 }, (_, i) => ({ function: names[i], withAi: 40 + i, withoutAi: 500, premiumPct: 5 + i * 3, medianWithAi: 150_000, medianWithoutAi: 130_000 }))
    const pay = rankAiJobs(aiJobSpecs()[2], [], prem, '2026-11', 'x', null)!
    expect(pay.rows[0].name).toBe('Clinical')
    expect(pay.rows[0].valueLabel).toBe('+29%')
  })
})
