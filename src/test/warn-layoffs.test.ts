import { describe, it, expect } from 'vitest'
import { stateForMetro, parseTrackerDate, toWarnRows, type LayoffsFyiRow } from '@/lib/warn/layoffs'

const row = (over: Partial<LayoffsFyiRow> = {}): LayoffsFyiRow => ({
  company: 'Example Co', locationHq: 'New York City', employees: 120,
  date: '2026-09-02T00:00:00.000Z', industry: 'Finance', source: 'https://example.com',
  country: 'United States', stage: 'Post-IPO', ...over,
})

describe('stateForMetro', () => {
  it('maps the metros the tracker actually uses', () => {
    expect(stateForMetro('New York City')).toBe('NY')
    expect(stateForMetro('SF Bay Area')).toBe('CA')
    expect(stateForMetro('Seattle')).toBe('WA')
    expect(stateForMetro('Lehi')).toBe('UT')
  })

  it('drops non-US rows, which carry a Non-U.S. tag alongside the city', () => {
    expect(stateForMetro('Warsaw, Non-U.S.')).toBeNull()
    expect(stateForMetro('Non-U.S.')).toBeNull()
    expect(stateForMetro('Bengaluru, Non-U.S.')).toBeNull()
  })

  it('returns null rather than guessing at an unknown place', () => {
    expect(stateForMetro('Someplace Nobody Mapped')).toBeNull()
    expect(stateForMetro('')).toBeNull()
    expect(stateForMetro(null)).toBeNull()
  })
})

describe('parseTrackerDate', () => {
  it('reads both shapes the tracker emits', () => {
    expect(parseTrackerDate('9/2/2026')?.toISOString().slice(0, 10)).toBe('2026-09-02')
    expect(parseTrackerDate('2026-09-02T00:00:00.000Z')?.toISOString().slice(0, 10)).toBe('2026-09-02')
  })

  it('returns null on junk', () => {
    expect(parseTrackerDate('')).toBeNull()
    expect(parseTrackerDate('sometime')).toBeNull()
  })
})

describe('toWarnRows', () => {
  it('maps a US row onto the WARN shape', () => {
    const [r] = toWarnRows([row()])
    expect(r.state).toBe('NY')
    expect(r.employer).toBe('Example Co')
    expect(r.employees).toBe(120)
    expect(r.noticeDate?.toISOString().slice(0, 10)).toBe('2026-09-02')
    expect(r.industry).toBe('tech: Finance')
  })

  it('never invents an effective date', () => {
    // The tracker records when a layoff was reported, not when it takes
    // effect, and effective date is what decides outreach timing.
    expect(toWarnRows([row()])[0].effectiveDate).toBeNull()
  })

  it('drops rows it cannot place in a state', () => {
    expect(toWarnRows([row({ locationHq: 'Warsaw, Non-U.S.', country: 'Poland' })])).toHaveLength(0)
    expect(toWarnRows([row({ locationHq: null })])).toHaveLength(0)
  })

  it('keeps a row with no headcount, which simply will not promote', () => {
    const [r] = toWarnRows([row({ employees: null })])
    expect(r.employees).toBeNull()
  })

  it('skips a row with no company name', () => {
    expect(toWarnRows([row({ company: '   ' })])).toHaveLength(0)
  })
})
