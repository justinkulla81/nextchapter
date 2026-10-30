import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

import { signDigestAction, verifyDigestAction } from '@/lib/crm/digest-action-link'

const due = new Date('2026-10-20T12:00:00Z')

describe('digest action links', () => {
  beforeEach(() => {
    process.env.NC_ATS_API_KEY = 'test-key-that-is-long-enough'
  })

  it('round-trips a signed link', () => {
    const token = signDigestAction('person1', 'pause', due)!
    expect(verifyDigestAction(token)).toEqual({ personId: 'person1', action: 'pause', due: '2026-10-20' })
  })

  it('rejects a tampered action', () => {
    const token = signDigestAction('person1', 'pause', due)!
    const [, sig] = token.split('.')
    const forged = Buffer.from(`person1.done.${Math.floor(Date.now() / 1000) + 1000}.2026-10-20`).toString('base64url')
    expect(verifyDigestAction(`${forged}.${sig}`)).toBeNull()
  })

  it('rejects an expired link', () => {
    const token = signDigestAction('person1', 'done', due, new Date('2026-01-01T00:00:00Z'))!
    expect(verifyDigestAction(token)).toBeNull()
  })

  it('refuses everything when the key is missing or short', () => {
    const token = signDigestAction('person1', 'done', due)!
    process.env.NC_ATS_API_KEY = 'short'
    expect(signDigestAction('person1', 'done', due)).toBeNull()
    expect(verifyDigestAction(token)).toBeNull()
  })
})
