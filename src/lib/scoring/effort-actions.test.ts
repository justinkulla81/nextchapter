import { describe, expect, it } from 'vitest'
import { POINT_ACTION_TYPES } from '@/lib/weekly/action-effort'
import { PROFILE_CHECKLIST_ACTION_TYPES } from '@/lib/weekly/profile-checklist-types'
import { COUNTS_AS_EFFORT, EXCLUDED_FROM_EFFORT, countsAsSearchEffort } from './effort-actions'

describe('the two lists', () => {
  it('place every point-earning action type in exactly one list, so a new type has to be decided', () => {
    const unplaced = POINT_ACTION_TYPES.filter((t) => !EXCLUDED_FROM_EFFORT.has(t) && !COUNTS_AS_EFFORT.has(t))
    expect(unplaced, `Add these to COUNTS_AS_EFFORT or EXCLUDED_FROM_EFFORT in effort-actions.ts: ${unplaced.join(', ')}`).toEqual([])
  })

  it('never list a type on both sides', () => {
    const both = [...EXCLUDED_FROM_EFFORT].filter((t) => COUNTS_AS_EFFORT.has(t))
    expect(both).toEqual([])
  })

  it('only name types that exist, so a rename cannot leave a stale entry behind', () => {
    const known = new Set(POINT_ACTION_TYPES)
    const stale = [...EXCLUDED_FROM_EFFORT, ...COUNTS_AS_EFFORT].filter((t) => !known.has(t))
    expect(stale).toEqual([])
  })

  it('leave out every profile checklist item', () => {
    for (const type of PROFILE_CHECKLIST_ACTION_TYPES) expect(EXCLUDED_FROM_EFFORT.has(type), type).toBe(true)
  })
})

describe('countsAsSearchEffort', () => {
  it('counts the work that gets a job', () => {
    for (const actionType of ['OUTREACH_MESSAGE', 'OUTREACH_CALL', 'FOLLOW_UP_NOTE_SENT', 'JOB_APPLICATION_SUBMITTED', 'INTERVIEW_ATTENDED', 'REFERENCE_REQUESTED', 'LEARNING_MODULE', 'RESUME_UPDATE']) {
      expect(countsAsSearchEffort({ actionType }), actionType).toBe(true)
    }
  })

  it('does not count setup, connecting an account, check-ins, clicks or helping other members', () => {
    for (const actionType of ['PROFILE_CONFIRM', 'WORKING_STYLE_QUIZ', 'SEARCH_STRATEGY_COMPLETE', 'GMAIL_CONNECTED', 'CALENDAR_RECONNECTED', 'MOOD_CHECKIN', 'WATCHLIST_ADD', 'ENGAGE_COMMENT', 'INSIDER_REQUEST_ANSWERED']) {
      expect(countsAsSearchEffort({ actionType }), actionType).toBe(false)
    }
  })

  it('does not count the welcome and commitment bonus', () => {
    expect(countsAsSearchEffort({ isGoalBonus: true })).toBe(false)
    expect(countsAsSearchEffort({ actionType: 'OUTREACH_MESSAGE', isGoalBonus: true })).toBe(false)
  })

  it('still counts a personalised task with no type, and a type it has never heard of', () => {
    expect(countsAsSearchEffort({})).toBe(true)
    expect(countsAsSearchEffort({ actionType: 'SOME_FUTURE_OR_RETIRED_TYPE' })).toBe(true)
  })
})
