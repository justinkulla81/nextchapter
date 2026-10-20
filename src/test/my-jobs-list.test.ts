import { describe, expect, it } from 'vitest'
import { countByStatus, daysSince, followUpPrompt, matchesFilter, nextAction, parseStageFilter, sortRows, statusRank, STATUS_ORDER, whenLine, whenPhrase } from '@/lib/jobs/my-jobs-list'

const now = new Date('2026-10-19T12:00:00Z') // a Monday
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000)

describe('status ordering', () => {
  it('puts offers, then interviews, then applications, then saved, then closed', () => {
    expect([...STATUS_ORDER]).toEqual(['offer', 'interviewing', 'applied', 'saved', 'closed'])
    expect(statusRank('offer')).toBeLessThan(statusRank('saved'))
  })
  it('sorts by status, then the most recent change first', () => {
    const rows = [
      { id: 'a', status: 'saved' as const, date: ago(1) },
      { id: 'b', status: 'applied' as const, date: ago(10) },
      { id: 'c', status: 'applied' as const, date: ago(2) },
      { id: 'd', status: 'interviewing' as const, date: ago(30) },
      { id: 'e', status: 'closed' as const, date: ago(0) },
    ]
    expect(sortRows(rows).map((r) => r.id)).toEqual(['d', 'c', 'b', 'a', 'e'])
    expect(rows[0].id).toBe('a') // not mutated
  })
})

describe('filters', () => {
  it('parses a stage, defaulting to all', () => {
    expect(parseStageFilter('applied')).toBe('applied')
    expect(parseStageFilter('nope')).toBe('all')
    expect(parseStageFilter(null)).toBe('all')
  })
  it('keeps closed jobs out of All unless that is all there is', () => {
    expect(matchesFilter('closed', 'all', true)).toBe(false)
    expect(matchesFilter('closed', 'all', false)).toBe(true)
    expect(matchesFilter('closed', 'closed', true)).toBe(true)
    expect(matchesFilter('saved', 'applied', true)).toBe(false)
  })
  it('counts by status', () => {
    expect(countByStatus([{ status: 'saved' }, { status: 'saved' }, { status: 'offer' }])).toEqual({ saved: 2, applied: 0, interviewing: 0, offer: 1, closed: 0 })
  })
})

describe('whenPhrase', () => {
  it('reads like a person', () => {
    expect(whenPhrase(ago(0), now)).toBe('today')
    expect(whenPhrase(ago(1), now)).toBe('yesterday')
    expect(whenPhrase(ago(3), now)).toBe('on Friday')
    expect(whenPhrase(ago(9), now)).toBe('last week')
    expect(whenPhrase(ago(21), now)).toBe('3 weeks ago')
    expect(whenPhrase(new Date('2026-07-04T00:00:00Z'), now)).toBe('Jul 4')
    expect(whenLine('applied', ago(1), now)).toBe('Applied yesterday')
    expect(daysSince(ago(-2), now)).toBe(0)
  })
})

describe('nextAction', () => {
  const open = '/dashboard/jobs/j1?src=my_jobs'
  it('saved: apply', () => {
    expect(nextAction({ status: 'saved', date: ago(2), openHref: open }, now)).toMatchObject({ label: 'Apply', href: open })
  })
  it('saved and closed: find a similar job', () => {
    expect(nextAction({ status: 'saved', date: ago(2), openHref: open, listingClosed: true }, now)?.label).toBe('Find a similar job')
  })
  it('applied under a week: wait, with the days left', () => {
    const a = nextAction({ status: 'applied', date: ago(5), openHref: open }, now)!
    expect(a.label).toBe('Wait for a reply')
    expect(a.href).toBeNull()
    expect(a.reason).toContain('2 days')
    expect(nextAction({ status: 'applied', date: ago(6), openHref: open }, now)!.reason).toContain('1 day ')
  })
  it('applied a week or more: follow up', () => {
    expect(nextAction({ status: 'applied', date: ago(7), openHref: null }, now)).toMatchObject({ label: 'Send a follow-up', href: '/dashboard/network/follow-ups' })
  })
  it('interviewing: prepare; offer: compare; closed: nothing', () => {
    expect(nextAction({ status: 'interviewing', date: ago(1), openHref: null }, now)?.href).toBe('/dashboard/interview-prep')
    expect(nextAction({ status: 'offer', date: ago(1), openHref: null }, now)?.href).toBe('/dashboard/got-hired')
    expect(nextAction({ status: 'closed', date: ago(1), openHref: null }, now)).toBeNull()
  })
  it('always gives a reason with an action', () => {
    for (const status of ['saved', 'applied', 'interviewing', 'offer'] as const) expect(nextAction({ status, date: ago(3), openHref: null }, now)!.reason.length).toBeGreaterThan(10)
  })
})

describe('followUpPrompt', () => {
  const row = (key: string, days: number, status: 'applied' | 'saved' | 'interviewing' = 'applied') => ({ key, status, date: ago(days), title: `Role ${key}`, companyName: `Co ${key}` })
  it('is null when nothing is overdue', () => {
    expect(followUpPrompt([row('a', 3), row('b', 20, 'saved'), row('c', 20, 'interviewing')], now)).toBeNull()
    expect(followUpPrompt([], now)).toBeNull()
  })
  it('picks the application closest to a week old', () => {
    const p = followUpPrompt([row('old', 25), row('mid', 12), row('new', 8), row('fresh', 2)], now)!
    expect(p.key).toBe('new')
    expect(p.days).toBe(8)
    expect(p.text).toContain('Co new has not replied in 8 days')
  })
  it('stops asking once an application has gone cold', () => {
    expect(followUpPrompt([row('cold', 45)], now)).toBeNull()
  })
  it('falls back to the title when the company is unknown', () => {
    const p = followUpPrompt([{ key: 'x', status: 'applied', date: ago(9), title: 'COO', companyName: null }], now)!
    expect(p.text).toContain('COO has not replied')
  })
})
