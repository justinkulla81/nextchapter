import { describe, expect, it } from 'vitest'
import { isoWeek, nextWeek, parseWeekId, prevWeek, weekId, weekLabel, weekStart } from '@/lib/layoffs/weeks'

describe('layoff weeks', () => {
  it('starts weeks on Monday in UTC', () => {
    expect(weekStart(new Date('2026-10-28T15:00:00Z')).toISOString()).toBe('2026-10-26T00:00:00.000Z')
    expect(weekStart(new Date('2026-11-01T23:59:00Z')).toISOString()).toBe('2026-10-26T00:00:00.000Z')
    expect(weekStart(new Date('2026-10-26T00:00:00Z')).toISOString()).toBe('2026-10-26T00:00:00.000Z')
  })
  it('numbers ISO weeks, including year edges', () => {
    expect(weekId(new Date('2026-10-26T00:00:00Z'))).toBe('2026-w44')
    expect(isoWeek(new Date('2024-12-30T00:00:00Z'))).toEqual({ year: 2025, week: 1 })
    expect(weekId(new Date('2027-01-04T00:00:00Z'))).toBe('2027-w01')
    expect(weekId(new Date('2026-12-28T00:00:00Z'))).toBe('2026-w53')
  })
  it('round-trips an id and rejects bad ones', () => {
    for (const id of ['2026-w44', '2026-w01', '2026-w53', '2025-w01']) expect(weekId(parseWeekId(id)!), id).toBe(id)
    expect(parseWeekId('2026-w54')).toBeNull()
    expect(parseWeekId('2025-w53')).toBeNull()
    expect(parseWeekId('2026-44')).toBeNull()
    expect(parseWeekId('abc')).toBeNull()
  })
  it('moves a week at a time and labels it', () => {
    const m = parseWeekId('2026-w44')!
    expect(weekId(prevWeek(m))).toBe('2026-w43')
    expect(weekId(nextWeek(m))).toBe('2026-w45')
    expect(weekLabel(m)).toBe('Oct 26 to Nov 1, 2026')
  })
})
