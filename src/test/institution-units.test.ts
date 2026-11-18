import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ institutionMember: { findMany: vi.fn(), count: vi.fn() }, institution: { findUnique: vi.fn() } }))
vi.mock('server-only', () => ({}))
vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), cache: <T,>(fn: T) => fn }))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { hiddenMemberCount, unitMemberWhere, visibleIdsFor } from '@/lib/plans/visible-members'

const tepper = { school: 'Tepper School of Business', department: null }
const heinzPolicy = { school: 'Heinz College', department: 'Public Policy' }

describe('schools and departments (InstitutionUnit)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.institutionMember.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
    db.institutionMember.count.mockResolvedValue(9)
  })
  it('matches the roster school, and the department when the unit names one, ignoring case', () => {
    expect(unitMemberWhere(null)).toEqual({})
    expect(unitMemberWhere([tepper, heinzPolicy])).toEqual({
      OR: [
        { school: { equals: 'Tepper School of Business', mode: 'insensitive' } },
        { school: { equals: 'Heinz College', mode: 'insensitive' }, department: { equals: 'Public Policy', mode: 'insensitive' } },
      ],
    })
  })
  it('a paid unit sees all its own alumni, and nobody else', async () => {
    expect(await visibleIdsFor({ institution: { id: 'i1', plan: 'PAID' }, units: [tepper] })).toEqual(['a', 'b'])
    expect(db.institutionMember.findMany.mock.calls[0][0].where).toMatchObject({ institutionId: 'i1', OR: [{ school: { equals: 'Tepper School of Business' } }] })
    expect(db.institutionMember.findMany.mock.calls[0][0].take).toBe(20_000)
  })
  it('a free unit sees the first 5 of its own alumni; the whole paid institution has no limit', async () => {
    await visibleIdsFor({ institution: { id: 'i1', plan: 'FREE' }, units: [tepper] })
    expect(db.institutionMember.findMany.mock.calls[0][0].take).toBe(5)
    expect(await visibleIdsFor({ institution: { id: 'i1', plan: 'PAID' }, units: null })).toBeNull()
  })
  it('counts the hidden people within the unit only', async () => {
    expect(await hiddenMemberCount({ institution: { id: 'i1', plan: 'FREE' }, units: [tepper] })).toBe(7)
    expect(db.institutionMember.count.mock.calls[0][0].where).toMatchObject({ institutionId: 'i1', OR: [{ school: { equals: 'Tepper School of Business' } }] })
  })
})
