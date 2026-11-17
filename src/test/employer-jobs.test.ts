import { describe, expect, it } from 'vitest'
import { REASON_MAX, cleanReason, declineBlocked, employerRoleStatusLabel, hoursWaiting, waitedLabel } from '@/lib/workforce/employer-jobs'

describe('employer jobs', () => {
  it('tells the employer where its job is', () => {
    expect(employerRoleStatusLabel('org_pending', 'One Louisville')).toBe('Waiting for One Louisville to review')
    expect(employerRoleStatusLabel('pending', 'One Louisville')).toBe('In review at NextChapter')
    expect(employerRoleStatusLabel('approved', 'x')).toBe('Live')
    expect(employerRoleStatusLabel('rejected', 'x')).toBe('Not approved')
  })
  it('a decline needs a reason, cleaned and capped', () => {
    expect(declineBlocked('   ')).toMatch(/Say why/)
    expect(declineBlocked('Link goes to a general careers page')).toBeNull()
    expect(cleanReason('a\n  b')).toBe('a b')
    expect(cleanReason('x'.repeat(500))).toHaveLength(REASON_MAX)
  })
  it('says how long a job has waited', () => {
    const now = new Date('2026-11-20T12:00:00Z')
    expect(waitedLabel(hoursWaiting(new Date('2026-11-20T03:00:00Z'), now))).toBe('today')
    expect(waitedLabel(hoursWaiting(new Date('2026-11-19T11:00:00Z'), now))).toBe('1 day ago')
    expect(waitedLabel(hoursWaiting(new Date('2026-11-15T12:00:00Z'), now))).toBe('5 days ago')
  })
})
