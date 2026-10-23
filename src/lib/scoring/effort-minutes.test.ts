import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { sumEffortMinutes } from './effort-minutes'
import { ENGAGEMENT_MINUTES_PER_WEEK_CAP } from './effort-actions'

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
            { actionType: 'INSIDER_REQUEST_ANSWERED', points: 40, completed: true },
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

  it('gives showing up and light engagement a little credit', () => {
    expect(
      sumEffortMinutes([
        {
          committedActions: [
            { actionType: 'LOGIN_VISIT', points: 2, completed: true },
            { actionType: 'JOB_INTERESTED_REACTION', points: 2, completed: true, completionCount: 2 },
          ],
        },
      ])
    ).toBe(2 + 4)
  })

  it('caps engagement in a week so it can never stand in for work', () => {
    const busyWeek = {
      committedActions: [
        { actionType: 'ENGAGE_EVENT', points: 30, completed: true },
        { actionType: 'VIDEO_WATCHED', points: 3, completed: true, completionCount: 20 },
        { actionType: 'WATCHLIST_ADD', points: 2, completed: true, completionCount: 30 },
      ],
    }
    expect(sumEffortMinutes([busyWeek])).toBe(ENGAGEMENT_MINUTES_PER_WEEK_CAP)
    // The cap is per weekly sprint, not for a lifetime.
    expect(sumEffortMinutes([busyWeek, busyWeek])).toBe(2 * ENGAGEMENT_MINUTES_PER_WEEK_CAP)
  })

  it('does not let the cap touch real work done the same week', () => {
    expect(
      sumEffortMinutes([
        {
          committedActions: [
            { actionType: 'ENGAGE_EVENT', points: 30, completed: true },
            { actionType: 'OUTREACH_MESSAGE', points: 15, completed: true, completionCount: 3 },
            { actionType: 'GMAIL_CONNECTED', points: 10, completed: true },
          ],
        },
      ])
    ).toBe(ENGAGEMENT_MINUTES_PER_WEEK_CAP + 15 * 3)
  })
})
