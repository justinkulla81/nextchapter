import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const findFirst = vi.fn()
const updateMany = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: { candidateProfile: { findFirst: (a: unknown) => findFirst(a), updateMany: (a: unknown) => updateMany(a) } },
}))
const capture = vi.fn()
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: (...a: unknown[]) => capture(...a) }))

import { findExistingRegisteredAccount, flagIfDuplicateAccount } from '@/lib/onboarding/duplicate-check'

beforeEach(() => {
  findFirst.mockReset()
  updateMany.mockReset()
  capture.mockReset()
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
