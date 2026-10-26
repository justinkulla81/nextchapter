import { describe, expect, it } from 'vitest'
import {
  ACTION_TYPE_LINK, estimateActionEffort, engineForActionType, getActionWhy, getRecurringTargetCount, isAutoDetectedActionType, isRecurringActionType, navCategoryForActionType,
} from '@/lib/weekly/action-effort'
import { effortKind } from '@/lib/scoring/effort-actions'
import { conferenceSuggestions, isFollowUpPrompt, type FollowedConference, type OpenOpportunity } from './sprint'

const NOW = new Date('2026-10-26T15:00:00Z')
const d = (s: string) => new Date(`${s}T00:00:00Z`)
const conf = (over: Partial<FollowedConference> = {}): FollowedConference => ({ seriesId: 's1', name: 'HR Tech', status: 'TRACKING', startDate: null, endDate: null, datesConfirmed: false, ...over })
const opp = (over: Partial<OpenOpportunity> = {}): OpenOpportunity => ({ id: 'o1', seriesId: 's1', type: 'CALL_FOR_SPEAKERS', title: 'Speak', deadline: d('2026-11-10'), ...over })
const none = new Map<string, string>()

describe('submission suggestion', () => {
  it('suggests the soonest open deadline on a followed conference, with the real date', () => {
    const out = conferenceSuggestions([conf(), conf({ seriesId: 's2', name: 'SHRM' })], [opp({ deadline: d('2026-11-20') }), opp({ id: 'o2', seriesId: 's2', deadline: d('2026-11-05') })], none, NOW)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ actionType: 'CONFERENCE_SUBMISSION' })
    expect(out[0].text).toContain('SHRM')
    expect(out[0].text).toContain('closes Nov 5')
  })
  it('words the ask by opportunity type', () => {
    const text = (type: string, title = 'Innovation Award') => conferenceSuggestions([conf()], [opp({ type, title })], none, NOW)[0].text
    expect(text('CALL_FOR_SPEAKERS')).toMatch(/^Send your speaker proposal to HR Tech/)
    expect(text('CALL_FOR_SUBMISSIONS')).toMatch(/^Submit your paper or proposal to HR Tech/)
    expect(text('CONTEST')).toMatch(/^Enter Innovation Award at HR Tech/)
    expect(text('AWARD')).toMatch(/^Put yourself or your work forward for Innovation Award at HR Tech/)
    expect(text('DEMO')).toMatch(/^Apply to show a demo at HR Tech/)
  })
  it('does not suggest what the member already sent, nor what is rejected, accepted or delivered', () => {
    for (const st of ['SUBMITTED', 'ACCEPTED', 'REJECTED', 'DELIVERED']) expect(conferenceSuggestions([conf()], [opp()], new Map([['o1', st]]), NOW), st).toEqual([])
  })
  it('still suggests it while the member is only watching or drafting', () => {
    for (const st of ['WATCHING', 'DRAFTING']) expect(conferenceSuggestions([conf()], [opp()], new Map([['o1', st]]), NOW), st).toHaveLength(1)
  })
  it('ignores deadlines that passed, are more than 30 days out, or have no date', () => {
    expect(conferenceSuggestions([conf()], [opp({ deadline: d('2026-10-25') }), opp({ id: 'o2', deadline: d('2026-12-15') }), opp({ id: 'o3', deadline: null })], none, NOW)).toEqual([])
  })
  it('counts a deadline today', () => expect(conferenceSuggestions([conf()], [opp({ deadline: d('2026-10-26') })], none, NOW)).toHaveLength(1))
  it('ignores reports and sessions: there is nothing to submit', () => {
    expect(conferenceSuggestions([conf()], [opp({ type: 'REPORT' }), opp({ id: 'o2', type: 'PRESENTATION' })], none, NOW)).toEqual([])
  })
  it('ignores conferences the member does not follow or has skipped', () => {
    expect(conferenceSuggestions([], [opp()], none, NOW)).toEqual([])
    expect(conferenceSuggestions([conf({ status: 'SKIPPED' })], [opp()], none, NOW)).toEqual([])
  })
})

describe('register and attend suggestions', () => {
  it('suggests registering for a followed conference with confirmed dates in the next 120 days', () => {
    const out = conferenceSuggestions([conf({ startDate: d('2027-01-12'), endDate: d('2027-01-14'), datesConfirmed: true })], [], none, NOW)
    expect(out).toEqual([{ actionType: 'CONFERENCE_REGISTER', text: 'Register for HR Tech (Jan 12 to Jan 14), or tell us you are skipping it' }])
  })
  it('does not suggest it for unconfirmed dates, dates beyond 120 days, past dates, or when already registered', () => {
    const base = { startDate: d('2027-01-12'), endDate: d('2027-01-14') }
    expect(conferenceSuggestions([conf({ ...base, datesConfirmed: false })], [], none, NOW)).toEqual([])
    expect(conferenceSuggestions([conf({ startDate: d('2027-03-12'), endDate: d('2027-03-14'), datesConfirmed: true })], [], none, NOW)).toEqual([])
    expect(conferenceSuggestions([conf({ startDate: d('2026-10-01'), endDate: d('2026-10-03'), datesConfirmed: true })], [], none, NOW)).toEqual([])
    expect(conferenceSuggestions([conf({ ...base, datesConfirmed: true, status: 'REGISTERED' })], [], none, NOW)).toEqual([])
  })
  it('suggests attending this week for a registered member, using the existing event action', () => {
    const out = conferenceSuggestions([conf({ status: 'REGISTERED', startDate: d('2026-10-28'), endDate: d('2026-10-30'), datesConfirmed: true })], [], none, NOW)
    expect(out).toEqual([{ actionType: 'ENGAGE_EVENT', text: 'Attend HR Tech (Oct 28 to Oct 30) and speak to three new people' }])
  })
  it('keeps suggesting attendance while the conference is in progress, not after it ends', () => {
    const during = conf({ status: 'ATTENDING', startDate: d('2026-10-25'), endDate: d('2026-10-27'), datesConfirmed: true })
    expect(conferenceSuggestions([during], [], none, NOW)).toHaveLength(1)
    expect(conferenceSuggestions([{ ...during, endDate: d('2026-10-25') }], [], none, NOW)).toEqual([])
  })
  it('gives at most one suggestion per action type', () => {
    const out = conferenceSuggestions(
      [conf({ seriesId: 'a', name: 'A', startDate: d('2026-12-01'), endDate: d('2026-12-02'), datesConfirmed: true }), conf({ seriesId: 'b', name: 'B', startDate: d('2026-11-15'), endDate: d('2026-11-16'), datesConfirmed: true })],
      [opp({ seriesId: 'a' }), opp({ id: 'o2', seriesId: 'b' })], none, NOW,
    )
    expect(out.map((o) => o.actionType).sort()).toEqual(['CONFERENCE_REGISTER', 'CONFERENCE_SUBMISSION'])
    expect(out.find((o) => o.actionType === 'CONFERENCE_REGISTER')!.text).toContain('Register for B') // the soonest
  })
})

describe('registration dates', () => {
  const reg = (over: Partial<OpenOpportunity> = {}): OpenOpportunity => ({ id: 'r1', seriesId: 's1', type: 'REGISTRATION', title: 'Early-bird registration', deadline: d('2026-12-05'), ...over })

  it('uses the real registration deadline, and names early-bird when that is what ends', () => {
    expect(conferenceSuggestions([conf()], [reg()], none, NOW)).toEqual([{ actionType: 'CONFERENCE_REGISTER', text: 'Register for HR Tech (early-bird ends Dec 5), or tell us you are skipping it' }])
    expect(conferenceSuggestions([conf()], [reg({ title: 'Registration', deadline: d('2026-12-20') })], none, NOW)[0].text).toContain('registration closes Dec 20')
  })
  it('prefers the printed deadline over the start date', () => {
    const out = conferenceSuggestions([conf({ startDate: d('2027-01-12'), endDate: d('2027-01-14'), datesConfirmed: true })], [reg()], none, NOW)
    expect(out).toHaveLength(1)
    expect(out[0].text).toContain('early-bird ends Dec 5')
  })
  it('is not a submission: registration never produces the proposal suggestion', () => {
    expect(conferenceSuggestions([conf()], [reg()], none, NOW).map((o) => o.actionType)).toEqual(['CONFERENCE_REGISTER'])
  })
  it('says nothing once registered, when the deadline passed, or when it is beyond 120 days', () => {
    expect(conferenceSuggestions([conf({ status: 'REGISTERED' })], [reg()], none, NOW)).toEqual([])
    expect(conferenceSuggestions([conf()], [reg({ deadline: d('2026-10-20') })], none, NOW)).toEqual([])
    expect(conferenceSuggestions([conf()], [reg({ deadline: d('2027-04-01') })], none, NOW)).toEqual([])
  })
})

describe('follow-ups keep only the people prompt', () => {
  it('drops deadlines, dates and openings', () => {
    expect(['deadline', 'conference', 'opens_soon', 'log_people'].filter((kind) => isFollowUpPrompt({ kind }))).toEqual(['log_people'])
  })
})

describe('the three new action types are registered everywhere the Sprint needs them', () => {
  const types = ['CONFERENCE_SUBMISSION', 'CONFERENCE_TALK', 'CONFERENCE_REGISTER']
  it.each(types)('%s earns points at 1 point per minute, links somewhere real, has a reason, and is verified by the app', (t) => {
    const effort = estimateActionEffort({ actionType: t })
    expect(effort.points).toBe(effort.minutes)
    expect(effort.points).toBeGreaterThan(0)
    expect(ACTION_TYPE_LINK[t]?.href).toMatch(/^\/dashboard\/conferences/)
    expect(getActionWhy(t, null)).toBeTruthy()
    expect(isAutoDetectedActionType(t)).toBe(true)
    expect(isRecurringActionType(t)).toBe(true)
    expect(getRecurringTargetCount(t)).toBe(1)
    expect(navCategoryForActionType(t)).toBeTruthy()
    expect(engineForActionType(t)).toBeTruthy()
  })
  it('counts the proposal and the talk as work, registering as light engagement', () => {
    expect(effortKind({ actionType: 'CONFERENCE_SUBMISSION' })).toBe('work')
    expect(effortKind({ actionType: 'CONFERENCE_TALK' })).toBe('work')
    expect(effortKind({ actionType: 'CONFERENCE_REGISTER' })).toBe('engagement')
  })
})
