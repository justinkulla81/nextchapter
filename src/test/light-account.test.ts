import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { ACCOUNT_LINK_DAYS, makeAccountToken, readAccountToken } from '@/lib/leads/light-account'
import { makeUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'

const KEY = 'test-secret'
const DAY = 86_400_000
const now = Date.UTC(2026, 10, 18)

describe('account link token', () => {
  it('reads back the address it was made for while fresh', () => {
    expect(readAccountToken(makeAccountToken('A@Example.org', now, KEY), now + 3 * DAY, KEY)).toBe('a@example.org')
  })
  it('expires after 30 days', () => {
    const t = makeAccountToken('a@example.org', now, KEY)
    expect(readAccountToken(t, now + ACCOUNT_LINK_DAYS * DAY, KEY)).toBe('a@example.org')
    expect(readAccountToken(t, now + (ACCOUNT_LINK_DAYS + 1) * DAY, KEY)).toBeNull()
  })
  it('never accepts an unsubscribe or lead-cookie token, a newsletter edition token, or a tampered one', () => {
    expect(readAccountToken(makeUnsubscribeToken('a@example.org', null, KEY), now, KEY)).toBeNull()
    expect(readAccountToken(makeUnsubscribeToken('a@example.org', 'cm123edition', KEY), now, KEY)).toBeNull()
    const t = makeAccountToken('a@example.org', now, KEY)
    expect(readAccountToken(`${t.slice(0, -2)}xx`, now, KEY)).toBeNull()
    expect(readAccountToken(makeAccountToken('a@example.org', now, 'other-key'), now, KEY)).toBeNull()
    expect(readAccountToken(null, now, KEY)).toBeNull()
  })
})
