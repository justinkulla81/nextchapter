import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const findFirst = vi.fn()
const updateMany = vi.fn()
const findMany = vi.fn()
const del = vi.fn()
const moveCrm = vi.fn()
const grantDeleteMany = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    candidateProfile: {
      findFirst: (a: unknown) => findFirst(a),
      updateMany: (a: unknown) => updateMany(a),
      findMany: (a: unknown) => findMany(a),
      delete: (a: unknown) => del(a),
    },
    roleGrant: { deleteMany: (a: unknown) => grantDeleteMany(a) },
  },
}))
vi.mock('@/lib/crm/move-candidate-link', () => ({ moveCrmPersonToCandidate: (...a: unknown[]) => moveCrm(...a) }))
const getUserById = vi.fn()
const deleteUser = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ auth: { admin: { getUserById: (a: unknown) => getUserById(a), deleteUser: (a: unknown) => deleteUser(a) } } }),
}))
const capture = vi.fn()
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: (...a: unknown[]) => capture(...a) }))

import { findExistingRegisteredAccount, flagIfDuplicateAccount, removeUnregisteredDuplicates } from '@/lib/onboarding/duplicate-check'

beforeEach(() => {
  findFirst.mockReset()
  updateMany.mockReset()
  capture.mockReset()
  findMany.mockReset()
  del.mockReset()
  moveCrm.mockReset()
  grantDeleteMany.mockReset()
  getUserById.mockReset()
  deleteUser.mockReset()
  deleteUser.mockResolvedValue({})
})

describe('findExistingRegisteredAccount', () => {
  it('counts an account that set a password even before registrationCompletedAt is stamped', async () => {
    findFirst.mockResolvedValueOnce(null)
    await findExistingRegisteredAccount('Chris@Example.com', 'mine')
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: { not: 'mine' },
        OR: [{ registrationCompletedAt: { not: null } }, { passwordSetAt: { not: null } }],
        email: { equals: 'Chris@Example.com', mode: 'insensitive' },
      },
      select: { id: true, passwordSetAt: true },
    })
  })
})

describe('flagIfDuplicateAccount', () => {
  it('does nothing when no registered account owns the email', async () => {
    findFirst.mockResolvedValueOnce(null)
    expect(await flagIfDuplicateAccount('p2', 'a@example.com', 'resume')).toBeNull()
    expect(updateMany).not.toHaveBeenCalled()
    expect(capture).not.toHaveBeenCalled()
  })

  it('flags an unregistered profile and records the event once', async () => {
    findFirst.mockResolvedValueOnce({ id: 'p1', passwordSetAt: new Date() })
    updateMany.mockResolvedValueOnce({ count: 1 })
    expect((await flagIfDuplicateAccount('p2', 'a@example.com', 'resume'))?.id).toBe('p1')
    expect(updateMany.mock.calls[0][0].where).toEqual({ id: 'p2', registrationCompletedAt: null, duplicateEmailBlockedAt: null })
    expect(capture).toHaveBeenCalledWith('p2', 'duplicate_account_blocked', { email: 'a@example.com', source: 'resume', existingCandidateId: 'p1' })
  })

  it('does not record the event again when the profile was already flagged', async () => {
    findFirst.mockResolvedValueOnce({ id: 'p1', passwordSetAt: null })
    updateMany.mockResolvedValueOnce({ count: 0 })
    await flagIfDuplicateAccount('p2', 'a@example.com', 'create_account_email')
    expect(capture).not.toHaveBeenCalled()
  })
})

describe('removeUnregisteredDuplicates', () => {
  it('only looks at unregistered profiles with no password and the same email', async () => {
    findMany.mockResolvedValueOnce([])
    expect(await removeUnregisteredDuplicates('real', 'A@Example.com')).toBe(0)
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { not: 'real' }, registrationCompletedAt: null, passwordSetAt: null, email: { equals: 'A@Example.com', mode: 'insensitive' } },
      select: { id: true, userId: true },
    })
  })

  it('removes an anonymous leftover, its role grant and its auth user, moving its CRM person to the registered profile', async () => {
    findMany.mockResolvedValueOnce([{ id: 'stale', userId: 'anon-user' }])
    getUserById.mockResolvedValueOnce({ data: { user: { is_anonymous: true } }, error: null })
    expect(await removeUnregisteredDuplicates('real', 'a@example.com')).toBe(1)
    expect(moveCrm).toHaveBeenCalledWith('stale', 'real')
    expect(del).toHaveBeenCalledWith({ where: { id: 'stale' } })
    expect(grantDeleteMany).toHaveBeenCalledWith({ where: { userId: 'anon-user' } })
    expect(deleteUser).toHaveBeenCalledWith('anon-user')
    expect(capture).toHaveBeenCalledWith('real', 'duplicate_profile_removed', { removedCandidateId: 'stale', email: 'a@example.com' })
  })

  it('never removes a profile whose login is a real account, not an anonymous session', async () => {
    findMany.mockResolvedValueOnce([{ id: 'other', userId: 'real-login' }])
    getUserById.mockResolvedValueOnce({ data: { user: { is_anonymous: false } }, error: null })
    expect(await removeUnregisteredDuplicates('real', 'a@example.com')).toBe(0)
    expect(del).not.toHaveBeenCalled()
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('skips a profile when the auth lookup fails for any reason other than the user being gone', async () => {
    findMany.mockResolvedValueOnce([{ id: 'x', userId: 'u' }])
    getUserById.mockResolvedValueOnce({ data: { user: null }, error: { message: 'service unavailable' } })
    expect(await removeUnregisteredDuplicates('real', 'a@example.com')).toBe(0)
    expect(del).not.toHaveBeenCalled()
  })

  it('removes a profile whose auth user is already gone, and keeps going after one that cannot be deleted', async () => {
    findMany.mockResolvedValueOnce([{ id: 'blocked', userId: 'u1' }, { id: 'gone', userId: 'u2' }])
    getUserById
      .mockResolvedValueOnce({ data: { user: { is_anonymous: true } }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: { message: 'User not found' } })
    del.mockRejectedValueOnce(new Error('restricted by CandidateInteraction')).mockResolvedValueOnce({})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await removeUnregisteredDuplicates('real', 'a@example.com')).toBe(1)
    expect(del).toHaveBeenCalledTimes(2)
    expect(deleteUser).not.toHaveBeenCalled()
  })
})
