import { describe, expect, it } from 'vitest'
import { aboutCount, isNetworkCompany, networkTitle, primaryState, totalWorkers } from '@/lib/network/eligibility'

const NOW = new Date('2026-10-23T12:00:00Z').getTime()
const day = (iso: string) => new Date(`${iso}T00:00:00Z`)

describe('isNetworkCompany', () => {
  it('needs a notice in the last two years and at least 100 named workers', () => {
    expect(isNetworkCompany({ latest: day('2026-09-01'), notices: [{ workers: 100 }] }, NOW)).toBe(true)
    expect(isNetworkCompany({ latest: day('2026-09-01'), notices: [{ workers: 60 }, { workers: 39 }] }, NOW)).toBe(false)
    expect(isNetworkCompany({ latest: day('2024-10-01'), notices: [{ workers: 500 }] }, NOW)).toBe(false)
  })
  it('counts missing worker numbers as zero', () => {
    expect(totalWorkers({ latest: day('2026-09-01'), notices: [{ workers: null }, { workers: 40 }] })).toBe(40)
  })
})

describe('primaryState', () => {
  it('picks the state with the most named workers, then the most notices, then the code', () => {
    expect(primaryState([{ state: 'CA', workers: 50 }, { state: 'WA', workers: 200 }])).toBe('WA')
    expect(primaryState([{ state: 'CA', workers: 100 }, { state: 'CA', workers: 0 }, { state: 'WA', workers: 100 }])).toBe('CA')
    expect(primaryState([{ state: 'WA', workers: null }, { state: 'CA', workers: null }])).toBe('CA')
  })
})

describe('copy helpers', () => {
  it('keeps titles short', () => {
    expect(networkTitle('Netflix')).toBe('Netflix Laid-Off Workers: Jobs and Benefits')
    expect(networkTitle('The Very Long Name Of A Holding Company Inc')).toBe('The Very Long Name Of A Holding Company Inc Laid-Off Workers')
    expect(networkTitle('Netflix')).not.toMatch(/layoffs/i)
  })
  it('never states a false precision', () => {
    expect(aboutCount(1200)).toBe('about 1,200')
  })
})
