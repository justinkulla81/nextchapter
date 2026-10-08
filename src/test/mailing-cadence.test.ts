import { describe, expect, it } from 'vitest'
import { periodFor, samePeriod } from '@/lib/mailing/cadence'

// 2026-10-07 is a Wednesday. 15:00Z is 11:00 in New York.
const wed = new Date('2026-10-07T15:00:00Z')
const sat = new Date('2026-10-10T15:00:00Z')

describe('mailing cadence periods', () => {
  it('keys each cadence by its period, in New York time', () => {
    expect(periodFor('DAILY', wed)).toEqual({ key: '2026-10-07', label: 'Wednesday, October 7' })
    expect(periodFor('WEEKDAYS', wed)?.key).toBe('2026-10-07')
    expect(periodFor('MONTHLY', wed)).toEqual({ key: '2026-10', label: 'October 2026' })
    expect(periodFor('QUARTERLY', wed)).toEqual({ key: '2026-Q4', label: 'Q4 2026' })
    expect(periodFor('ANNUALLY', wed)).toEqual({ key: '2026', label: '2026' })
  })
  it('never makes a period for ad hoc lists, or weekday lists at the weekend', () => {
    expect(periodFor('AD_HOC', wed)).toBeNull()
    expect(periodFor('WEEKDAYS', sat)).toBeNull()
    expect(periodFor('DAILY', sat)?.key).toBe('2026-10-10')
  })
  it('uses the New York date, not UTC, near midnight', () => {
    // 02:00Z on Oct 1 is still Sep 30 in New York.
    expect(periodFor('MONTHLY', new Date('2026-10-01T02:00:00Z'))?.key).toBe('2026-09')
    expect(periodFor('QUARTERLY', new Date('2026-10-01T02:00:00Z'))?.key).toBe('2026-Q3')
  })
  it('tells whether a hand-made draft already covers this period', () => {
    expect(samePeriod('MONTHLY', new Date('2026-10-02T15:00:00Z'), wed)).toBe(true)
    expect(samePeriod('MONTHLY', new Date('2026-09-28T15:00:00Z'), wed)).toBe(false)
    expect(samePeriod('WEEKDAYS', new Date('2026-10-07T12:00:00Z'), wed)).toBe(true)
    expect(samePeriod('AD_HOC', wed, wed)).toBe(false)
  })
})
