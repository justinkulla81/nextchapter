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
    { slug: 'a', name: 'A', functions: ['Sales'], seniorities: ['C-suite'], publicRoles: 5 },
    { slug: 'b', name: 'B', functions: ['Sales'], seniorities: ['Manager'], publicRoles: 50 },
    { slug: 'c', name: 'C', functions: ['Finance'], seniorities: ['C-suite'], publicRoles: 40 },
    { slug: 'd', name: 'D', functions: ['Sales', 'Finance'], seniorities: ['C-suite', 'VP and director'], publicRoles: 9 },
    { slug: 'g', name: 'General', functions: [], seniorities: [], publicRoles: 99 },
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
