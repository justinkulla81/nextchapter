import { describe, expect, it } from 'vitest'
import metroFile from '@/lib/workforce/data/metro-compare.json'
import type { CountyContextData } from '@/lib/workforce/county-context'
import {
  bucketSectors, compareRows, costDifferencePct, forLens, headlineKeys, isEmployedStatus, metroForCounty, metroUnemployment,
  parseMetros, parsePlaces, realValue, sectorTrend, shortMetroName, summarize, type MetroFacts, type MetroFile,
} from '@/lib/workforce/metro-compare'

const metros = parseMetros(metroFile as unknown as MetroFile)

const facts = (over: Partial<MetroFacts> = {}): MetroFacts => ({
  cbsa: '1', name: 'Here, KY', states: ['KY'],
  unemployment: { rate: 4.4, rateYearAgo: 4.1, laborForce: 100_000, period: '2026-08' },
  populationChangePct: 1, openRoles: 100, fieldRoles: 20, rolesPer10kWorkers: 10, fieldRolesPer10kWorkers: 2,
  sector: { labels: ['Finance & insurance'], jobs: 1000, changePct: 2 },
  rpp: { all: 100, goods: 100, housing: 100, utilities: 100, other: 100 },
  ...over,
})

describe('the metro file', () => {
  it('covers the metropolitan areas, each with counties and a price level', () => {
    expect(metros.length).toBeGreaterThan(380)
    for (const m of metros) {
      expect(m.counties.length).toBeGreaterThan(0)
      expect(m.counties.every((c) => /^\d{5}$/.test(c))).toBe(true)
      expect(m.rpp.all).toBeGreaterThan(50)
    }
  })
  it('puts a county in one metro only', () => {
    const seen = new Set<string>()
    for (const m of metros) for (const c of m.counties) {
      expect(seen.has(c)).toBe(false)
      seen.add(c)
    }
  })
  it('finds a metro from a county', () => {
    expect(metroForCounty(metros, '21111')?.name).toContain('Louisville')
    expect(metroForCounty(metros, null)).toBeNull()
    expect(metroForCounty(metros, '99999')).toBeNull()
  })
})

describe('metroUnemployment', () => {
  const rows = new Map([
    ['a', { fips: 'a', laborForce: 900, unemployed: 27, rateYearAgo: 3, period: '2026-08' }],
    ['b', { fips: 'b', laborForce: 100, unemployed: 10, rateYearAgo: 8, period: '2026-07' }],
  ])
  it('weights counties by labor force', () => {
    const u = metroUnemployment(['a', 'b'], rows)!
    expect(u.rate).toBe(3.7)
    expect(u.rateYearAgo).toBe(3.5)
    expect(u.laborForce).toBe(1000)
    expect(u.period).toBe('2026-08')
  })
  it('skips counties without figures and says nothing when none have them', () => {
    expect(metroUnemployment(['a', 'zzz'], rows)?.rate).toBe(3)
    expect(metroUnemployment(['zzz'], rows)).toBeNull()
  })
})

describe('cost of living', () => {
  it('values pay in the destination: 20% dearer is worth less', () => {
    expect(realValue(100_000, 100, 125)).toBe(80_000)
    expect(realValue(100_000, 125, 100)).toBe(125_000)
  })
  it('gives the percent difference', () => {
    expect(costDifferencePct(100, 112)).toBe(12)
    expect(costDifferencePct(100, 90)).toBe(-10)
  })
})

describe('compareRows', () => {
  const cur = facts()
  const byKey = (rows: ReturnType<typeof compareRows>, k: string) => rows.find((r) => r.key === k)!

  it('marks lower unemployment better and a rise worse, and small gaps the same', () => {
    const rows = (rate: number) => compareRows(facts({ unemployment: { rate, rateYearAgo: null, laborForce: 1, period: null } }), cur)
    expect(byKey(rows(3.5), 'unemployment').verdict).toBe('better')
    expect(byKey(rows(5.5), 'unemployment').verdict).toBe('worse')
    expect(byKey(rows(4.6), 'unemployment').verdict).toBe('same')
  })
  it('marks a dearer place worse and says what the same pay buys there', () => {
    const rows = compareRows(facts({ rpp: { all: 125, goods: 100, housing: 150, utilities: 100, other: 100 } }), cur, { salary: 100_000 })
    expect(byKey(rows, 'cost').verdict).toBe('worse')
    expect(byKey(rows, 'real-pay').value).toBe('$80,000')
    expect(byKey(rows, 'real-pay').verdict).toBe('worse')
  })
  it('gives values and no verdicts when the member has no known city', () => {
    const rows = compareRows(facts(), null)
    expect(rows.every((r) => r.verdict === null)).toBe(true)
    expect(rows.some((r) => r.key === 'real-pay')).toBe(false)
    expect(summarize(rows)).toMatch(/Add your city/)
  })
  it('leaves out the field row when the member has no field and the sector row when none maps', () => {
    const rows = compareRows(facts({ fieldRolesPer10kWorkers: null, sector: null }), cur)
    expect(rows.some((r) => r.key === 'field-roles' || r.key === 'sector')).toBe(false)
  })
  it('does not turn a missing figure into a verdict', () => {
    const rows = compareRows(facts({ unemployment: null, rolesPer10kWorkers: null }), cur)
    expect(byKey(rows, 'unemployment').value).toBeNull()
    expect(byKey(rows, 'unemployment').verdict).toBeNull()
    expect(byKey(rows, 'roles').verdict).toBeNull()
  })
})

describe('lens and headline', () => {
  const rows = compareRows(facts(), facts(), { salary: 100_000 })
  it('drops the job rows for life', () => {
    const life = forLens(rows, 'life').map((r) => r.key)
    expect(life).toEqual(expect.arrayContaining(['cost', 'housing', 'population', 'real-pay']))
    expect(life).not.toContain('unemployment')
    expect(life).not.toContain('roles')
  })
  it('leads with speed to a job for the out of work and with pay for the employed', () => {
    expect(headlineKeys(false)[0]).toBe('unemployment')
    expect(headlineKeys(true)[0]).toBe('real-pay')
    expect(isEmployedStatus('EMPLOYED_CONSIDERING_MOVE')).toBe(true)
    expect(isEmployedStatus('LAID_OFF')).toBe(false)
    expect(isEmployedStatus(null)).toBe(false)
  })
  it('summarizes only what was judged', () => {
    expect(summarize(rows)).toMatch(/About the same/)
  })
})

describe('sectors', () => {
  const data: CountyContextData = {
    sectors: ['52', '54'],
    counties: { a: { e: [100, 120, 50, 60] }, b: { e: [-1, 80, 10, 10] } },
  }
  it('adds the sectors up and leaves a suppressed county out of that sector, not as zero', () => {
    const t = sectorTrend(data, ['a', 'b'], ['52'])
    expect(t.jobs).toBe(120)
    expect(t.changePct).toBe(20)
    expect(sectorTrend(data, ['a', 'b'], ['52', '54']).jobs).toBe(190)
  })
  it('has no percent with nothing to compare', () => {
    expect(sectorTrend(data, ['zzz'], ['52']).changePct).toBeNull()
  })
  it('maps member industries to sectors and leaves government unmapped', () => {
    expect(bucketSectors('Insurance')).toEqual(['52'])
    expect(bucketSectors('Government & Public Sector')).toBeNull()
    expect(bucketSectors(null)).toBeNull()
  })
})

describe('places in the address', () => {
  it('keeps known metros, no repeats, at most three', () => {
    const codes = metros.slice(0, 5).map((m) => m.cbsa)
    expect(parsePlaces(`${codes[0]},${codes[0]},${codes[1]},99999,abc,${codes[2]},${codes[3]}`, metros)).toEqual(codes.slice(0, 3))
    expect(parsePlaces(null, metros)).toEqual([])
  })
  it('shortens a metro name to its first city and state', () => {
    expect(shortMetroName('Raleigh-Cary, NC')).toBe('Raleigh, NC')
    expect(shortMetroName('Louisville/Jefferson County, KY-IN')).toBe('Louisville, KY')
    expect(shortMetroName('New York-Newark-Jersey City, NY-NJ')).toBe('New York, NY')
  })
})
