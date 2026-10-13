import { describe, expect, it } from 'vitest'
import { comparePivot, customerServiceNote, exposureBand, trendSignal, trendsForFunction } from '@/lib/market/occupation-trends'

describe('occupation trends', () => {
  it('bands exposure and employment signals', () => {
    expect(exposureBand(75.3)).toBe('HIGH')
    expect(exposureBand(37)).toBe('MEDIUM')
    expect(exposureBand(12)).toBe('LOW')
    expect(trendSignal(12.4)).toBe('GROWING')
    expect(trendSignal(2)).toBe('FLAT')
    expect(trendSignal(-4)).toBe('SHRINKING')
  })
  it('maps a function to occupation groups and returns nothing for General', () => {
    expect(trendsForFunction('Engineering').map((t) => t.socGroup)).toEqual(['15', '17'])
    expect(trendsForFunction('General')).toEqual([])
    expect(trendsForFunction(null)).toEqual([])
  })
  it('compares current and target functions in plain words', () => {
    const c = comparePivot('Administration', 'Data & Analytics')
    expect(c.readout).toContain('Computer & math')
    expect(c.readout).toContain('Office & admin support')
  })
  it('says nothing when either side is unmapped', () => {
    expect(comparePivot('Operations', 'Other').readout).toBeNull()
  })
  it('adds the customer service note only for customer success', () => {
    expect(customerServiceNote('Customer Success')).toContain('fell about 7.8%')
    expect(customerServiceNote('Finance')).toBeNull()
  })
})
