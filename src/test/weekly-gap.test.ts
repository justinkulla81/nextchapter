import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
const getCurrentWeekSprint = vi.fn()
const computeWeeklyEngines = vi.fn()
vi.mock('@/lib/weekly/sprint', () => ({
  getCurrentWeekSprint: (...a: unknown[]) => getCurrentWeekSprint(...a),
  getMondayOfWeek: () => new Date('2026-10-19T00:00:00Z'),
}))
vi.mock('@/lib/scoring/dossier-competencies', () => ({ computeWeeklyEngines: (...a: unknown[]) => computeWeeklyEngines(...a) }))

import { computeWeeklyGap } from '@/lib/email/weekly-gap'

const base = { id: 'c1', privacyTier: 'STANDARD', confidentialSearchMode: false, weeklySprintCount: 3 } as never
const earlier = new Date('2026-10-01T00:00:00Z')

describe('computeWeeklyGap', () => {
  beforeEach(() => {
    getCurrentWeekSprint.mockReset().mockResolvedValue({ id: 's' })
    computeWeeklyEngines.mockReset().mockResolvedValue({ weeklyPoints: 40, weeklyPointsTarget: 100 })
  })

  it('reports the points to go when behind target', async () => {
    expect(await computeWeeklyGap({ ...(base as object), registrationCompletedAt: earlier } as never)).toEqual({
      weeklyPoints: 40, weeklyPointsTarget: 100, pointsToGo: 60,
    })
  })
  it('gives a member who registered this week a pass', async () => {
    expect(await computeWeeklyGap({ ...(base as object), registrationCompletedAt: new Date('2026-10-20T00:00:00Z') } as never)).toBeNull()
  })
  it('returns null with no sprint committed', async () => {
    getCurrentWeekSprint.mockResolvedValue(null)
    expect(await computeWeeklyGap({ ...(base as object), registrationCompletedAt: earlier } as never)).toBeNull()
  })
  it('returns null at or above target', async () => {
    computeWeeklyEngines.mockResolvedValue({ weeklyPoints: 100, weeklyPointsTarget: 100 })
    expect(await computeWeeklyGap({ ...(base as object), registrationCompletedAt: earlier } as never)).toBeNull()
  })
})
