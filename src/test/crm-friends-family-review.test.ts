import { describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: { crmPerson: { findUnique: (...a: unknown[]) => findUnique(...a) } } }))

import { isFriendsFamilyOnly } from '@/lib/crm/sync'

describe('isFriendsFamilyOnly', () => {
  it('is true when Friends and family is the only role', async () => {
    findUnique.mockResolvedValueOnce({ roles: ['FRIENDS_FAMILY'] })
    expect(await isFriendsFamilyOnly('p1', new Map())).toBe(true)
  })
  it('is false when the person has any other role', async () => {
    findUnique.mockResolvedValueOnce({ roles: ['FRIENDS_FAMILY', 'INVESTOR'] })
    expect(await isFriendsFamilyOnly('p2', new Map())).toBe(false)
  })
  it('is false with no roles or no record', async () => {
    findUnique.mockResolvedValueOnce({ roles: [] })
    expect(await isFriendsFamilyOnly('p3', new Map())).toBe(false)
    findUnique.mockResolvedValueOnce(null)
    expect(await isFriendsFamilyOnly('p4', new Map())).toBe(false)
  })
  it('looks each person up once per sweep', async () => {
    findUnique.mockClear()
    findUnique.mockResolvedValueOnce({ roles: ['FRIENDS_FAMILY'] })
    const cache = new Map<string, boolean>()
    await isFriendsFamilyOnly('p5', cache)
    await isFriendsFamilyOnly('p5', cache)
    expect(findUnique).toHaveBeenCalledTimes(1)
  })
})
