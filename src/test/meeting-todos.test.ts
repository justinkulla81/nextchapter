import { describe, it, expect, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
import { dueDateAfterMeeting } from '@/lib/crm/meeting-todos'

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
