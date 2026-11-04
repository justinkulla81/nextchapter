import { describe, expect, it } from 'vitest'
import { roleBySlug } from '@/lib/seo/role-pages'
import { firmBandForRole, firmsForRole, rolesForMember, turnoverScope } from '@/lib/roles/resources-rules'

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
  const firms = [
    { orgId: 'oa', slug: 'a', name: 'A', functions: ['Sales'], seniorities: ['C-suite'], publicRoles: 5 },
    { orgId: 'ob', slug: 'b', name: 'B', functions: ['Sales'], seniorities: ['Manager'], publicRoles: 50 },
    { orgId: 'oc', slug: 'c', name: 'C', functions: ['Finance'], seniorities: ['C-suite'], publicRoles: 40 },
    { orgId: 'od', slug: 'd', name: 'D', functions: ['Sales', 'Finance'], seniorities: ['C-suite', 'VP and director'], publicRoles: 9 },
    { orgId: 'og', slug: 'g', name: 'General', functions: [], seniorities: [], publicRoles: 99 },
  ]
  it('keeps specialists in the function at the role’s level, biggest first', () => {
    expect(firmsForRole(role('chief-revenue-officer'), firms).map((f) => f.slug)).toEqual(['d', 'a'])
  })
  it('maps VP and director roles to the VP and director band', () => {
    expect(firmBandForRole(role('vp-of-sales'))).toBe('VP and director')
    expect(firmsForRole(role('vp-of-sales'), firms).map((f) => f.slug)).toEqual(['d'])
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

import { feedHeadline, memberRoleFeed, pickFeedRole } from '@/lib/roles/role-feed-rules'

describe('role feed rules', () => {
  const now = new Date('2026-11-04T12:00:00Z')
  const cro = roleBySlug('chief-revenue-officer')!
  const turnover = (days: number[]) => ({ label: 'CRO', items: days.map((d, i) => ({ company: `Co${i}`, date: new Date(now.getTime() - d * 86_400_000) })) })

  it('leads with a change filed inside the week', () => {
    const h = feedHeadline(cro, turnover([2, 5, 30]), 412, now)
    expect(h.kind).toBe('changed')
    expect(h.title).toBe('2 CRO seats changed hands this week.')
    expect(h.action.label).toBe('See jobs at these companies')
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
