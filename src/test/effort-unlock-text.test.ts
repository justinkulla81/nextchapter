import { describe, expect, it } from 'vitest'
import { unlockStatus } from '@/lib/effort/unlock'
import { unlockProgressText } from '@/lib/effort/unlock-text'

const DAY = 86_400_000
const now = new Date('2026-10-30T12:00:00Z')
const ago = (days: number) => new Date(now.getTime() - days * DAY)
const text = (minutes: number, days: number) => unlockProgressText(unlockStatus(minutes, { cycleStartedAt: ago(days), now }))
const all = (t: ReturnType<typeof text>) => `${t.headline} ${t.detail}`

describe('unlockProgressText', () => {
  it('reads as progress with the plain rule', () => {
    const t = text(108, 20)
    expect(t.headline).toBe('You are 60% of the way to your next strategy')
    expect(t.detail).toContain('72 more minutes of real search work')
    expect(t.detail).toContain('1 point = 1 minute of real search work')
    expect(t.pct).toBe(60)
  })

  it('caps at 99 until both conditions are met, then 100', () => {
    expect(text(10_000, 1).pct).toBeLessThanOrEqual(99)
    expect(text(179, 30).pct).toBe(99)
    const ready = text(180, 14)
    expect(ready.pct).toBe(100)
    expect(ready.ready).toBe(true)
    expect(ready.headline).toBe('Your next strategy is ready')
  })

  it('shows a date, not days left, when only the wait remains', () => {
    const t = text(400, 5)
    expect(t.detail).toContain('Sunday, November 8')
    expect(t.detail).toContain('so the new read has fresh evidence to use')
    expect(t.detail).not.toMatch(/days? (left|more)/)
    expect(t.pct).toBeLessThan(100)
  })

  it('uses the singular for one minute', () => {
    expect(text(179, 30).detail).toContain('1 more minute of real')
  })

  it('never reads as a lock or a wall', () => {
    for (const [m, d] of [[0, 0], [60, 3], [120, 20], [400, 5], [179, 13], [180, 14]] as const) {
      expect(all(text(m, d))).not.toMatch(/lock|block|unlock|not yet|stand/i)
    }
  })
})
