import { describe, it, expect } from 'vitest'
import { sendCap, checkInDue, dueStages, editionKey, nextEditionDue, nextStep, organizerDraft, networkingDraft } from '@/lib/events/headsup'
import type { ConferenceRow } from '@/lib/events/types'

const NOW = new Date('2026-10-23T12:00:00Z')
const at = (days: number) => new Date(NOW.getTime() + days * 86_400_000)
const base: ConferenceRow = {
  id: 'x', name: 'X Summit', organizer: null, url: 'https://x.example', kind: 'CONFERENCE', format: 'IN_PERSON',
  startDate: at(220), endDate: at(222), datesConfirmed: true, typicalMonth: null, city: 'Austin', state: 'TX', country: 'US',
  industries: [], functions: [], segments: [], journeys: [], programFormats: [], roles: [], seniorities: [], importance: 2, whyAttend: null, access: 'PAID', costLow: null, costHigh: null,
  costNote: null, speaking: 'UNKNOWN', speakingUrl: null, speakingDeadline: null, speakingNote: null, cheaperWays: null, applyUrl: null, applyDeadline: null,
  published: true, verified: true, checkedAt: null, locked: false, adminNote: null, source: null,
}
const ev = (o: Partial<ConferenceRow>): ConferenceRow => ({ ...base, ...o })

describe('heads-up stages', () => {
  it('starts the runway about six months out', () => {
    expect(dueStages(ev({}), null, NOW)).toEqual(['EXPLORE'])
    expect(dueStages(ev({ startDate: at(300), endDate: at(302) }), null, NOW)).toEqual([])
  })
  it('asks the undecided to decide, and the going to prepare', () => {
    expect(dueStages(ev({ startDate: at(100) }), 'SAVED', NOW)).toEqual(['DECIDE'])
    expect(dueStages(ev({ startDate: at(100) }), 'GOING', NOW)).toEqual([])
    expect(dueStages(ev({ startDate: at(65) }), 'GOING', NOW)).toEqual(['BOOK'])
    expect(dueStages(ev({ startDate: at(65) }), 'SAVED', NOW)).toEqual([])
    expect(dueStages(ev({ startDate: at(25) }), 'GOING', NOW)).toEqual(['NETWORK_PREP'])
    expect(dueStages(ev({ startDate: at(5) }), 'GOING', NOW)).toEqual(['FINAL'])
    expect(dueStages(ev({ startDate: at(5) }), 'SAVED', NOW)).toEqual([])
  })
  it('reminds an interested member before a speaker deadline', () => {
    const cfp = ev({ startDate: at(300), speaking: 'OPEN_CFP', speakingDeadline: at(20) })
    expect(dueStages(cfp, 'SAVED', NOW)).toEqual(['SPEAK_30'])
    expect(dueStages(cfp, null, NOW)).toEqual([])
    expect(dueStages(ev({ startDate: at(300), speaking: 'OPEN_CFP', speakingDeadline: at(5) }), 'GOING', NOW)).toEqual(['SPEAK_7'])
  })
  it('asks about speaking early even before dates are announced, using the usual month', () => {
    const usual = ev({ datesConfirmed: false, startDate: null, endDate: null, typicalMonth: 'July' })
    expect(dueStages(usual, 'SAVED', NOW)).toEqual(['EXPLORE'])
    expect(dueStages(ev({ datesConfirmed: false, startDate: null, endDate: null, typicalMonth: 'November' }), 'GOING', NOW)).toEqual([])
  })
  it('sends no booking or networking stage without confirmed dates', () => {
    expect(dueStages(ev({ datesConfirmed: false, startDate: null, endDate: null, typicalMonth: 'December' }), 'GOING', NOW)).toEqual([])
  })
  it('sends nothing for past events', () => {
    expect(dueStages(ev({ startDate: at(-10), endDate: at(-8) }), 'GOING', NOW)).toEqual([])
  })
  it('gives one plain next step', () => {
    expect(nextStep(ev({ startDate: at(25) }), 'GOING', NOW)).toMatch(/Write the people/)
    expect(nextStep(ev({ startDate: at(400) }), null, NOW)).toMatch(/Too early/)
  })
  it('drafts messages the member sends themselves', () => {
    const d = organizerDraft(ev({ speaking: 'OPEN_CFP', speakingDeadline: at(20) }), { firstName: 'Pat', about: 'a claims leader' })
    expect(d.body).toMatch(/call for speakers/)
    expect(networkingDraft(ev({}), { firstName: 'Pat' }).subject).toMatch(/X Summit/)
  })
})

describe('follow-through', () => {
  const interest = (o: Partial<{ status: string; editionEnd: Date | null; outcome: string | null }> = {}) => ({ status: 'GOING', editionEnd: at(-5), outcome: null as string | null, ...o })
  it('asks how it went two days to two months after the event, once', () => {
    expect(checkInDue(interest({ editionEnd: at(-1) }), NOW)).toBe(false)
    expect(checkInDue(interest({ editionEnd: at(-3) }), NOW)).toBe(true)
    expect(checkInDue(interest({ editionEnd: at(-90) }), NOW)).toBe(false)
    expect(checkInDue(interest({ outcome: 'ATTENDED' }), NOW)).toBe(false)
    expect(checkInDue(interest({ status: 'FOLLOWING' }), NOW)).toBe(false)
  })
  it('announces next year only to people who went, spoke or follow, and only for a later edition', () => {
    const next = ev({ startDate: at(300), endDate: at(302) })
    expect(nextEditionDue(next, interest({ outcome: 'ATTENDED', editionEnd: at(-30) }), NOW)).toBe(true)
    expect(nextEditionDue(next, interest({ outcome: 'SPOKE', editionEnd: at(-30) }), NOW)).toBe(true)
    expect(nextEditionDue(next, interest({ status: 'FOLLOWING', outcome: null, editionEnd: at(-30) }), NOW)).toBe(true)
    expect(nextEditionDue(next, interest({ status: 'SAVED', outcome: null, editionEnd: at(-30) }), NOW)).toBe(false)
    expect(nextEditionDue(next, interest({ outcome: 'ATTENDED', editionEnd: at(305) }), NOW)).toBe(false)
    expect(nextEditionDue(ev({ datesConfirmed: false, startDate: null, endDate: null }), interest({ outcome: 'ATTENDED' }), NOW)).toBe(false)
  })
  it('keys an edition by the year it starts so stages can repeat next year', () => {
    expect(editionKey(ev({ startDate: at(300), endDate: at(302) }), NOW)).toBe('2027')
  })
})

describe('daily send cap', () => {
  it('treats 0 as paused and only a missing or unreadable value as the default', () => {
    expect(sendCap('0')).toBe(0)
    expect(sendCap('10')).toBe(10)
    expect(sendCap(undefined)).toBe(25)
    expect(sendCap('')).toBe(25)
    expect(sendCap('abc')).toBe(25)
    expect(sendCap('-3')).toBe(0)
  })
})
