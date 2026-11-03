import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { communityPostWhere } from '@/lib/community/communities'
import { roleNetworkInfo } from '@/lib/community/role-networks'

describe('role networks', () => {
  it('resolves the CRO acronym to the one canonical role', () => {
    const info = roleNetworkInfo('cro')
    expect(info?.short).toBe('CRO')
    expect(info?.label).toBe('CRO network')
    expect(info?.slug).toBe(roleNetworkInfo('chief-revenue-officer')?.slug)
  })

  it('rejects an address that is not a role', () => {
    expect(roleNetworkInfo('not-a-real-role')).toBeNull()
  })

  it('shows a role feed as the posts of its members, never including Confidential Search Mode', () => {
    expect(communityPostWhere({ type: 'ROLE', value: 'x', communityId: 'c1' })).toEqual({
      candidate: { communityMemberships: { some: { communityId: 'c1', leftAt: null } }, confidentialSearchMode: false },
    })
  })

  it('fails closed without a community id', () => {
    expect(communityPostWhere({ type: 'ROLE', value: 'x' })).toEqual({ id: '__no_such_post__' })
  })
})
