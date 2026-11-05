import { describe, expect, it } from 'vitest'
import { roleBySlug } from '@/lib/seo/role-pages'
import type { FirmLike } from '@/lib/roles/resources-rules'
import { conferencesForRole, firmBandForRole, firmsForRole, isAboutSeat, rolesForMember, safeHttpsUrl, turnoverScope } from '@/lib/roles/resources-rules'

const role = (slug: string) => roleBySlug(slug)!

describe('turnoverScope', () => {
  it('uses the role’s own officer seat for a chief', () => {
    expect(turnoverScope(role('chief-revenue-officer'))).toMatchObject({ codes: ['CRO'], ownSeat: true, label: 'CRO' })
  })
  it('reads the function head’s changes for a VP', () => {
    expect(turnoverScope(role('vp-of-sales'))).toMatchObject({ codes: ['CRO'], ownSeat: false })
  })
  it('has no scope for a role the SEC names no officer for', () => {
    expect(turnoverScope(role('chief-data-officer'))).toBeNull()
  })
})

describe('firmsForRole', () => {
  const firms: FirmLike[] = [
    { orgId: 'oa', slug: 'a', name: 'A', recruiter: true, fnLevel: { 'Sales|C-suite': 5, 'Sales|Manager': 90 } },
    { orgId: 'ob', slug: 'b', name: 'B', recruiter: true, fnLevel: { 'Sales|Manager': 50 } },
    { orgId: 'oc', slug: 'c', name: 'C', recruiter: true, fnLevel: { 'Finance|C-suite': 40 } },
    { orgId: 'od', slug: 'd', name: 'D', recruiter: true, fnLevel: { 'Sales|C-suite': 9, 'Sales|VP and director': 4 } },
    { orgId: 'oh', slug: 'h', name: 'Hospitality staffing', recruiter: true, fnLevel: { 'Sales|C-suite': 1, 'Sales|Manager': 300 } },
    { orgId: 'og', slug: 'g', name: 'Stored before the field existed' },
    { orgId: 'oj', slug: 'j', name: 'Payroll software company filed under staffing', recruiter: false, fnLevel: { 'Sales|C-suite': 6 } },
  ]
  it('ranks on searches in the role’s own function and level, and drops firms with fewer than two', () => {
    const r = firmsForRole(role('chief-revenue-officer'), firms)
    expect(r.map((f) => [f.slug, f.searches])).toEqual([['d', 9], ['a', 5]])
  })
  it('leaves out an employer filed under staffing, and a listing stored without the flag', () => {
    const slugs = firmsForRole(role('chief-revenue-officer'), firms).map((f) => f.slug)
    expect(slugs).not.toContain('j')
    expect(slugs).not.toContain('g')
  })
  it('uses the VP and director cell for VP and director roles', () => {
    expect(firmBandForRole(role('vp-of-sales'))).toBe('VP and director')
    expect(firmsForRole(role('vp-of-sales'), firms).map((f) => f.slug)).toEqual(['d'])
  })
})

describe('conferencesForRole', () => {
  const now = new Date('2026-11-04T12:00:00Z')
  const c = (name: string, o: Partial<{ kind: string; functions: string[]; datesConfirmed: boolean; startDate: Date | null; seniorities: string[]; roles: string[]; importance: number }> = {}) => ({
    name, kind: 'CONFERENCE', functions: ['Sales'], datesConfirmed: true, startDate: new Date('2027-03-10T00:00:00Z'), seniorities: [], roles: [], importance: 2, ...o,
  })
  const cro = role('chief-revenue-officer')
  it('drops an event already under way and one built for other levels only', () => {
    const rows = [c('Under way', { startDate: new Date('2026-11-02T00:00:00Z') }), c('Early career only', { seniorities: ['EARLY'] }), c('Fine')]
    expect(conferencesForRole(cro, rows, now).map((x) => x.name)).toEqual(['Fine'])
  })
  it('puts the ones that name the role, then executive-level events, ahead of trade shows', () => {
    const rows = [c('Trade show', { kind: 'TRADE_SHOW' }), c('Exec summit', { seniorities: ['EXECUTIVE'] }), c('Names the role', { roles: ['Chief Revenue Officer'] })]
    expect(conferencesForRole(cro, rows, now).map((x) => x.name)).toEqual(['Names the role', 'Exec summit', 'Trade show'])
  })
  it('lists dated events before events with no confirmed dates', () => {
    const rows = [c('Undated', { datesConfirmed: false, startDate: null, importance: 1 }), c('Dated', { importance: 3 })]
    expect(conferencesForRole(cro, rows, now).map((x) => x.name)).toEqual(['Dated', 'Undated'])
  })
  it('leaves out an event with no function tag of its own, as an inferred match', () => {
    expect(conferencesForRole(cro, [c('Music conference', { functions: [] }), c('Sales event')], now).map((x) => x.name)).toEqual(['Sales event'])
  })
  it('counts a role on the same ladder as naming the role, by whole word', () => {
    const rows = [c('Plain'), c('Microsoft partner day', { roles: ['microsoft reseller'] }), c('Sales leaders', { roles: ['vp of sales'] })]
    // "cro" inside "microsoft" does not count as naming the role, so only the ladder match leads; the other two tie and sort by name.
    expect(conferencesForRole(cro, rows, now).map((x) => x.name)).toEqual(['Sales leaders', 'Microsoft partner day', 'Plain'])
  })
  it('uses the senior band for VP and director roles', () => {
    const rows = [c('Exec only', { seniorities: ['EXECUTIVE'] }), c('Senior', { seniorities: ['SENIOR'] })]
    expect(conferencesForRole(role('vp-of-sales'), rows, now).map((x) => x.name)).toEqual(['Senior'])
  })
})

describe('rolesForMember', () => {
  it('finds the role held and the role aimed at', () => {
    const roles = rolesForMember(['Chief Revenue Officer', 'VP of Sales'])
    expect(roles.map((r) => r.slug)).toEqual(['chief-revenue-officer', 'vp-of-sales'])
  })
  it('ignores empty titles and titles that are not leadership roles', () => {
    expect(rolesForMember([null, '', 'Line Cook'])).toEqual([])
  })
  it('does not count staff around the leader', () => {
    expect(rolesForMember(['Sales Analyst'])).toEqual([])
  })
})

import { feedHeadline, filedThisWeek, memberRoleFeed, pickFeedRole } from '@/lib/roles/role-feed-rules'

describe('role feed rules', () => {
  const now = new Date('2026-11-04T12:00:00Z')
  const cro = roleBySlug('chief-revenue-officer')!
  const turnover = (days: number[]) => ({ label: 'CRO', items: days.map((d, i) => ({ company: `Co${i}`, date: new Date(now.getTime() - d * 86_400_000) })) })

  it('leads with a change filed inside the week', () => {
    const h = feedHeadline(cro, turnover([2, 5, 30]), 412, now)
    expect(h.kind).toBe('changed')
    expect(h.title).toBe('2 CRO seats changed hands this week.')
    expect(h.action.label).toBe('See jobs at Co0')
  })
  it('says so on a quiet week and dates the last change', () => {
    const h = feedHeadline(cro, turnover([19]), 412, now)
    expect(h.kind).toBe('quiet')
    expect(h.why).toContain('19 days ago, at Co0')
    expect(h.action.label).toBe('See 412 open CRO jobs')
  })
  it('leads with open jobs when the role has no SEC seat', () => {
    expect(feedHeadline(cro, null, 7, now).kind).toBe('none')
  })
  it('gives no feed in Confidential Search Mode or without a role', () => {
    expect(memberRoleFeed({ resumeLatestJobTitle: 'Chief Revenue Officer', targetRoleType: null, confidentialSearchMode: true })).toBeNull()
    expect(memberRoleFeed({ resumeLatestJobTitle: 'Line Cook', targetRoleType: null })).toBeNull()
    expect(memberRoleFeed({ resumeLatestJobTitle: 'Chief Revenue Officer', targetRoleType: null })?.href).toBe('/dashboard/network/role-feed?role=chief-revenue-officer')
  })
  it('shows only a role the member holds or aims for', () => {
    const p = { resumeLatestJobTitle: 'VP of Sales', targetRoleType: 'Chief Revenue Officer' }
    expect(pickFeedRole('chief-revenue-officer', p)?.slug).toBe('chief-revenue-officer')
    expect(pickFeedRole('chief-financial-officer', p)?.slug).toBe('vp-of-sales')
  })
})

describe('adjacent-level recruiters', () => {
  const cro = roleBySlug('chief-revenue-officer')!
  const vp = roleBySlug('vp-of-sales')!
  const f = (slug: string, fnLevel: Record<string, number>, recruiter = true): FirmLike => ({ orgId: `o${slug}`, slug, name: slug.toUpperCase(), recruiter, fnLevel })
  it('borrows from the level below when fewer than four firms qualify, and marks them', () => {
    const r = firmsForRole(cro, [f('a', { 'Sales|C-suite': 5 }), f('b', { 'Sales|VP and director': 9 }), f('c', { 'Sales|VP and director': 3 }), f('d', { 'Sales|VP and director': 2 })])
    expect(r.map((x) => [x.slug, x.searches, x.adjacent])).toEqual([['a', 5, false], ['b', 9, true], ['c', 3, true]])
  })
  it('does not borrow when four firms qualify at the role’s own level', () => {
    const own = ['a', 'b', 'c', 'd'].map((n) => f(n, { 'Sales|C-suite': 3 }))
    const r = firmsForRole(cro, [...own, f('e', { 'Sales|VP and director': 20 })])
    expect(r.map((x) => x.slug)).toEqual(['a', 'b', 'c', 'd'])
    expect(r.every((x) => !x.adjacent)).toBe(true)
  })
  it('never borrows for a VP page, and never from a non-recruiter', () => {
    expect(firmsForRole(vp, [f('a', { 'Sales|C-suite': 9 })])).toEqual([])
    expect(firmsForRole(cro, [f('x', { 'Sales|VP and director': 9 }, false)])).toEqual([])
  })
})

describe('conferences on the day they start', () => {
  const row = { name: 'Today', kind: 'CONFERENCE', functions: ['Sales'], datesConfirmed: true, startDate: new Date('2026-11-04T00:00:00Z'), seniorities: [], roles: [], importance: 2 }
  it('keeps one starting today, drops one that started yesterday', () => {
    const now = new Date('2026-11-04T15:00:00Z')
    expect(conferencesForRole(roleBySlug('chief-revenue-officer')!, [row, { ...row, name: 'Yesterday', startDate: new Date('2026-11-03T00:00:00Z') }], now).map((c) => c.name)).toEqual(['Today'])
  })
})

describe('turnover rows', () => {
  it('drops a multi-officer sentence about an earlier title, keeps a single-seat one', () => {
    expect(isAboutSeat('The new CEO, who previously served as Chief Strategy Officer and Chief Commercial Officer, was appointed.', ['CSO', 'CRO'])).toBe(false)
    expect(isAboutSeat('Merlin appointed its Chief Revenue Officer as President, creating a vacancy in the Chief Revenue Officer role.', ['PRESIDENT', 'CRO'])).toBe(true)
    expect(isAboutSeat('Its Chief Commercial Officer formerly led sales.', ['CRO'])).toBe(true)
  })
  it('shows a source link only when it is a plain https address', () => {
    expect(safeHttpsUrl('https://www.sec.gov/Archives/x.htm')).toBe('https://www.sec.gov/Archives/x.htm')
    for (const bad of ['javascript:alert(1)', 'http://example.com', 'data:text/html,x', '', null, undefined, 'https://a b']) expect(safeHttpsUrl(bad as string)).toBeNull()
  })
})

describe('the feed week and an unknown job count', () => {
  const cro = roleBySlug('chief-revenue-officer')!
  it('counts calendar days: a filing from six days ago is in, seven is out, whatever the hour', () => {
    const now = new Date('2026-11-04T23:30:00Z')
    expect(filedThisWeek([{ date: new Date('2026-10-29T00:00:00Z') }], now)).toHaveLength(1)
    expect(filedThisWeek([{ date: new Date('2026-10-28T00:00:00Z') }], now)).toHaveLength(0)
    expect(filedThisWeek([{ date: new Date('2026-10-29T00:00:00Z') }], new Date('2026-11-04T00:10:00Z'))).toHaveLength(1)
  })
  it('does not claim zero jobs when the count is unknown', () => {
    const h = feedHeadline(cro, null, null)
    expect(h.title).not.toMatch(/\b0\b/)
    expect(h.action.label).toBe('Search CRO jobs')
    expect(feedHeadline(cro, null, 0).action.label).toBe('Search CRO jobs')
  })
  it('links to the first company by name, whatever the count', () => {
    const now = new Date('2026-11-04T12:00:00Z')
    const h = feedHeadline(cro, { label: 'CRO', items: [{ company: 'A Co', date: now }, { company: 'B Co', date: now }] }, 10, now)
    expect(h.action.label).toBe('See jobs at A Co')
    expect(h.action.href).toBe('/jobs?q=A%20Co')
  })
  it('does not offer the feed for a role the member has left', () => {
    const p = { resumeLatestJobTitle: 'Chief Revenue Officer', targetRoleType: 'VP of Sales' }
    expect(memberRoleFeed(p, new Set(['chief-revenue-officer']))?.href).toBe('/dashboard/network/role-feed?role=vp-of-sales')
    expect(memberRoleFeed(p, new Set(['chief-revenue-officer', 'vp-of-sales']))).toBeNull()
    expect(pickFeedRole('chief-revenue-officer', p, new Set(['chief-revenue-officer']))?.slug).toBe('vp-of-sales')
  })
})
