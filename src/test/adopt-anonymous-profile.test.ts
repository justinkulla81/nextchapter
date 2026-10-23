import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

vi.mock('server-only', () => ({}))

const findUnique = vi.fn()
const update = vi.fn((args: unknown) => ({ op: 'update', args }))
const updateMany = vi.fn((args: unknown) => ({ op: 'updateMany', args }))
const transaction = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    candidateProfile: { findUnique: (...a: unknown[]) => findUnique(...a), update: (a: unknown) => update(a) },
    roleGrant: { updateMany: (a: unknown) => updateMany(a) },
    $transaction: (ops: unknown[]) => transaction(ops),
  },
}))

import { adoptAnonymousProfile } from '@/lib/auth/adopt-anonymous-profile'

beforeEach(() => {
  findUnique.mockReset()
  update.mockClear()
  updateMany.mockClear()
  transaction.mockReset()
  transaction.mockResolvedValue([])
})

describe('adoptAnonymousProfile', () => {
  it('moves the anonymous profile, and its role grant, onto the new account', async () => {
    findUnique.mockResolvedValueOnce({ id: 'p1' }).mockResolvedValueOnce(null)
    expect(await adoptAnonymousProfile('anon', 'google-user')).toBe('adopted')
    expect(update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { userId: 'google-user' } })
    expect(updateMany).toHaveBeenCalledWith({ where: { userId: 'anon' }, data: { userId: 'google-user' } })
    expect(transaction).toHaveBeenCalledTimes(1)
  })

  it('does nothing when there is no anonymous profile to move', async () => {
    findUnique.mockResolvedValueOnce(null)
    expect(await adoptAnonymousProfile('anon', 'google-user')).toBe('none')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('never overwrites an account that already has its own profile', async () => {
    findUnique.mockResolvedValueOnce({ id: 'p1' }).mockResolvedValueOnce({ id: 'existing' })
    expect(await adoptAnonymousProfile('anon', 'google-user')).toBe('skipped')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('leaves both alone if the new account gets a profile at the same moment', async () => {
    findUnique.mockResolvedValueOnce({ id: 'p1' }).mockResolvedValueOnce(null)
    transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }))
    expect(await adoptAnonymousProfile('anon', 'google-user')).toBe('skipped')
  })

  it('lets any other failure surface instead of hiding it', async () => {
    findUnique.mockResolvedValueOnce({ id: 'p1' }).mockResolvedValueOnce(null)
    transaction.mockRejectedValueOnce(new Error('database down'))
    await expect(adoptAnonymousProfile('anon', 'google-user')).rejects.toThrow('database down')
  })

  it('is a no-op when the visitor is already the same user', async () => {
    expect(await adoptAnonymousProfile('same', 'same')).toBe('none')
    expect(findUnique).not.toHaveBeenCalled()
  })
})
