import { beforeEach, describe, expect, it, vi } from 'vitest'

const send = vi.fn()
const allowByTarget = vi.fn()
const allowRequest = vi.fn()

vi.mock('server-only', () => ({}))
// Outside a request `after` throws; the helper then runs the send straight away.
vi.mock('next/server', () => ({
  after: () => {
    throw new Error('outside a request')
  },
}))
vi.mock('@/lib/email/resend-client', () => ({ createResend: () => ({ emails: { send } }) }))
vi.mock('@/lib/admin/auth', () => ({ getAccountActivityAdminEmail: () => 'admin@example.com' }))
vi.mock('@/lib/security/rate-limit', () => ({
  DAY_MS: 86_400_000,
  allowByTarget: (...a: unknown[]) => allowByTarget(...a),
  allowRequest: (...a: unknown[]) => allowRequest(...a),
}))
vi.mock('@/emails/admin-new-lead', () => ({ default: () => null }))
vi.mock('@/lib/leads/lifecycle/file-lead', () => ({ fileLeadInCrm: async () => 'person_1' }))

import { notifyNewLead } from '@/lib/leads/notify-new-lead'

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('notifyNewLead', () => {
  beforeEach(() => {
    send.mockReset().mockResolvedValue({ error: null })
    allowByTarget.mockReset().mockResolvedValue(true)
    allowRequest.mockReset().mockResolvedValue(true)
    process.env.RESEND_API_KEY = 're_test_key'
  })

  it('emails the admin once for a new address', async () => {
    notifyNewLead({ email: ' New@Example.org ', channel: 'Newsletter', detail: 'home' })
    await flush()
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'admin@example.com', subject: 'New lead: Newsletter' })
  })

  it('stays quiet for the admin\'s own address, a repeat address, or past the daily cap', async () => {
    notifyNewLead({ email: 'Admin@example.com', channel: 'Newsletter' })
    await flush()
    allowByTarget.mockResolvedValueOnce(false)
    notifyNewLead({ email: 'again@example.org', channel: 'Newsletter' })
    await flush()
    allowRequest.mockResolvedValueOnce(false)
    notifyNewLead({ email: 'over@example.org', channel: 'Newsletter' })
    await flush()
    expect(send).not.toHaveBeenCalled()
  })

  it('does nothing without a Resend key and never throws when sending fails', async () => {
    delete process.env.RESEND_API_KEY
    notifyNewLead({ email: 'a@example.org', channel: 'Newsletter' })
    await flush()
    expect(send).not.toHaveBeenCalled()

    process.env.RESEND_API_KEY = 're_test_key'
    send.mockRejectedValueOnce(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => notifyNewLead({ email: 'b@example.org', channel: 'Newsletter' })).not.toThrow()
    await flush()
    spy.mockRestore()
  })
})
