import { describe, expect, it } from 'vitest'
import { STATE_METRICS, conferenceSpecs, countySupportSpecs, flexSpecs, rankConferences, rankCountySupport, rankFlex, rankStates, stateSpecs, supportSpecs, type ConfEvent, type FlexStat, type StateFact } from '@/lib/rankings/wave6-specs'
import { profileSpecs } from '@/lib/rankings/wave5-specs'
import { collegeSpecs, compositeSpecs, functionSpecs, industryCitySpecs, industrySpecs, skillSpecs, wave1Specs, wave2PlaceSpecs, workforceSpecs } from '@/lib/rankings/build-edition'
import type { CountyStat } from '@/lib/rankings/types'

const CODES = ['TX', 'CA', 'NY', 'FL', 'IL', 'OH', 'PA', 'GA', 'NC', 'MI', 'WA', 'VA']
const fact = (st: string, i: number): StateFact => ({ st, programs: 10 + i, training: 5 + i, relocation: i, ajc: 20 + i, unemployed: 100_000 + i * 1000, openings: 5_000 + i * 100, noticed: 1_000 + i * 200 })

describe('wave 6 lists', () => {
  it('builds the support, conference and flex sets with unique addresses', () => {
    expect(stateSpecs()).toHaveLength(STATE_METRICS.length)
    expect(countySupportSpecs()).toHaveLength(11)
    expect(conferenceSpecs()).toHaveLength(11 + 12 + 10)
    expect(flexSpecs()).toHaveLength(4)
    const all = [...wave1Specs(['TX']), ...wave2PlaceSpecs(), ...functionSpecs(), ...skillSpecs(), ...industrySpecs(), ...workforceSpecs(), ...collegeSpecs([]), ...industryCitySpecs(), ...compositeSpecs(), ...profileSpecs(), ...supportSpecs()]
    expect(new Set(all.map((s) => s.slug)).size).toBe(all.length)
  })
  it('ranks states on programs, with no sample size shown, and links to the state page', () => {
    const spec = stateSpecs().find((s) => s.measure === 'sx_programs')!
    const e = rankStates(spec, CODES.map(fact), '2026-11', 'x', null)!
    expect(e.rows[0].key).toBe('VA')
    expect(e.rows[0].href).toBe('/places/virginia')
    expect(e.rows[0].n).toBe(0)
    expect(e.commentary.join(' ')).not.toContain('sample of')
    expect(e.placeNoun).toBe('states')
  })
  it('ranks unemployment insurance from the verified state figures', () => {
    const spec = stateSpecs().find((s) => s.measure === 'sx_ui')!
    const e = rankStates(spec, Object.keys({ AL: 1, AK: 1, AZ: 1, AR: 1, CA: 1, CO: 1, CT: 1, DE: 1, FL: 1, GA: 1 }).map(fact), '2026-11', 'x', null)
    expect(e).not.toBeNull()
    expect(e!.rows[0].valueLabel).toContain('a week')
  })
  it('ranks hiring against layoff notices, and the reverse, from the same counts', () => {
    const facts = CODES.map(fact)
    const hire = rankStates(stateSpecs().find((s) => s.measure === 'sx_hire')!, facts, '2026-11', 'x', null)!
    const need = rankStates(stateSpecs().find((s) => s.measure === 'sx_need')!, facts, '2026-11', 'x', null)!
    expect(hire.rows[0].key).not.toBe(need.rows[0].key)
    expect(need.title).toBe('States where workforce help is needed most')
    expect(rankStates(stateSpecs().find((s) => s.measure === 'sx_hire')!, facts.map((f) => ({ ...f, noticed: 100 })), '2026-11', 'x', null)).toBeNull()
  })
  it('ranks counties on job centers per unemployed person and needs at least one center', () => {
    const spec = countySupportSpecs()[0]
    const mk = (i: number, ajc: number): CountyStat => ({ fips: `0600${i}`, st: 'TX', name: `K${i}`, href: null, population: 200_000, populationChangePct: 1, jobsThen: 50_000, jobsNow: 51_000, infoThen: 0, infoNow: 0, rate: 4, rateYearAgo: 4, laborForce: 80_000, unemployed: 5_000, ajc })
    const e = rankCountySupport(spec, [...Array.from({ length: 10 }, (_, i) => mk(i, 1 + i)), mk(11, 0)], '2026-11', 'x', null)!
    expect(e.rows[0].name).toBe('K9')
    expect(e.rows.some((r) => r.name === 'K11')).toBe(false)
  })
  it('counts conferences by city, honours the industry slice, and needs enough events', () => {
    const now = Date.parse('2026-11-03T00:00:00Z')
    const ev = (city: string, days: number, industries: string[] = [], major = false): ConfEvent => ({ st: 'TX', city, start: new Date(now + days * 86_400_000).toISOString(), major, industries, functions: [] })
    const events: ConfEvent[] = []
    for (let c = 0; c < 10; c++) for (let k = 0; k <= c + 5; k++) events.push(ev(`city${c}`, 10 + k, k % 2 ? ['Technology & Software'] : [], k === 0))
    const place = (st: string, city: string) => ({ key: `${st}|${city}`, info: { name: city.toUpperCase(), href: null } })
    const all = rankConferences(conferenceSpecs()[0], events, place, '2026-11', 'x', null, now)!
    expect(all.rows[0].name).toBe('CITY9')
    expect(all.rows[0].valueLabel).toBe('15 conferences')
    const tech = rankConferences(conferenceSpecs().find((s) => s.fn === 'Technology & Software')!, events, place, '2026-11', 'x', null, now)
    expect(tech?.rows[0].valueLabel).toBe('7 conferences')
    expect(rankConferences(conferenceSpecs()[0], events.slice(0, 20), place, '2026-11', 'x', null, now)).toBeNull()
  })
  it('ranks fractional and interim work as a small share, to two decimals', () => {
    const stats: FlexStat[] = ['Operations', 'Sales', 'Finance', 'Legal', 'Marketing', 'Product', 'Design', 'Security'].map((key, i) => ({ kind: 'function', key, n: 5000, flex: 30 + i * 5, contract: 100 }))
    const e = rankFlex(flexSpecs()[0], stats, '2026-11', 'x', null)!
    expect(e.rows[0].name).toBe('Security')
    expect(e.rows[0].valueLabel).toBe('1.30%')
  })
})
