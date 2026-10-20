import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

describe('admin LinkedIn state', () => {
  beforeEach(() => { process.env.LINKEDIN_CLIENT_SECRET = 'test-secret' })
  afterEach(() => { vi.useRealTimers(); delete process.env.LINKEDIN_CLIENT_SECRET })

  it('round-trips the admin email', async () => {
    const { mintAdminLinkedInState, verifyAdminLinkedInState } = await import('./admin-state')
    expect(verifyAdminLinkedInState(mintAdminLinkedInState('a@b.co'))).toEqual({ adminEmail: 'a@b.co' })
  })
  it('rejects candidate states, tampering and expiry', async () => {
    const { mintAdminLinkedInState, verifyAdminLinkedInState } = await import('./admin-state')
    expect(verifyAdminLinkedInState('0123456789abcdef')).toBeNull()
    expect(verifyAdminLinkedInState(null)).toBeNull()
    const good = mintAdminLinkedInState('a@b.co')
    expect(verifyAdminLinkedInState(good.slice(0, -2) + 'xx')).toBeNull()
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 11 * 60 * 1000)
    expect(verifyAdminLinkedInState(good)).toBeNull()
  })
  it('rejects a state signed with another secret', async () => {
    const { mintAdminLinkedInState } = await import('./admin-state')
    const s = mintAdminLinkedInState('a@b.co')
    process.env.LINKEDIN_CLIENT_SECRET = 'other'
    const { verifyAdminLinkedInState } = await import('./admin-state')
    expect(verifyAdminLinkedInState(s)).toBeNull()
  })
})
