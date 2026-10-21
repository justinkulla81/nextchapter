import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { sumEffortMinutes } from './effort-minutes'

describe('sumEffortMinutes', () => {
  it('adds earned points across sprints', () => {
    expect(
      sumEffortMinutes([
        { committedActions: [{ points: 30, completed: true }, { points: 20, completed: false }] },
        { committedActions: [{ points: 10, completed: true, completionCount: 3 }] },
      ])
    ).toBe(60)
  })
  it('ignores malformed rows', () => {
    expect(sumEffortMinutes([{ committedActions: null }, { committedActions: [{}] }])).toBe(0)
  })

  it('does not count setup, connecting accounts or the welcome bonus as search effort', () => {
    expect(
      sumEffortMinutes([
        {
          committedActions: [
            { actionType: 'GMAIL_CONNECTED', points: 10, completed: true },
            { actionType: 'CALENDAR_CONNECTED', points: 10, completed: true },
            { actionType: 'PROFILE_CONFIRM', points: 5, completed: true },
            { actionType: 'SEARCH_STRATEGY_COMPLETE', points: 35, completed: true },
            { text: 'Completed your welcome & commitment', points: 5, completed: true, isGoalBonus: true },
          ],
        },
      ])
    ).toBe(0)
  })

  it('counts the work that gets a job, recurring actions by how many times they happened', () => {
    expect(
      sumEffortMinutes([
        {
          committedActions: [
            { actionType: 'OUTREACH_MESSAGE', points: 15, completed: true, completionCount: 4 },
            { actionType: 'JOB_APPLICATION_SUBMITTED', points: 25, completed: true },
            { actionType: 'OUTREACH_CALL', points: 30, completed: false },
          ],
        },
      ])
    ).toBe(15 * 4 + 25)
  })

  it('keeps counting a personalised task that has no action type', () => {
    expect(sumEffortMinutes([{ committedActions: [{ text: 'Pick three target roles', points: 15, completed: true }] }])).toBe(15)
  })

  it('counts only the work when setup and work are mixed in one week', () => {
    expect(
      sumEffortMinutes([
        {
          committedActions: [
            { actionType: 'GMAIL_CONNECTED', points: 10, completed: true },
            { actionType: 'ENGAGE_COMMENT', points: 5, completed: true, completionCount: 3 },
            { actionType: 'FOLLOW_UP_NOTE_SENT', points: 10, completed: true },
          ],
        },
      ])
    ).toBe(10)
  })
})
