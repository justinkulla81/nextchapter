import { payAfterLiving } from '@/lib/rankings/living-cost'
import { describe, expect, it } from 'vitest'
import { ALL_ROUND, CRITERIA, allRoundScore, buildMetroStats, criterionScores, eligible, principalCity, rankWhitePlaces, splitMetroName, totalWeight, weightedMedian, whitePlacesSpecs, type CountyFacts, type MetroStat, type WcCounts } from '@/lib/rankings/metro-places'
import { COUNTY_SECTORS } from '@/lib/workforce/county-context'

const sectors = COUNTY_SECTORS.map((s) => s.code)
const FIELDS = ['homicides', 'childCareCost', 'childCareCenters', 'reading', 'math', 'broadband', 'schoolFunding', 'libraries', 'parks', 'longCommute', 'permitUnits']

function county(i: number): CountyFacts {
  return { population: 300_000 + i * 50_000, laborForce: 150_000 + i * 20_000, whiteCollarShare: 0.4 + i * 0.01, wcUnemp: 2 + i * 0.1, colleges: 3 + i, enrollment: 10_000 + i * 1000, ajc: 1 + (i % 3), communityColleges: 1 + (i % 2), layoffWorkers: 100 * i }
}
function posting(i: number): WcCounts {
  return { n: 800 + i * 100, paid: 300 + i * 10, pay: [[90_000 + i * 2000, 300 + i * 10]], flex: 100 + i * 5, socN: 500, aiSum: 500 * (0.15 + i * 0.005) }
}

function fixture(count = 12) {
  const counties = new Map<string, CountyFacts>()
  const postings = new Map<string, WcCounts>()
  const ctx: Record<string, { e: number[]; t: [number, number] }> = {}
  const community: Record<string, (number | null)[]> = {}
  const metros = []
  for (let i = 0; i < count; i++) {
    const fips = String(10000 + i)
    counties.set(fips, county(i))
    postings.set(fips, posting(i))
    ctx[fips] = { e: sectors.flatMap((code, k) => [1000 + k * 100, 1000 + k * 100 + (code === '54' ? i * 50 + 50 : 0)]), t: [50_000, 51_000] }
    community[fips] = [3 + i * 0.2, 0.2, 7, 2.8, 2.9, 0.9, 1000 * i - 3000, 2, 0.6, 0.35, 1000 + i * 100]
    metros.push({ cbsa: String(20000 + i), name: `City${i}-Town${i}, ${i % 2 ? 'NC' : 'NY'}-SC Metro Area`, counties: [fips], rpp: 95 + i })
  }
  return { metros, counties, postings, context: { sectors, counties: ctx }, community: { fields: FIELDS, counties: community }, housing: () => ({ rent: 1500, home: 400_000 }) }
}

describe('best places for white-collar professionals', () => {
  it('weights the criteria to 100', () => {
    expect(totalWeight()).toBe(100)
    for (const c of CRITERIA) if (c.parts.length > 1) expect(c.parts.reduce((s, p) => s + p.weight, 0)).toBe(100)
    expect(new Set(CRITERIA.map((c) => c.slug)).size).toBe(CRITERIA.length)
  })

  it('splits metro names and finds the principal city', () => {
    expect(splitMetroName('Louisville/Jefferson County, KY-IN')).toEqual({ name: 'Louisville/Jefferson County', states: 'KY-IN', st: 'KY' })
    expect(principalCity('Raleigh-Cary')).toBe('Raleigh')
    expect(principalCity('Louisville/Jefferson County')).toBe('Louisville')
  })

  it('takes a weighted median', () => {
    expect(weightedMedian([[10, 1], [20, 1], [30, 10]])).toBe(30)
    expect(weightedMedian([])).toBeNull()
  })

  it('builds metro figures from county data', () => {
    const [m] = buildMetroStats(fixture(1))
    expect(m.name).toBe('City0-Town0')
    expect(m.states).toBe('NY-SC')
    expect(m.openingsPer1k).toBeCloseTo((800 / (150_000 * 0.4)) * 1000)
    expect(m.payAdj).toBeCloseTo(payAfterLiving(90_000, { rpp: 95, housingRpp: null, home: 400_000, rent: 1500, basis: 'metro' }) as number)
    expect(m.homeToPay).toBeCloseTo(400_000 / 90_000)
    expect(m.wcGrowth).toBeGreaterThan(0)
    expect(m.diversity).toBeGreaterThan(0.9)
    expect(m.permitsPer1k).toBeCloseTo((1000 / 300_000) * 1000)
  })

  it('scores every eligible metro and ranks lower-is-better lists from the lowest', () => {
    const stats = buildMetroStats(fixture())
    expect(stats.every(eligible)).toBe(true)
    const scores = criterionScores(stats)
    for (const m of stats) expect(allRoundScore(scores.get(m.cbsa) as Record<string, number | null>)).not.toBeNull()
    const safe = whitePlacesSpecs().find((s) => s.measure === 'wp_safe')!
    const ed = rankWhitePlaces(safe, stats, () => '/places/x', '2026-11', '2026-11-16T00:00:00Z', null)!
    expect(ed.rows[0].name).toBe('City0-Town0')
    expect(ed.partOf?.slug).toBe(ALL_ROUND.slug)
    expect(ed.placeNoun).toBe('metro areas')
  })

  it('links every criterion from the all-round list', () => {
    const stats = buildMetroStats(fixture())
    const all = whitePlacesSpecs().find((s) => s.slug === ALL_ROUND.slug)!
    const ed = rankWhitePlaces(all, stats, () => null, '2026-11', '2026-11-16T00:00:00Z', null)!
    expect(ed.components?.map((c) => c.slug)).toEqual(CRITERIA.map((c) => c.slug))
    expect(ed.rows.length).toBe(stats.length)
    expect(ed.rows[0].stats.length).toBe(6)
  })

  it('counts a missing criterion as the middle, not as a pass', () => {
    const full = Object.fromEntries(CRITERIA.map((c) => [c.id, 90]))
    const missingLayoffs = { ...full, wp_layoff: null }
    expect(allRoundScore(missingLayoffs) as number).toBeLessThan(allRoundScore(full) as number)
    expect(allRoundScore(Object.fromEntries(CRITERIA.map((c) => [c.id, c.weight >= 6 ? null : 90])))).toBeNull()
  })

  it('leaves out small metros', () => {
    const small: MetroStat = { ...buildMetroStats(fixture(1))[0], population: 100_000 }
    expect(eligible(small)).toBe(false)
  })
})
