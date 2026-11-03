import { describe, expect, it } from 'vitest'
import { percentiles, scorePool } from '@/lib/rankings/composites'
import { compositeSpecs, industryCitySpecs, rankCityComposite, rankCountyComposite, rankCounties, rankCities, wave1Specs, wave2PlaceSpecs, functionSpecs, skillSpecs, workforceSpecs, collegeSpecs, industrySpecs } from '@/lib/rankings/build-edition'
import type { CityStat, CountyStat } from '@/lib/rankings/types'

const city = (st: string, name: string, n: number, entry: number, extra: Partial<CityStat> = {}): CityStat => ({
  st, city: name, n, entry, ai: 0, remote: 0, paid: 0, payMed: null, eng: 0, engPaid: 0, engPay: null, employers: [], topShare: 0.1, mid: 0, exec: 0, ...extra,
})
const info = (c: CityStat) => ({ name: c.city[0].toUpperCase() + c.city.slice(1), href: `/places/x/city/${c.city}` })
const ctx = { costOf: () => ({ rpp: 100, basis: 'metro' as const }) }

describe('wave 4: all-round and industry-city lists', () => {
  it('turns values into percentiles, splitting ties', () => {
    expect(percentiles([10, 20, 30])).toEqual([0, 50, 100])
    expect(percentiles([5, 5, 5])).toEqual([50, 50, 50])
    expect(percentiles([1])).toEqual([50])
  })
  it('scores a pool by weighted percentiles, inverts lower-is-better, and drops items missing a component', () => {
    const comps = [
      { label: 'A', weight: 70, value: (x: { a: number | null; b: number }) => x.a, show: () => '' },
      { label: 'B', weight: 30, value: (x: { a: number | null; b: number }) => x.b, show: () => '', higherIsBetter: false },
    ]
    const out = scorePool([{ a: 1, b: 9 }, { a: 2, b: 5 }, { a: 3, b: 1 }, { a: null, b: 0 }], comps)
    expect(out).toHaveLength(3)
    expect(out.map((o) => Math.round(o.score))).toEqual([0, 50, 100])
  })
  it('ranks all-round city lists and states the weights', () => {
    const spec = compositeSpecs().find((x) => x.slug === 'best-all-round-cities-for-new-graduates')!
    const stats = Array.from({ length: 12 }, (_, i) => city('TX', `cc${i}`, 300, 30 + i * 10, { paid: 80, payMed: 80_000 + i * 1000 }))
    const e = rankCityComposite(spec, stats, info, ctx, '2026-11', 'x', null)!
    expect(e.rows[0].name).toBe('Cc11')
    expect(e.rows[0].valueLabel).toBe('93 / 100')
    expect(e.method.join(' ')).toContain('entry-level share of openings 40%')
    expect(e.lead).toContain('new graduates')
  })
  it('ranks all-round counties only when they are big enough', () => {
    const spec = compositeSpecs().find((x) => x.slug === 'best-county-job-markets')!
    const mk = (i: number, openings: number): CountyStat => ({ fips: `0400${i}`, st: 'TX', name: `C${i}`, href: null, population: 200_000, populationChangePct: i, jobsThen: 50_000, jobsNow: 50_000 + i * 500, infoThen: 0, infoNow: 0, rate: 5 - i * 0.2, rateYearAgo: 5, laborForce: 80_000, unemployed: 4_000, openings, ajc: 1 })
    const counties = [...Array.from({ length: 10 }, (_, i) => mk(i, 500 + i * 50)), mk(11, 20)]
    const e = rankCountyComposite(spec, counties, '2026-11', 'x', null)!
    expect(e.rows.some((r) => r.name === 'C11')).toBe(false)
    expect(e.rows[0].name).toBe('C9')
  })
  it('ranks counties on openings per unemployed person', () => {
    const spec = compositeSpecs().find((x) => x.measure === 'perunemp' && x.scope.kind === 'national')!
    const counties: CountyStat[] = Array.from({ length: 10 }, (_, i) => ({ fips: `0500${i}`, st: 'TX', name: `D${i}`, href: null, population: 200_000, populationChangePct: 1, jobsThen: 50_000, jobsNow: 52_000, infoThen: 0, infoNow: 0, rate: 4, rateYearAgo: 4, laborForce: 80_000, unemployed: 2_000, openings: 200 + i * 100 }))
    const e = rankCounties(spec, counties, '2026-11', 'x', null)!
    expect(e.rows[0].name).toBe('D9')
    expect(e.rows[0].valueLabel).toBe('55 per 100')
  })
  it('builds the industry-city and all-round sets with addresses that never collide with other lists', () => {
    expect(industryCitySpecs()).toHaveLength(34)
    expect(compositeSpecs()).toHaveLength(4 * 11 + 2 * 11 + 11)
    const all = [...wave1Specs(['TX']), ...wave2PlaceSpecs(), ...functionSpecs(), ...skillSpecs(), ...industrySpecs(), ...workforceSpecs(), ...collegeSpecs([]), ...industryCitySpecs(), ...compositeSpecs()]
    expect(new Set(all.map((x) => x.slug)).size).toBe(all.length)
  })
  it('ranks an industry\'s cities by openings with the industry counts', () => {
    const spec = industryCitySpecs().find((x) => x.slug === 'best-cities-for-technology-jobs')!
    const stats = Array.from({ length: 10 }, (_, i) => city('CA', `ic${i}`, 100 + i * 10, 0, { cityN: 1000 }))
    const e = rankCities(spec, stats, info, ctx, '2026-11', 'x', null)!
    expect(e.rows[0].name).toBe('Ic9')
    expect(e.rows[0].stats[0].label).toContain('Share')
  })
})
