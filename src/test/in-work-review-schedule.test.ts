import { describe, it, expect } from 'vitest'
import {
  buildCyclesForYear,
  decideOutreach,
  monthsForCadence,
  nextCycle,
  lastCycle,
  type ReviewScheduleInput,
  type SentRecord,
} from '@/lib/in-work/review-schedule'

const D = (s: string) => new Date(`${s}T00:00:00.000Z`)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const defaults: ReviewScheduleInput = { cadence: 'HALF_YEARLY', anchorMonth: null, nextReviewDate: null }

describe('monthsForCadence', () => {
  it('defaults to February and August', () => {
    expect(monthsForCadence('HALF_YEARLY', null)).toEqual([2, 8])
  })
  it('wraps half-yearly from a late anchor', () => {
    expect(monthsForCadence('HALF_YEARLY', 10)).toEqual([4, 10])
  })
  it('annual is one month, quarterly is four', () => {
    expect(monthsForCadence('ANNUAL', 5)).toEqual([5])
    expect(monthsForCadence('QUARTERLY', 1)).toEqual([1, 4, 7, 10])
  })
  it('ignores an invalid anchor', () => {
    expect(monthsForCadence('HALF_YEARLY', 13)).toEqual([2, 8])
  })
})

describe('buildCyclesForYear', () => {
  it('default windows put PREPARE on Jan 25 and Jul 25', () => {
    const cycles = buildCyclesForYear(defaults, 2027)
    expect(cycles.map((c) => c.key)).toEqual(['2027-02', '2027-08'])
    expect(iso(cycles[0].prepareOn)).toBe('2027-01-25')
    expect(iso(cycles[1].prepareOn)).toBe('2027-07-25')
    expect(iso(cycles[0].windowEnd)).toBe('2027-02-28')
    expect(iso(cycles[0].respondOn)).toBe('2027-03-05')
  })
  it('uses the leap-year end of February', () => {
    const c = buildCyclesForYear(defaults, 2028)[0]
    expect(iso(c.windowEnd)).toBe('2028-02-29')
  })
  it('an exact date replaces the month window for that month', () => {
    const c = buildCyclesForYear({ ...defaults, nextReviewDate: D('2027-02-10') }, 2027)
    const feb = c.find((x) => x.key === '2027-02')!
    expect(feb.exact).toBe(true)
    expect(iso(feb.prepareOn)).toBe('2027-01-20')
    expect(iso(feb.respondOn)).toBe('2027-02-15')
    expect(c).toHaveLength(2)
  })
})

describe('nextCycle / lastCycle', () => {
  it('finds the window in progress as the next cycle', () => {
    expect(nextCycle(defaults, D('2027-02-20'))?.key).toBe('2027-02')
  })
  it('rolls to the following half after the window ends', () => {
    expect(nextCycle(defaults, D('2027-03-01'))?.key).toBe('2027-08')
    expect(lastCycle(defaults, D('2027-03-01'))?.key).toBe('2027-02')
  })
  it('crosses the year boundary', () => {
    const input: ReviewScheduleInput = { cadence: 'ANNUAL', anchorMonth: 12, nextReviewDate: null }
    expect(nextCycle(input, D('2027-01-10'))?.key).toBe('2027-12')
    expect(lastCycle(input, D('2027-01-10'))?.key).toBe('2026-12')
  })
})

describe('decideOutreach', () => {
  it('does nothing in a quiet week', () => {
    expect(decideOutreach(defaults, D('2027-04-10'), [])).toBeNull()
  })
  it('sends PREPARE on the default late-January date', () => {
    const d = decideOutreach(defaults, D('2027-01-25'), [])
    expect(d?.kind).toBe('PREPARE')
    expect(d?.cycle.key).toBe('2027-02')
  })
  it('still offers PREPARE a few days late, but not inside the last week', () => {
    expect(decideOutreach(defaults, D('2027-02-02'), [])?.kind).toBe('PREPARE')
    expect(decideOutreach(defaults, D('2027-02-08'), [])).toBeNull()
  })
  it('does not repeat a PREPARE already sent for the cycle', () => {
    const sent: SentRecord[] = [{ cycleKey: '2027-02', kind: 'PREPARE', sentAt: D('2027-01-25') }]
    expect(decideOutreach(defaults, D('2027-01-26'), sent)).toBeNull()
  })
  it('sends RESPOND five to seven days after the window and not before or after', () => {
    expect(decideOutreach(defaults, D('2027-03-04'), [])).toBeNull()
    expect(decideOutreach(defaults, D('2027-03-05'), [])?.kind).toBe('RESPOND')
    expect(decideOutreach(defaults, D('2027-03-07'), [])?.kind).toBe('RESPOND')
    expect(decideOutreach(defaults, D('2027-03-08'), [])).toBeNull()
  })
  it('skips RESPOND when the outcome is already logged', () => {
    expect(decideOutreach(defaults, D('2027-03-05'), [], new Set(['2027-02']))).toBeNull()
  })
  it('blocks the same kind within the cooldown even for a new cycle key', () => {
    // Member moved their date: new cycle key, but a PREPARE went out 10 days ago.
    const moved: ReviewScheduleInput = { ...defaults, nextReviewDate: D('2027-02-25') }
    const sent: SentRecord[] = [{ cycleKey: '2027-02-old', kind: 'PREPARE', sentAt: D('2027-01-25') }]
    expect(decideOutreach(moved, D('2027-02-04'), sent)).toBeNull()
  })
  it('RESPOND crosses into the new year for a December review', () => {
    const input: ReviewScheduleInput = { cadence: 'ANNUAL', anchorMonth: 12, nextReviewDate: null }
    expect(decideOutreach(input, D('2027-01-05'), [])?.kind).toBe('RESPOND')
  })
})
