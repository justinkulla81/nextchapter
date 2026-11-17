import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

describe('demo guest links', () => {
  beforeAll(() => {
    process.env.DEMO_GUEST_SECRET = 'test-secret'
  })
  it('opens only its own demo, until it expires', async () => {
    const { guestLinkToken, guestLinkValid, GUEST_LINK_DAYS } = await import('@/lib/higher-ed/demo-guest')
    const now = Date.UTC(2026, 10, 17, 12)
    const t = guestLinkToken('demo-one-louisville-5c9ab', now)
    expect(guestLinkValid('demo-one-louisville-5c9ab', t, now)).toBe(true)
    expect(guestLinkValid('demo-other-1234', t, now)).toBe(false)
    expect(guestLinkValid('demo-one-louisville-5c9ab', t.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')), now)).toBe(false)
    expect(guestLinkValid('demo-one-louisville-5c9ab', t, now + (GUEST_LINK_DAYS + 1) * 86_400_000)).toBe(false)
    expect(guestLinkValid('demo-one-louisville-5c9ab', 'nonsense', now)).toBe(false)
    // The same all day, so the link shown in the demo bar doesn't change on every page view.
    expect(guestLinkToken('demo-one-louisville-5c9ab', now + 3_600_000)).toBe(t)
  })
})
