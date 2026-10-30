import { describe, expect, it } from 'vitest'
import { easternToUtc, byGroup, byHour, byWeek, byWeekday, easternParts, lastWeeks, quotaProgress, weekStart, type Touch } from './touch-stats'
import { isPersonalOnly, personGroupOf } from './person-groups'

const touch = (over: Omit<Partial<Touch>, 'at'> & { at: string }): Touch => ({
  channel: 'email', mode: 'automated', source: 'Cold outreach', group: 'employer_buyer', personId: 'p1',
  responded: false, positive: false, hasTime: true, ...over, at: new Date(over.at),
})

describe('eastern time', () => {
  it('reads the Eastern hour and weekday, with daylight saving', () => {
    // 2026-10-29 is a Thursday, EDT (UTC-4): 14:30Z is 10:30 in New York.
    expect(easternParts(new Date('2026-10-29T14:30:00Z'))).toEqual({ date: '2026-10-29', hour: 10, weekday: 3 })
    // After the change back (2026-11-01), EST is UTC-5.
    expect(easternParts(new Date('2026-11-02T14:30:00Z'))).toEqual({ date: '2026-11-02', hour: 9, weekday: 0 })
  })
  it('puts late Sunday evening Eastern in that Sunday’s week, not the next', () => {
    expect(weekStart(new Date('2026-11-02T03:30:00Z'))).toBe('2026-10-26') // Sunday 11/1 22:30 ET
    expect(weekStart(new Date('2026-11-02T05:30:00Z'))).toBe('2026-11-02') // Monday 00:30 ET
  })
  it('turns an Eastern date and time back into an instant', () => {
    expect(easternToUtc('2026-10-29', '10:30')?.toISOString()).toBe('2026-10-29T14:30:00.000Z')
    expect(easternToUtc('2026-11-02', '09:30')?.toISOString()).toBe('2026-11-02T14:30:00.000Z')
    expect(easternToUtc('2026-10-29', '25:00')).toBeNull()
  })
  it('lists weeks oldest first ending with the current one', () => {
    expect(lastWeeks(new Date('2026-10-29T15:00:00Z'), 3)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26'])
  })
})

describe('rollups', () => {
  const touches = [
    touch({ at: '2026-10-27T15:00:00Z', responded: true, positive: true }),
    touch({ at: '2026-10-27T15:10:00Z', mode: 'manual', source: 'Composed in CRM', group: 'recruiter' }),
    touch({ at: '2026-10-28T18:00:00Z', channel: 'call', mode: 'manual', source: 'Phone call', group: 'recruiter', responded: true }),
    touch({ at: '2026-10-28T16:00:00Z', channel: 'call', mode: 'manual', source: 'Phone call', group: 'recruiter', hasTime: false }),
    touch({ at: '2026-10-20T15:00:00Z', channel: 'linkedin', mode: 'manual', source: 'LinkedIn', group: 'candidate' }),
  ]
  it('counts weeks by kind and response', () => {
    const rows = byWeek(touches, ['2026-10-19', '2026-10-26'])
    expect(rows[1]).toMatchObject({ automatedEmail: 1, manualEmail: 1, calls: 2, total: 4, responded: 2 })
    expect(rows[0]).toMatchObject({ linkedinText: 1, total: 1 })
  })
  it('counts by person group', () => {
    const r = byGroup(touches).find((x) => x.group === 'recruiter')!
    expect(r).toMatchObject({ manualEmail: 1, calls: 2 })
    expect(r.all).toEqual({ sent: 3, responded: 1, positive: 0 })
  })
  it('leaves touches with no known time out of the hour chart only', () => {
    const hours = byHour(touches)
    expect(hours.reduce((n, h) => n + h.sent, 0)).toBe(4)
    expect(hours[11].sent).toBe(3) // 15:00Z = 11:00 EDT: the two emails and the LinkedIn message
    expect(hours[14].sent).toBe(1) // the call at 18:00Z; the date-only call at 16:00Z is left out
    expect(byWeekday(touches).reduce((n, h) => n + h.sent, 0)).toBe(5)
  })
})

describe('quotas', () => {
  const touches = [
    touch({ at: '2026-10-13T15:00:00Z' }), touch({ at: '2026-10-14T15:00:00Z' }), // week of 10/12: 2
    touch({ at: '2026-10-20T15:00:00Z' }), // week of 10/19: 1
    touch({ at: '2026-10-27T15:00:00Z' }), touch({ at: '2026-10-28T15:00:00Z', channel: 'call', mode: 'manual' }), // current week
  ]
  const weeks = ['2026-10-12', '2026-10-19', '2026-10-26']
  it('measures a quota across all touches and counts only finished weeks as hit or missed', () => {
    const [p] = quotaProgress(touches, [{ groupKey: 'ALL', channel: 'ALL', weeklyTarget: 2 }], weeks)
    expect(p).toMatchObject({ thisWeek: 2, history: [2, 1, 2], weeksHit: 1, weeksShown: 2 })
  })
  it('narrows by channel and group', () => {
    const [calls] = quotaProgress(touches, [{ groupKey: 'ALL', channel: 'call', weeklyTarget: 5 }], weeks)
    expect(calls.thisWeek).toBe(1)
    const [none] = quotaProgress(touches, [{ groupKey: 'recruiter', channel: 'ALL', weeklyTarget: 5 }], weeks)
    expect(none.thisWeek).toBe(0)
  })
})

describe('person groups', () => {
  it('puts the buyer side ahead of the candidate side when someone is both', () => {
    expect(personGroupOf(['JOB_SEEKER', 'HIRING_MANAGER'])).toBe('employer_buyer')
  })
  it('falls back to the campaign audience only when there is no role', () => {
    expect(personGroupOf([], 'Workforce boards')).toBe('workforce')
    expect(personGroupOf(['PRESS'], 'Employers')).toBe('press')
    expect(personGroupOf(['OTHER'], 'Employers')).toBe('employer_buyer')
  })
  it('sends unlisted or missing roles to other, and flags personal-only contacts', () => {
    expect(personGroupOf([])).toBe('other')
    expect(personGroupOf(['EMPLOYEE_CANDIDATE'])).toBe('other')
    expect(isPersonalOnly(['FRIENDS_FAMILY'])).toBe(true)
    expect(isPersonalOnly(['FRIENDS_FAMILY', 'ADVISOR'])).toBe(false)
    expect(isPersonalOnly([])).toBe(false)
  })
})
