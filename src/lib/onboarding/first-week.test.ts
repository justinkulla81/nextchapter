import { describe, expect, it } from 'vitest'
import { FIRST_WEEK, firstWeekStep } from './first-week'

const start = new Date('2026-10-01T12:00:00Z')
const at = (days: number) => new Date(start.getTime() + days * 86_400_000 + 1000)

describe('firstWeekStep', () => {
  it('is day one on the day of registration', () => {
    expect(firstWeekStep(start, at(0))?.day).toBe(1)
    expect(firstWeekStep(start, at(0))?.href).toBe('/dashboard/supporters')
  })
  it('walks one step a day through day seven', () => {
    FIRST_WEEK.forEach((s, i) => expect(firstWeekStep(start, at(i))?.day).toBe(s.day))
  })
  it('ends after the first week', () => {
    expect(firstWeekStep(start, at(7))).toBeNull()
  })
  it('does nothing without a registration date', () => {
    expect(firstWeekStep(null)).toBeNull()
  })
})
