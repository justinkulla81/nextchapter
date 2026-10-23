import { describe, it, expect } from 'vitest'
import { matchEvents, seniorityFromScore, type MemberEventFacts } from '@/lib/events/match'
import { costLabel, whenLabel, hasUpcomingDates } from '@/lib/events/format'
import { normalizeRow } from '@/lib/events/normalize'
import type { ConferenceRow } from '@/lib/events/types'

const NOW = new Date('2026-10-23T12:00:00Z')
const base: ConferenceRow = {
  id: 'x', name: 'X Summit', organizer: null, url: 'https://x.example', kind: 'CONFERENCE', format: 'IN_PERSON',
  startDate: new Date('2027-03-14T00:00:00Z'), endDate: new Date('2027-03-16T00:00:00Z'), datesConfirmed: true, typicalMonth: 'March',
  city: 'Austin', state: 'TX', country: 'US', industries: [], functions: [], segments: [], journeys: [], programFormats: [], roles: [], seniorities: [], importance: 2, whyAttend: null,
  access: 'PAID', costLow: 799, costHigh: 2499, costNote: null, speaking: 'UNKNOWN', speakingUrl: null, speakingDeadline: null,
  speakingNote: null, cheaperWays: null, applyUrl: null, applyDeadline: null, published: true, verified: true, checkedAt: null, locked: false, adminNote: null, source: null,
}
const ev = (o: Partial<ConferenceRow>): ConferenceRow => ({ ...base, ...o })
const facts: MemberEventFacts = { functions: ['Finance'], industries: ['Insurance'], seniority: 'SENIOR', state: 'KY', journey: null, titleText: 'school principal' }

describe('event matching', () => {
  it('ranks function + industry fits above a generic event', () => {
    const r = matchEvents([ev({ id: 'a' }), ev({ id: 'b', functions: ['Finance'], industries: ['Insurance'], seniorities: ['SENIOR'] })], facts, {}, NOW)
    expect(r.map((m) => m.event.id)).toEqual(['b', 'a'])
    expect(r[0].why).toMatch(/Finance/)
  })

  it('hides unpublished rows and rows with no link', () => {
    expect(matchEvents([ev({ published: false }), ev({ url: null })], facts, {}, NOW)).toHaveLength(0)
  })

  it('pushes down events pitched far from the member level', () => {
    const r = matchEvents([ev({ id: 'early', functions: ['Finance'], seniorities: ['EARLY'] }), ev({ id: 'senior', functions: ['Finance'], seniorities: ['SENIOR', 'EXECUTIVE'] })], facts, {}, NOW)
    expect(r[0].event.id).toBe('senior')
  })

  it('filters by how to get in', () => {
    const rows = [ev({ id: 'paid' }), ev({ id: 'free', access: 'FREE' }), ev({ id: 'cfp', speaking: 'OPEN_CFP' }), ev({ id: 'inv', access: 'APPLY' }), ev({ id: 'vol', cheaperWays: 'Volunteer' })]
    const ids = (way: 'cheap' | 'speak' | 'invite') => matchEvents(rows, facts, { way }, NOW).map((m) => m.event.id).sort()
    expect(ids('cheap')).toEqual(['free', 'vol'])
    expect(ids('speak')).toEqual(['cfp'])
    expect(ids('invite')).toEqual(['inv'])
  })

  it('keeps untagged events when a function filter is set (they fit everyone)', () => {
    const r = matchEvents([ev({ id: 'all' }), ev({ id: 'legal', functions: ['Legal'] })], facts, { function: 'Finance' }, NOW)
    expect(r.map((m) => m.event.id)).toEqual(['all'])
  })

  it('bands the internal level score without exposing it', () => {
    expect([10, 40, 60, 90].map(seniorityFromScore)).toEqual(['EARLY', 'MID', 'SENIOR', 'EXECUTIVE'])
    expect(seniorityFromScore(null)).toBeNull()
  })
})

describe('event labels', () => {
  it('says the cost plainly for each access type', () => {
    expect(costLabel(ev({}))).toBe('Ticket $799 to $2,499')
    expect(costLabel(ev({ access: 'FREE', costLow: null, costHigh: null }))).toBe('Free')
    expect(costLabel(ev({ access: 'INVITE' }))).toBe('By invitation only')
    expect(costLabel(ev({ costLow: null, costHigh: null }))).toBe('Paid ticket, price not listed')
    expect(costLabel(ev({ access: 'MIXED', costLow: 500, costHigh: 500 }))).toBe('Free expo floor; session passes $500')
  })

  it('falls back to the usual month when no confirmed upcoming dates', () => {
    expect(whenLabel(ev({}), NOW)).toBe('Mar 14 to Mar 16, 2027')
    const stale = ev({ datesConfirmed: false })
    expect(hasUpcomingDates(stale, NOW)).toBe(false)
    expect(whenLabel(stale, NOW)).toBe('Usually March (next dates not announced)')
    expect(whenLabel(ev({ endDate: new Date('2026-01-02T00:00:00Z'), startDate: new Date('2026-01-01T00:00:00Z') }), NOW)).toMatch(/Usually March/)
  })
})

describe('catalog normalizing', () => {
  const good = { name: 'Foo & Bar Summit', url: 'https://foo.example', verified: true, startDate: '2027-02-01', datesConfirmed: true, access: 'FREE', costLow: 100, industries: ['Insurance', 'Made Up'], functions: ['Finance'], speaking: 'NONE', speakingUrl: 'https://x.example' }
  it('publishes only verified rows with a link, and enforces the vocabularies', () => {
    const { row, problems } = normalizeRow(good)
    expect(row?.published).toBe(true)
    expect(row?.id).toBe('foo-and-bar-summit')
    expect(row?.industries).toEqual(['Insurance'])
    expect(row?.costLow).toBeNull()
    expect(row?.speakingUrl).toBeNull()
    expect(problems.join()).toMatch(/unknown industry/)
    expect(normalizeRow({ ...good, verified: false }).row?.published).toBe(false)
    expect(normalizeRow({ ...good, url: 'foo.example' }).row).toBeNull()
  })
  it('drops dates that already passed', () => {
    const { row } = normalizeRow({ ...good, startDate: '2026-05-01', endDate: '2026-05-03', typicalMonth: 'May' })
    expect(row?.startDate).toBeNull()
    expect(row?.datesConfirmed).toBe(false)
    expect(row?.typicalMonth).toBe('May')
  })
})

describe('speaking inference', () => {
  const row = { name: 'X', url: 'https://x.example', verified: true, typicalMonth: 'May' }
  it('infers a speaking path from the program', () => {
    expect(normalizeRow({ ...row, kind: 'CONFERENCE', programFormats: ['KEYNOTE', 'PANEL'] }).row?.speaking).toBe('LIKELY')
    expect(normalizeRow({ ...row, kind: 'CONFERENCE' }).row?.speaking).toBe('LIKELY')
  })
  it('does not infer one for a pure expo or when the call is known', () => {
    expect(normalizeRow({ ...row, kind: 'TRADE_SHOW' }).row?.speaking).toBe('UNKNOWN')
    expect(normalizeRow({ ...row, kind: 'TRADE_SHOW', programFormats: ['EXPO'] }).row?.speaking).toBe('UNKNOWN')
    expect(normalizeRow({ ...row, kind: 'CONFERENCE', speaking: 'NONE' }).row?.speaking).toBe('NONE')
    expect(normalizeRow({ ...row, kind: 'CONFERENCE', speaking: 'OPEN_CFP', speakingUrl: 'https://x.example/cfp' }).row?.speaking).toBe('OPEN_CFP')
  })
})
