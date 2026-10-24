import { describe, expect, it } from 'vitest'
import { areaContext, jobsByCounty, type CountyContextData } from './county-context'

const sectors = ['51', '54', '62', '31-33']
const data: CountyContextData = {
  sectors,
  counties: {
    '1': { p: [100_000, 104_000], t: [50_000, 52_000], e: [1000, 900, 5000, 5200, 6000, 7000, 8000, 7000] },
    '2': { p: [50_000, 49_000], t: [20_000, 21_000], e: [-1, 100, 2000, 2100, 3000, 3300, 1000, 800] },
  },
}

describe('areaContext', () => {
  it('sums population over counties', () => {
    const c = areaContext(data, ['1', '2'])
    expect(c.population?.now).toBe(153_000)
    expect(c.population?.changePct).toBeCloseTo(2, 5)
  })
  it('shares AI-exposed jobs from every county that reports them', () => {
    const c = areaContext(data, ['1', '2'])
    // Info 900+100, Professional 5200+2100 = 8300 of 73,000 private jobs
    expect(c.exposed?.share).toBeCloseTo((8300 / 73_000) * 100, 5)
    expect(c.exposed?.top[0].label).toBe('Professional & technical')
  })
  it('leaves a suppressed county out of a sector\'s change, not counting it as zero', () => {
    const info = areaContext(data, ['1', '2']).shrinking.find((s) => s.code === '51')
    expect(info).toBeUndefined() // county 1 alone: -100 jobs, under the 300 floor
  })
  it('lists real losses and gains only', () => {
    const c = areaContext(data, ['1', '2'])
    expect(c.shrinking.map((s) => s.code)).toEqual(['31-33']) // -1,200 jobs, -13%
    expect(c.growing.map((s) => s.code)).toEqual(['62', '54']) // +1,300 jobs (+14%), then +300 (+4%)
  })
  it('reads shares from the latest year for a county that did not exist in the base year', () => {
    const ct: CountyContextData = { sectors: ['54', '62'], counties: { '09110': { p: [100, 110], t: [-1, 1000], e: [-1, 300, -1, 200] } } }
    const c = areaContext(ct, ['09110'])
    expect(c.exposed?.share).toBeCloseTo(30, 5)
    expect(c.growing).toEqual([])
    expect(c.shrinking).toEqual([])
  })
  it('returns empty for unknown counties', () => {
    const c = areaContext(data, ['9'])
    expect(c.population).toBeNull()
    expect(c.exposed).toBeNull()
  })
})

describe('jobsByCounty', () => {
  it('assigns each city to its county and skips unknown cities', () => {
    const m = jobsByCounty(
      [{ st: 'KY', city: 'Louisville', n: 10 }, { st: 'KY', city: 'Nowhere', n: 4 }, { st: 'KY', city: 'Louisville', n: 2 }],
      { 'KY|louisville': '21111' },
      (c) => [c.toLowerCase()],
    )
    expect(m.get('21111')).toBe(12)
    expect(m.size).toBe(1)
  })
})
