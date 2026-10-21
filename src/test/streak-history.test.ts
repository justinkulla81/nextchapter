import { describe, it, expect } from 'vitest'
import { firstStreakReachedAt } from '@/lib/scoring/streak-history'
import { meetsCandidatePlusRequirements, resolveCandidatePlus } from '@/lib/scoring/dossier-unlock'

const week = (i: number, done: number, of = 3) => ({
  weekStartDate: new Date(Date.UTC(2026, 6, 6) + i * 7 * 86_400_000),
  committedActions: Array.from({ length: of }, (_, k) => ({ completed: k < done })),
})

describe('firstStreakReachedAt', () => {
  it('finds the week a 6-week streak was first reached, even if it later lapsed', () => {
    const sprints = [0, 1, 2, 3, 4, 5].map((i) => week(i, 1)).concat([week(6, 0), week(7, 0)])
    expect(firstStreakReachedAt(sprints, 6)).toEqual(new Date(Date.UTC(2026, 6, 6) + 6 * 7 * 86_400_000))
  })
  it('needs back-to-back weeks that each met the goal', () => {
    expect(firstStreakReachedAt([0, 1, 2, 4, 5, 6].map((i) => week(i, 2)), 6)).toBeNull()
    expect(firstStreakReachedAt([0, 1, 2, 3, 4, 5].map((i) => week(i, i === 3 ? 0 : 2)), 6)).toBeNull()
  })
})

describe('resolveCandidatePlus', () => {
  const base = { requirementsMet: false, streakMet: false, unlockedAt: null, revokedAt: null }
  it('records the first unlock and its path', () => {
    expect(resolveCandidatePlus({ ...base, streakMet: true })).toEqual({ unlocked: true, record: 'streak' })
    expect(resolveCandidatePlus({ ...base, requirementsMet: true, streakMet: true })).toEqual({ unlocked: true, record: 'requirements' })
  })
  it('stays on once recorded, after the streak lapses', () => {
    expect(resolveCandidatePlus({ ...base, unlockedAt: new Date() })).toEqual({ unlocked: true, record: null })
  })
  it('only an admin revoke turns it off', () => {
    expect(resolveCandidatePlus({ ...base, requirementsMet: true, unlockedAt: new Date(), revokedAt: new Date() })).toEqual({ unlocked: false, record: null })
  })
})

describe('meetsCandidatePlusRequirements', () => {
  it('needs outreach + applications, minutes and an assessment — no references', () => {
    expect(meetsCandidatePlusRequirements({ evidenceMet: true, effortMet: true, minutesMet: true })).toBe(true)
    expect(meetsCandidatePlusRequirements({ evidenceMet: false, effortMet: true, minutesMet: true })).toBe(false)
    expect(meetsCandidatePlusRequirements({ evidenceMet: true, effortMet: false, minutesMet: true })).toBe(false)
    expect(meetsCandidatePlusRequirements({ evidenceMet: true, effortMet: true, minutesMet: false })).toBe(false)
  })
})
