import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('server-only', () => ({}))
const findMany = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { googleInboxConnection: { findMany: (...a: unknown[]) => findMany(...a), update: vi.fn() } } }))
vi.mock('@/lib/google/oauth', () => ({ refreshAccessToken: vi.fn() }))
import { getValidSendAccessToken } from '@/lib/google/connection'

const row = (email: string, token: string) => ({ id: email, email, accessToken: token, refreshToken: 'r', expiresAt: new Date(Date.now() + 3_600_000) })

describe('getValidSendAccessToken', () => {
  beforeEach(() => findMany.mockReset())
  it('sends from the company-domain account when it is connected', async () => {
    findMany.mockResolvedValue([row('justin.kulla@gmail.com', 'gmail-token'), row('justin@launchyournextchapter.com', 'work-token')])
    expect(await getValidSendAccessToken()).toBe('work-token')
  })
  it('falls back to the primary mailbox when only a personal account is connected', async () => {
    findMany.mockResolvedValue([row('justin.kulla@gmail.com', 'gmail-token')])
    expect(await getValidSendAccessToken()).toBe('gmail-token')
  })
  it('is null when nothing is connected', async () => {
    findMany.mockResolvedValue([])
    expect(await getValidSendAccessToken()).toBeNull()
  })
})
