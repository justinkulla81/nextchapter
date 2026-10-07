// The day streak counts consecutive days with real search activity.
import { describe, it, expect, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
import { streakFromActiveDays } from '@/lib/daily/activity-streak'

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime()

describe('streakFromActiveDays', () => {
  const now = new Date('2026-10-08T15:00:00Z')
  it('counts back from today when today is active', () => {
    expect(streakFromActiveDays(new Set([day('2026-10-08'), day('2026-10-07'), day('2026-10-06')]), now)).toBe(3)
  })
  it('keeps yesterday’s streak alive before today’s activity', () => {
    expect(streakFromActiveDays(new Set([day('2026-10-07'), day('2026-10-06')]), now)).toBe(2)
  })
  it('a missed day ends it', () => {
    expect(streakFromActiveDays(new Set([day('2026-10-08'), day('2026-10-06'), day('2026-10-05')]), now)).toBe(1)
    expect(streakFromActiveDays(new Set([day('2026-10-05')]), now)).toBe(0)
  })
})
