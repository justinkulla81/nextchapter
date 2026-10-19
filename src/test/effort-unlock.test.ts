import { describe, expect, it } from 'vitest'
import { UNLOCK_BAR, unlockStatus } from '@/lib/effort/unlock'

const DAY = 86_400_000
const now = new Date('2026-10-30T12:00:00Z')
const ago = (days: number) => new Date(now.getTime() - days * DAY)

describe('the strategy unlock bar', () => {
  it('is one bar: 180 minutes of search effort and fourteen days', () => {
    expect(UNLOCK_BAR).toEqual({ minutes: 180, minDays: 14 })
  })
})

describe('unlockStatus', () => {
  it('unlocks when the minutes and the days are both there', () => {
    const st = unlockStatus(180, { cycleStartedAt: ago(14), now })
    expect(st.unlocked).toBe(true)
    expect(st.blockers).toEqual([])
  })

  it('says how many minutes are short', () => {
    const st = unlockStatus(120, { cycleStartedAt: ago(20), now })
    expect(st.unlocked).toBe(false)
    expect(st.minutesLeft).toBe(60)
    expect(st.blockers).toEqual(['60 more minutes of search effort'])
  })

  it('holds the unlock until enough days have passed, and says how many', () => {
    const st = unlockStatus(400, { cycleStartedAt: ago(5), now })
    expect(st.unlocked).toBe(false)
    expect(st.daysLeft).toBe(9)
    expect(st.blockers.join(' ')).toMatch(/9 more days/)
  })

  it('lists both blockers when both are open, and uses the singular for one', () => {
    const st = unlockStatus(179, { cycleStartedAt: ago(13), now })
    expect(st.blockers[0]).toBe('1 more minute of search effort')
    expect(st.blockers[1]).toMatch(/^1 more day,/)
  })

  it('never counts negative or fractional minutes', () => {
    expect(unlockStatus(-5, { cycleStartedAt: ago(30), now }).minutes).toBe(0)
    expect(unlockStatus(12.6, { cycleStartedAt: ago(30), now }).minutes).toBe(13)
  })
})
