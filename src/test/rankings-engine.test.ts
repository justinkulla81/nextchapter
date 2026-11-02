import { describe, expect, it } from 'vitest'
import { rankCities, rankCounties, rankSkills, wave1Specs, wave2PlaceSpecs, functionSpecs, skillSpecs, MIN_RANKED, editionLabel } from '@/lib/rankings/build-edition'
import { CITY_MEASURES } from '@/lib/rankings/measures'
import type { CityStat, CountyStat, FnTotal, SkillStat } from '@/lib/rankings/types'

const city = (st: string, name: string, n: number, entry: number, extra: Partial<CityStat> = {}): CityStat => ({
  st, city: name, n, entry, ai: 0, remote: 0, paid: 0, payMed: null, eng: 0, engPaid: 0, engPay: null, employers: [], topShare: 0.1, mid: 0, exec: 0, ...extra,
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
    expect(Object.keys(CITY_MEASURES)).toHaveLength(11)
  })

  it('builds the wave 2 sets with unique addresses', () => {
    const places = wave2PlaceSpecs()
    expect(places).toHaveLength(2 + 10 * 3)
    const fns = functionSpecs()
    expect(fns.filter((s) => s.measure === 'fnopen')).toHaveLength(12)
    expect(fns.filter((s) => s.measure === 'fnpay')).toHaveLength(13)
    const skills = skillSpecs()
    expect(skills.filter((s) => s.measure === 'aiskills')).toHaveLength(13)
    expect(skills.some((s) => s.measure === 'aicerts')).toBe(false)
    const all = [...wave1Specs(['TX']), ...places, ...fns, ...skills]
    expect(new Set(all.map((s) => s.slug)).size).toBe(all.length)
    expect(all.every((s) => ['places', 'functions', 'skills'].includes(s.group))).toBe(true)
  })
  it('ranks a job family\'s cities with the family counts and city total', () => {
    const op = functionSpecs().find((s) => s.slug === 'best-cities-for-operations-jobs')!
    const stats = Array.from({ length: 10 }, (_, i) => city('TX', `fc${i}`, 100 + i * 10, 0, { cityN: 1000, paid: 12, payMed: 90_000 }))
    const e = rankCities(op, stats, info, ctx, '2026-11', 'x', null)!
    expect(e.rows[0].name).toBe('Fc9')
    expect(e.rows[0].stats[0]).toEqual({ label: 'Share of the city\'s openings', value: '19%' })
  })
  it('ranks AI skills by their share of a family\'s openings, and needs enough openings', () => {
    const spec = skillSpecs().find((s) => s.slug === 'most-requested-ai-skills')!
    const totals: FnTotal[] = [{ fn: '*', n: 10_000, paid: 3000, payMed: 120_000 }]
    const stats: SkillStat[] = Array.from({ length: 8 }, (_, i) => ({ fn: '*', kind: 'skill' as const, key: `x${i}`, n: 100 + i * 50, paid: 40, payMed: 130_000 + i * 1000 }))
    const e = rankSkills(spec, stats, totals, '2026-11', 'x', null)!
    expect(e.rows[0].name).toBe('x7')
    expect(e.rows[0].valueLabel).toBe('4.5%')
    expect(e.placeNoun).toBe('skills')
    expect(rankSkills(spec, stats, [{ fn: '*', n: 100, paid: 0, payMed: null }], '2026-11', 'x', null)).toBeNull()
    const pay = skillSpecs().find((s) => s.measure === 'skillpay')!
    const p = rankSkills(pay, stats, totals, '2026-11', 'x', null)!
    expect(p.rows[0].name).toBe('x7')
    expect(p.rows[0].stats[2].value).toBe('+14%')
  })
})
