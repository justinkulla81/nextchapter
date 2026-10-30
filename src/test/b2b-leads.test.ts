import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { bucketB2b, weekAverage } from '@/lib/outreach/b2b-leads'

const NOW = new Date('2026-10-30T18:00:00Z')
const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000)
const none = { interested: [], claims: [], statements: [], searches: [], audits: [] }

describe('bucketB2b', () => {
  it('lists the days oldest first, ending today, and counts each kind on its day', () => {
    const days = bucketB2b({ ...none, interested: [at(0), at(0), at(1)], claims: [at(1)], audits: [at(3)] }, 5, NOW)
    expect(days).toHaveLength(5)
    expect(days[4].date).toBe('2026-10-30')
    expect(days[4].bySource.interested).toBe(2)
    expect(days[3].total).toBe(2)
    expect(days[1].bySource.audits).toBe(1)
  })
  it('ignores anything outside the window', () => {
    expect(bucketB2b({ ...none, claims: [at(40)] }, 14, NOW).every((d) => d.total === 0)).toBe(true)
  })
  it('averages the seven days before today', () => {
    const days = bucketB2b({ ...none, searches: [at(0), at(0), at(0), at(2), at(2), at(3), at(4), at(5), at(6), at(7)] }, 14, NOW)
    expect(weekAverage(days)).toBeCloseTo(7 / 7, 5)
  })
})
