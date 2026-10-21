import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/journey/apply', () => ({ applyJourneyChange: vi.fn() }))
import { nextWinBackStep, winBackContent } from '@/lib/winback/sequence'

const day = 86_400_000
const now = new Date('2026-10-14T12:00:00Z')
const ago = (d: number) => new Date(now.getTime() - d * day)

describe('win-back steps', () => {
  it('waits until 21 days quiet', () => {
    expect(nextWinBackStep(ago(20), 0, now)).toBeNull()
    expect(nextWinBackStep(ago(21), 0, now)).toBe(1)
  })
  it('goes out in order and once each', () => {
    expect(nextWinBackStep(ago(30), 1, now)).toBeNull()
    expect(nextWinBackStep(ago(42), 1, now)).toBe(2)
    expect(nextWinBackStep(ago(63), 2, now)).toBe(3)
  })
  it('stops after three', () => {
    expect(nextWinBackStep(ago(200), 3, now)).toBeNull()
  })
  it('has a different message and a single call to action per step', () => {
    const subjects = [1, 2, 3].map((s) => winBackContent(s as 1 | 2 | 3, 'Sam', 'LAID_OFF').subject)
    expect(new Set(subjects).size).toBe(3)
    expect(winBackContent(3, null, 'GROWING').closing).toMatch(/Turn off/)
  })
})

describe('landed to managing your career', () => {
  it('is due exactly 90 days after landing', async () => {
    const { landedCutoff } = await import('@/lib/journey/auto-advance')
    const cutoff = landedCutoff(now)
    expect(new Date(now.getTime() - 90 * day).getTime()).toBe(cutoff.getTime())
    expect(ago(91) <= cutoff).toBe(true)
    expect(ago(89) <= cutoff).toBe(false)
  })
})
