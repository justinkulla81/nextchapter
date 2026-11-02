import { describe, expect, it } from 'vitest'
import { rankCities, rankCounties, wave1Specs, MIN_RANKED, editionLabel } from '@/lib/rankings/build-edition'
import { CITY_MEASURES } from '@/lib/rankings/measures'
import type { CityStat, CountyStat } from '@/lib/rankings/types'

const city = (st: string, name: string, n: number, entry: number, extra: Partial<CityStat> = {}): CityStat => ({
  st, city: name, n, entry, ai: 0, remote: 0, paid: 0, payMed: null, eng: 0, engPaid: 0, engPay: null, employers: [], topShare: 0.1, ...extra,
})
const info = (c: CityStat) => ({ name: c.city[0].toUpperCase() + c.city.slice(1), href: `/places/x/city/${c.city}` })
const ctx = { costOf: () => ({ rpp: 100, basis: 'metro' as const }) }
const many = (k: number) => Array.from({ length: k }, (_, i) => city('TX', `city${i}`, 300 + i, 30 + i * 5))
const spec = wave1Specs(['TX'])[0]

describe('ranking engine', () => {
  it('ranks cities by share, highest first, and numbers them', () => {
    const e = rankCities(spec, many(12), info, ctx, '2026-11', '2026-11-03', null)!
    expect(e.rows[0].name).toBe('City11')
    expect(e.rows.map((r) => r.rank).slice(0, 3)).toEqual([1, 2, 3])
    expect(e.rows[0].value).toBeGreaterThan(e.rows[1].value)
    expect(e.lead).toContain('City11')
    expect(e.faq).toHaveLength(4)
  })
  it('publishes nothing when fewer than 8 places clear the sample bar', () => {
    expect(rankCities(spec, many(MIN_RANKED - 1), info, ctx, '2026-11', 'x', null)).toBeNull()
    const tiny = many(20).map((c) => ({ ...c, n: 50 }))
    expect(rankCities(spec, tiny, info, ctx, '2026-11', 'x', null)).toBeNull()
  })
  it('does not rank a city where one employer posts most of the openings', () => {
    const stats = [...many(10), city('TX', 'companytown', 300, 290, { topShare: 0.9 })]
    const e = rankCities(spec, stats, info, ctx, '2026-11', 'x', null)!
    expect(e.rows.some((r) => r.name === 'Companytown')).toBe(false)
    expect(e.method.join(' ')).toContain('single company')
  })
  it('records movement against the previous edition', () => {
    const prev = new Map([['TX|city11', 5], ['TX|city10', 1]])
    const e = rankCities(spec, many(12), info, ctx, '2026-12', 'x', prev)!
    expect(e.rows[0].change).toBe(4)
    expect(e.rows[1].change).toBe(-1 + 0)
    expect(e.rows[5].change).toBeNull()
    expect(e.commentary.join(' ')).toContain('Biggest climber')
  })
  it('limits a regional list to its states', () => {
    const south = wave1Specs(['TX']).find((s) => s.slug === 'best-cities-for-junior-jobs-in-the-southwest')!
    const stats = [...many(10), ...Array.from({ length: 10 }, (_, i) => city('NY', `ny${i}`, 400, 399 - i))]
    const e = rankCities(south, stats, info, ctx, '2026-11', 'x', null)!
    expect(e.rows.every((r) => r.sub === 'TX')).toBe(true)
  })
  it('leaves out cities with no price level from the pay-after-cost list', () => {
    const pay = wave1Specs(['TX']).find((s) => s.measure === 'paycost' && s.scope.kind === 'national')!
    const stats = many(12).map((c) => ({ ...c, paid: 60, payMed: 90_000 }))
    expect(rankCities(pay, stats, info, { costOf: () => null }, '2026-11', 'x', null)).toBeNull()
    const e = rankCities(pay, stats, info, { costOf: (c) => ({ rpp: c.city === 'city0' ? 120 : 90, basis: 'metro' }) }, '2026-11', 'x', null)!
    expect(e.rows[e.rows.length - 1].name).toBe('City0')
    expect(e.rows[0].valueLabel).toBe('$100k')
  })
  it('ranks counties on growth', () => {
    const g = wave1Specs([]).find((s) => s.slug === 'fastest-growing-job-markets')!
    const counties: CountyStat[] = Array.from({ length: 10 }, (_, i) => ({ fips: `0100${i}`, st: 'TX', name: `County ${i}`, href: null, population: 500_000, populationChangePct: 2, jobsThen: 100_000, jobsNow: 100_000 + i * 1000, infoThen: 0, infoNow: 0 }))
    const e = rankCounties(g, counties, '2026-11', 'x', null)!
    expect(e.rows[0].name).toBe('County 9')
    expect(e.rows[0].valueLabel).toBe('+9.0%')
  })
  it('builds the wave 1 set: 9 national, 40 regional, 20 state lists', () => {
    const specs = wave1Specs(['CA', 'TX', 'NY', 'FL', 'IL', 'VA', 'MA', 'PA', 'GA', 'OH'])
    expect(specs.filter((s) => s.scope.kind === 'national')).toHaveLength(9)
    expect(specs.filter((s) => s.scope.kind === 'region')).toHaveLength(40)
    expect(specs.filter((s) => s.scope.kind === 'state')).toHaveLength(20)
    expect(new Set(specs.map((s) => s.slug)).size).toBe(specs.length)
  })
  it('formats edition labels and defines every measure', () => {
    expect(editionLabel('2026-11')).toBe('November 2026')
    expect(Object.keys(CITY_MEASURES)).toHaveLength(7)
  })
})
