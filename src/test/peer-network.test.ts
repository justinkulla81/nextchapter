import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { communityPostWhere } from '@/lib/community/communities'
import { networkInfo, networkInfoForCommunity } from '@/lib/community/peer-networks'
import { networkCopy } from '@/lib/community/network-copy'

describe('peer networks', () => {
  it('resolves a role by acronym and by canonical slug to the same network', () => {
    const a = networkInfo('role:cro')
    expect(a?.name).toBe('CRO')
    expect(a?.networkName).toBe('CRO network')
    expect(a?.value).toBe(networkInfo('role:chief-revenue-officer')?.value)
  })

  it('reads a bare slug as a role, for cookies set before function and industry networks', () => {
    expect(networkInfo('cro')?.type).toBe('ROLE')
  })

  it('uses the same text the profile auto-join uses, so a click lands in the existing community', () => {
    const sales = networkInfo('function:sales')
    expect(sales?.type).toBe('FUNCTION')
    expect(sales?.value).toBe('Sales')
    expect(networkInfoForCommunity('FUNCTION', 'Sales')?.key).toBe('function:sales')
  })

  it('resolves an industry by slug', () => {
    const ind = networkInfo('industry:health-care')
    if (ind) {
      expect(ind.type).toBe('INDUSTRY')
      expect(networkInfoForCommunity('INDUSTRY', ind.value)?.key).toBe(ind.key)
    }
  })

  it('rejects an unknown kind, an unknown slug and a malformed key', () => {
    expect(networkInfo('city:columbus')).toBeNull()
    expect(networkInfo('function:not-a-function')).toBeNull()
    expect(networkInfo('role:Not A Slug!')).toBeNull()
    expect(networkInfo('role:')).toBeNull()
  })

  it('has no network for a community type a page does not offer', () => {
    expect(networkInfoForCommunity('CITY', 'Columbus')).toBeNull()
    expect(networkInfoForCommunity('FUNCTION', 'a profile free-text value')).toBeNull()
  })

  it('says the role in the role block and the field in the others', () => {
    expect(networkCopy('role', 'CRO', 'Chief Revenue Officer').headline).toBe('Are you a CRO? Join your peers.')
    expect(networkCopy('function', 'Sales', 'Sales').headline).toBe('Work in Sales? Join your peers.')
    expect(networkCopy('industry', 'Health care', 'Health care').bullets).toHaveLength(3)
  })
})

describe('network feeds', () => {
  const members = (communityId: string) => ({ communityMemberships: { some: { communityId, leftAt: null } }, confidentialSearchMode: false })

  it('shows a role feed as the posts of its members, never including Confidential Search Mode', () => {
    expect(communityPostWhere({ type: 'ROLE', value: 'x', communityId: 'c1' })).toEqual({ candidate: members('c1') })
  })

  it('fails closed without a community id', () => {
    expect(communityPostWhere({ type: 'ROLE', value: 'x' })).toEqual({ id: '__no_such_post__' })
  })

  it('shows a function feed as the tagged posts plus the posts of members who joined', () => {
    expect(communityPostWhere({ type: 'FUNCTION', value: 'Sales', communityId: 'c2' })).toEqual({
      AND: [{ OR: [{ postFunction: 'Sales' }, { candidate: members('c2') }] }],
    })
  })

  it('keeps the tag-only feed for an industry when the community id is not known', () => {
    expect(communityPostWhere({ type: 'INDUSTRY', value: 'Health care' })).toEqual({ postIndustry: 'Health care' })
  })

  it('does not use the OR key a caller spreads the moderation filter into', () => {
    expect(Object.keys(communityPostWhere({ type: 'FUNCTION', value: 'Sales', communityId: 'c2' }))).toEqual(['AND'])
  })
})
