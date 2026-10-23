import { describe, expect, it } from 'vitest'
import {
  briefOptOutUpdate, ceilingReached, draftAllowed, draftSubject, kindsAllowed, pickItem, recruiterFollowUp, introRequest,
  weekKey, weeklyCeiling, PAUSE_DAYS, type BriefContact, type BriefOutreach,
} from '@/lib/senior-brief/rules'
import { estimateCostUsd } from '@/lib/senior-brief/cost'

const now = new Date('2026-10-26T11:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function contact(over: Partial<BriefContact> & { id: string }): BriefContact {
  return {
    name: `Person ${over.id}`, email: `${over.id}@x.com`, emails: [], title: null, company: null, inferredCompany: null,
    warmth: 'WARM', isPriority: false, isRecruiter: false, leftCompany: false, ...over,
  }
}

describe('recruiter follow-up (a)', () => {
  const r = contact({ id: 'r1', isRecruiter: true })
  it('picks a recruiter logged 7 to 45 days ago with nothing since', () => {
    expect(recruiterFollowUp([r], [{ contactId: 'r1', loggedAt: daysAgo(20) }], now)?.contact.id).toBe('r1')
    expect(recruiterFollowUp([r], [{ contactId: 'r1', loggedAt: daysAgo(7) }], now)).not.toBeNull()
    expect(recruiterFollowUp([r], [{ contactId: 'r1', loggedAt: daysAgo(45) }], now)).not.toBeNull()
  })
  it('ignores too fresh, too old, never contacted, and a later outreach', () => {
    expect(recruiterFollowUp([r], [{ contactId: 'r1', loggedAt: daysAgo(3) }], now)).toBeNull()
    expect(recruiterFollowUp([r], [{ contactId: 'r1', loggedAt: daysAgo(60) }], now)).toBeNull()
    expect(recruiterFollowUp([r], [], now)).toBeNull()
    const later: BriefOutreach[] = [{ contactId: 'r1', loggedAt: daysAgo(30) }, { contactId: 'r1', loggedAt: daysAgo(2) }]
    expect(recruiterFollowUp([r], later, now)).toBeNull()
  })
  it('needs an email address and a recruiter tag', () => {
    const log = [{ contactId: 'r1', loggedAt: daysAgo(20) }]
    expect(recruiterFollowUp([contact({ id: 'r1', isRecruiter: true, email: null })], log, now)).toBeNull()
    expect(recruiterFollowUp([contact({ id: 'r1' })], log, now)).toBeNull()
  })
})

describe('intro request (b)', () => {
  const watch = ['acme']
  it('picks the warmest contact at a watched company', () => {
    const cs = [
      contact({ id: 'a', company: 'Acme', warmth: 'COLD' }),
      contact({ id: 'b', company: 'Acme, Inc', warmth: 'HOT' }),
      contact({ id: 'c', company: 'Other', warmth: 'HOT' }),
    ]
    const n = (s: string) => norm(s).replace(/inc$/, '')
    expect(introRequest(cs, [], watch, n, now)?.contact.id).toBe('b')
  })
  it('skips people who left, were written to in 30 days, or have no email', () => {
    const log = [{ contactId: 'a', loggedAt: daysAgo(10) }]
    expect(introRequest([contact({ id: 'a', company: 'Acme' })], log, watch, norm, now)).toBeNull()
    expect(introRequest([contact({ id: 'a', company: 'Acme', leftCompany: true })], [], watch, norm, now)).toBeNull()
    expect(introRequest([contact({ id: 'a', company: 'Acme', email: null })], [], watch, norm, now)).toBeNull()
    expect(introRequest([contact({ id: 'a', company: 'Acme' })], [], [], norm, now)).toBeNull()
  })
})

describe('pickItem', () => {
  const cs = [contact({ id: 'r1', isRecruiter: true }), contact({ id: 'a', company: 'Acme' })]
  const outreach = [{ contactId: 'r1', loggedAt: daysAgo(20) }]
  const base = { contacts: cs, outreach, watchlist: ['acme'], normalize: norm }
  it('prefers the recruiter follow-up, else the intro, else nothing', () => {
    expect(pickItem({ ...base, confidentialSearchMode: false }, now)?.kind).toBe('recruiter_follow_up')
    expect(pickItem({ ...base, outreach: [], confidentialSearchMode: false }, now)?.kind).toBe('intro_request')
    expect(pickItem({ ...base, outreach: [], watchlist: [], confidentialSearchMode: false }, now)).toBeNull()
  })
  it('confidential mode never drafts a recruiter follow-up', () => {
    expect(kindsAllowed(true)).toEqual(['intro_request'])
    expect(pickItem({ ...base, confidentialSearchMode: true }, now)?.kind).toBe('intro_request')
    expect(pickItem({ ...base, watchlist: [], confidentialSearchMode: true }, now)).toBeNull()
  })
})

describe('cap and ceiling', () => {
  const ok = { lastDraftAt: null, pausedUntil: null, optedOut: false }
  it('allows one draft per member per 6 days', () => {
    expect(draftAllowed(ok, now).ok).toBe(true)
    expect(draftAllowed({ ...ok, lastDraftAt: daysAgo(5) }, now)).toEqual({ ok: false, reason: 'too_soon' })
    expect(draftAllowed({ ...ok, lastDraftAt: daysAgo(6) }, now).ok).toBe(true)
  })
  it('honours opt-out and the 90-day pause', () => {
    expect(draftAllowed({ ...ok, optedOut: true }, now)).toEqual({ ok: false, reason: 'opted_out' })
    expect(draftAllowed({ ...ok, pausedUntil: daysAgo(-10) }, now)).toEqual({ ok: false, reason: 'paused' })
    expect(draftAllowed({ ...ok, pausedUntil: daysAgo(1) }, now).ok).toBe(true)
  })
  it('weekly ceiling defaults to 200 and stops at the limit', () => {
    expect(weeklyCeiling(undefined)).toBe(200)
    expect(weeklyCeiling('')).toBe(200)
    expect(weeklyCeiling('abc')).toBe(200)
    expect(weeklyCeiling('50')).toBe(50)
    expect(ceilingReached(199, 200)).toBe(false)
    expect(ceilingReached(200, 200)).toBe(true)
  })
  it('week key is the Monday of the week', () => {
    expect(weekKey(new Date('2026-10-26T11:00:00Z'))).toBe('2026-10-26')
    expect(weekKey(new Date('2026-11-01T23:00:00Z'))).toBe('2026-10-26')
  })
})

describe('unsubscribe and "Not for me"', () => {
  it('stops the brief for good', () => {
    expect(briefOptOutUpdate('seniorBrief', now)).toEqual({ seniorBriefOptedOut: true })
  })
  it('pauses drafts for 90 days', () => {
    const u = briefOptOutUpdate('seniorBriefPause', now) as { seniorBriefPausedUntil: Date }
    expect(u.seniorBriefPausedUntil.getTime() - now.getTime()).toBe(PAUSE_DAYS * 86_400_000)
    expect(draftAllowed({ lastDraftAt: null, pausedUntil: u.seniorBriefPausedUntil, optedOut: false }, daysAgo(-89)).ok).toBe(false)
    expect(draftAllowed({ lastDraftAt: null, pausedUntil: u.seniorBriefPausedUntil, optedOut: false }, daysAgo(-91)).ok).toBe(true)
  })
  it('ignores other link types', () => {
    expect(briefOptOutUpdate('daily', now)).toBeNull()
    expect(briefOptOutUpdate(null, now)).toBeNull()
  })
})

describe('copy and cost', () => {
  it('subjects never name a search', () => {
    expect(draftSubject('recruiter_follow_up', null)).toBe('Following up')
    expect(draftSubject('intro_request', 'Acme')).toBe('Reconnecting about Acme')
  })
  it('estimates cost at Haiku 4.5 list price', () => {
    expect(estimateCostUsd(1_000_000, 0)).toBe(1)
    expect(estimateCostUsd(0, 1_000_000)).toBe(5)
    expect(estimateCostUsd(700, 250)).toBeCloseTo(0.00195, 6)
  })
})
