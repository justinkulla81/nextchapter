import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/employer/outplacement-enrollment', () => ({ enrollOneSeat: vi.fn() }))
vi.mock('@/lib/access/grants', () => ({ grantSeatAccess: vi.fn(), revokeSeatAccess: vi.fn() }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
vi.mock('@/lib/invite/invite-and-preconfirm', () => ({ createPreConfirmedInviteUser: vi.fn() }))
vi.mock('@/lib/email/send-outplacement-emails', () => ({}))
vi.mock('@/lib/higher-ed/outreach', () => ({ sendCampaign: vi.fn() }))

import { parseDay } from '@/lib/census/outplacement'
import { reminderDue } from '@/lib/census/comms'

describe('census dates', () => {
  it('reads ISO and US dates, rejects nonsense', () => {
    expect((parseDay('2027-03-31') as Date).toISOString().slice(0, 10)).toBe('2027-03-31')
    expect((parseDay('3/31/2027') as Date).toISOString().slice(0, 10)).toBe('2027-03-31')
    expect(parseDay('')).toBeNull()
    expect(parseDay('2027-02-30')).toBe('bad')
    expect(parseDay('soon')).toBe('bad')
  })
})

describe('join reminders', () => {
  const day = 86_400_000
  const now = new Date('2026-10-15T12:00:00Z')
  it('first at day 5, second at day 12, then stop', () => {
    expect(reminderDue(new Date(now.getTime() - 4 * day), 0, now)).toBeNull()
    expect(reminderDue(new Date(now.getTime() - 5 * day), 0, now)).toBe(0)
    expect(reminderDue(new Date(now.getTime() - 11 * day), 1, now)).toBeNull()
    expect(reminderDue(new Date(now.getTime() - 12 * day), 1, now)).toBe(1)
    expect(reminderDue(new Date(now.getTime() - 40 * day), 2, now)).toBeNull()
  })
})
