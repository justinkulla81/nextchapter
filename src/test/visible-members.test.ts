import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ institutionMember: { findMany: vi.fn(), count: vi.fn() }, institution: { findUnique: vi.fn() } }))
vi.mock('server-only', () => ({}))
vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), cache: <T,>(fn: T) => fn }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { hiddenMemberCount, visibleMemberIds, visibleMemberSql, visibleMemberWhere } from '@/lib/plans/visible-members'

const free = { institution: { id: 'i1', plan: 'FREE' } }
const paid = { institution: { id: 'i1', plan: 'PAID' } }

describe('free plan: staff see the first 5 members', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.institutionMember.findMany.mockResolvedValue(['a', 'b', 'c', 'd', 'e'].map((id) => ({ id })))
    db.institutionMember.count.mockResolvedValue(12)
  })
  it('reads the 5 earliest members on FREE, nothing on PAID', async () => {
    expect(await visibleMemberIds('i1', 'FREE')).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(db.institutionMember.findMany.mock.calls[0][0]).toMatchObject({ where: { institutionId: 'i1' }, take: 5, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
    expect(await visibleMemberIds('i1', 'PAID')).toBeNull()
    expect(await visibleMemberIds('i1', null)).toBeNull()
  })
  it('builds the filters', async () => {
    expect((await visibleMemberSql(free)).values).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect((await visibleMemberSql(paid)).sql).toBe('')
    expect(await visibleMemberWhere(free, 'memberId')).toEqual({ memberId: { in: ['a', 'b', 'c', 'd', 'e'] } })
    expect(await visibleMemberWhere(paid, 'memberId')).toEqual({})
  })
  it('counts the people staff cannot see', async () => {
    expect(await hiddenMemberCount(free)).toBe(7)
    expect(await hiddenMemberCount(paid)).toBe(0)
  })
  it('an organization with no members shows nobody', async () => {
    db.institutionMember.findMany.mockResolvedValue([])
    expect((await visibleMemberSql(free)).sql).toBe('and false')
  })
})
