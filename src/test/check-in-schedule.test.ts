// The app-open check-in shows a few times a week, never two days running,
// and rotates between the mood question and real-activity commitments.
import { describe, it, expect } from 'vitest'
import { isPromptDue, applicationsToAsk, chooseCheckInKind, weekdaysLeft } from '@/lib/daily/check-in-schedule'

const at = (iso: string) => new Date(iso)

describe('isPromptDue', () => {
  const now = at('2026-10-08T15:00:00Z') // Thursday
  it('due with no history', () => expect(isPromptDue([], now)).toBe(true))
  it('not again the same day', () => expect(isPromptDue([at('2026-10-08T09:00:00Z')], now)).toBe(false))
  it('not two days running', () => expect(isPromptDue([at('2026-10-07T20:00:00Z')], now)).toBe(false))
  it('due after a day off', () => expect(isPromptDue([at('2026-10-06T12:00:00Z')], now)).toBe(true))
  it('at most 3 in 7 days', () =>
    expect(isPromptDue([at('2026-10-06T12:00:00Z'), at('2026-10-04T12:00:00Z'), at('2026-10-02T12:00:00Z')], now)).toBe(false))
  it('older showings stop counting', () =>
    expect(isPromptDue([at('2026-10-06T12:00:00Z'), at('2026-10-04T12:00:00Z'), at('2026-09-30T12:00:00Z')], now)).toBe(true))
})

describe('applicationsToAsk', () => {
  it('spreads the rest of the goal over the weekdays left', () => {
    expect(weekdaysLeft(at('2026-10-05T12:00:00Z'))).toBe(5) // Monday
    expect(applicationsToAsk(0, 15, at('2026-10-05T12:00:00Z'))).toBe(3)
    expect(applicationsToAsk(4, 15, at('2026-10-08T12:00:00Z'))).toBe(5) // Thu: 11 left / 2 days → 6, capped at 5
  })
  it('asks for at least 1, even past the goal or on a weekend', () => {
    expect(applicationsToAsk(20, 15, at('2026-10-06T12:00:00Z'))).toBe(1)
    expect(applicationsToAsk(14, 15, at('2026-10-10T12:00:00Z'))).toBe(1) // Saturday
  })
})

describe('chooseCheckInKind', () => {
  it('asks about applications when behind and never asked', () => {
    expect(chooseCheckInKind({ appliedThisWeek: 2, weeklyGoal: 15, checkedInThisWeek: true, lastShownByKind: {} })).toBe('APPLY_COMMIT')
  })
  it('rotates to the kind asked least recently', () => {
    expect(chooseCheckInKind({
      appliedThisWeek: 2, weeklyGoal: 15, checkedInThisWeek: false,
      lastShownByKind: { APPLY_COMMIT: at('2026-10-06T12:00:00Z'), NETWORK_COMMIT: at('2026-10-04T12:00:00Z'), MOOD: at('2026-10-02T12:00:00Z') },
    })).toBe('MOOD')
  })
  it('skips applications once the goal is met, and mood once checked in', () => {
    expect(chooseCheckInKind({ appliedThisWeek: 15, weeklyGoal: 15, checkedInThisWeek: true, lastShownByKind: {} })).toBe('NETWORK_COMMIT')
  })
})
