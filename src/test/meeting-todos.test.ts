import { describe, it, expect, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
import { dueDateAfterMeeting, dueDateFor } from '@/lib/crm/meeting-todos'

describe('dueDateAfterMeeting', () => {
  it('is two days later on a weekday', () => {
    expect(dueDateAfterMeeting(new Date('2026-10-12T15:00:00Z'))).toBe('2026-10-14') // Mon -> Wed
  })
  it('moves a Saturday to Monday', () => {
    expect(dueDateAfterMeeting(new Date('2026-10-15T15:00:00Z'))).toBe('2026-10-19') // Thu -> Sat -> Mon
  })
  it('moves a Sunday to Monday', () => {
    expect(dueDateAfterMeeting(new Date('2026-10-16T15:00:00Z'))).toBe('2026-10-19') // Fri -> Sun -> Mon
  })
})

describe('dueDateFor', () => {
  it('keeps the normal date when it is still ahead', () => {
    expect(dueDateFor(new Date('2026-10-12T15:00:00Z'), new Date('2026-10-13T12:00:00Z'))).toBe('2026-10-14')
  })
  it('moves a date that has passed to the next business day', () => {
    // Meeting Tue Oct 13 -> normal Thu Oct 15, but it is already Fri Oct 23 -> Mon Oct 26 (Sat skipped).
    expect(dueDateFor(new Date('2026-10-13T18:00:00Z'), new Date('2026-10-23T16:00:00Z'))).toBe('2026-10-26')
  })
})
