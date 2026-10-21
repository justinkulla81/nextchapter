import { describe, expect, it } from 'vitest'
import { POINT_ACTION_TYPES } from '@/lib/weekly/action-effort'
import { PROFILE_CHECKLIST_ACTION_TYPES } from '@/lib/weekly/profile-checklist-types'
import { COUNTS_AS_EFFORT, ENGAGEMENT_ACTION_TYPES, ENGAGEMENT_MINUTES_PER_WEEK_CAP, EXCLUDED_FROM_EFFORT, effortKind } from './effort-actions'

const LISTS = { EXCLUDED_FROM_EFFORT, ENGAGEMENT_ACTION_TYPES, COUNTS_AS_EFFORT }

describe('the three lists', () => {
  it('place every point-earning action type in exactly one list, so a new type has to be decided', () => {
    const unplaced = POINT_ACTION_TYPES.filter((t) => !Object.values(LISTS).some((list) => list.has(t)))
    expect(unplaced, `Add these to one of the lists in effort-actions.ts: ${unplaced.join(', ')}`).toEqual([])
  })

  it('never list a type in two places', () => {
    const twice = POINT_ACTION_TYPES.filter((t) => Object.values(LISTS).filter((list) => list.has(t)).length > 1)
    expect(twice).toEqual([])
  })

  it('only name types that exist, so a rename cannot leave a stale entry behind', () => {
    const known = new Set(POINT_ACTION_TYPES)
    const stale = Object.values(LISTS).flatMap((list) => [...list]).filter((t) => !known.has(t))
    expect(stale).toEqual([])
  })

  it('leave out every profile checklist item', () => {
    for (const type of PROFILE_CHECKLIST_ACTION_TYPES) expect(EXCLUDED_FROM_EFFORT.has(type), type).toBe(true)
  })

  it('keeps the weekly cap on engagement small', () => {
    expect(ENGAGEMENT_MINUTES_PER_WEEK_CAP).toBeGreaterThan(0)
    expect(ENGAGEMENT_MINUTES_PER_WEEK_CAP).toBeLessThanOrEqual(15)
  })
})

describe('effortKind', () => {
  it('counts the work that gets a job in full', () => {
    for (const actionType of ['OUTREACH_MESSAGE', 'OUTREACH_CALL', 'FOLLOW_UP_NOTE_SENT', 'JOB_APPLICATION_SUBMITTED', 'INTERVIEW_ATTENDED', 'REFERENCE_REQUESTED', 'LEARNING_MODULE', 'RESUME_UPDATE']) {
      expect(effortKind({ actionType }), actionType).toBe('work')
    }
  })

  it('gives light engagement in networking, jobs, fractional work, learning and showing up a little credit', () => {
    for (const actionType of ['LOGIN_VISIT', 'MOOD_CHECKIN', 'JOB_INTERESTED_REACTION', 'WATCHLIST_ADD', 'CONTACT_PRIORITIZED', 'ENGAGE_COMMENT', 'INTERIM_PROFILE_CREATED', 'VIDEO_WATCHED']) {
      expect(effortKind({ actionType }), actionType).toBe('engagement')
    }
  })

  it('does not count setup, connecting an account, or helping other members', () => {
    for (const actionType of ['PROFILE_CONFIRM', 'WORKING_STYLE_QUIZ', 'SEARCH_STRATEGY_COMPLETE', 'GMAIL_CONNECTED', 'CALENDAR_RECONNECTED', 'INTEL_HELPFUL', 'INSIDER_REQUEST_ANSWERED']) {
      expect(effortKind({ actionType }), actionType).toBe('none')
    }
  })

  it('does not count the welcome and commitment bonus', () => {
    expect(effortKind({ isGoalBonus: true })).toBe('none')
    expect(effortKind({ actionType: 'OUTREACH_MESSAGE', isGoalBonus: true })).toBe('none')
  })

  it('still counts a personalised task with no type, and a type it has never heard of, as work', () => {
    expect(effortKind({})).toBe('work')
    expect(effortKind({ actionType: 'SOME_FUTURE_OR_RETIRED_TYPE' })).toBe('work')
  })
})
