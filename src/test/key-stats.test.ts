import { describe, expect, it } from 'vitest'
import { buildKeyStats, isJobsSectionPath, isReportsPath, nonJobsShare } from '@/lib/admin/key-stats'

const HUMAN = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'
const day = (d: Date) => d.toISOString().slice(0, 10)
const ev = (iso: string, ip: string, path: string, country: string | null = null, userAgent = HUMAN) => ({
  createdAt: new Date(iso),
  ip,
  path,
  userAgent,
  country,
})

describe('key stats', () => {
  it('classifies jobs and reports paths', () => {
    expect(isJobsSectionPath('/jobs')).toBe(true)
    expect(isJobsSectionPath('/jobs/abc?x=1')).toBe(true)
    expect(isJobsSectionPath('/reports')).toBe(false)
    expect(isReportsPath('/reports/early-warning')).toBe(true)
    expect(isReportsPath('/reportsfoo')).toBe(false)
  })

  it('rolls events up per day', () => {
    const rows = buildKeyStats(
      [
        ev('2026-10-27T15:00:00Z', '1.1.1.1', '/', 'US'),
        ev('2026-10-27T15:01:00Z', '1.1.1.1', '/jobs/a', 'US'),
        ev('2026-10-27T15:02:00Z', '1.1.1.1', '/jobs/a', 'US'),
        ev('2026-10-27T16:00:00Z', '2.2.2.2', '/reports', 'GB'),
        ev('2026-10-27T16:00:00Z', '3.3.3.3', '/', null),
        ev('2026-10-27T16:00:00Z', '4.4.4.4', '/', 'DE', 'Googlebot/2.1'),
      ],
      { dayKey: day, dateKeys: ['2026-10-26', '2026-10-27'] }
    )
    expect(rows[0].visitors).toBe(0)
    const d = rows[1]
    expect(d).toMatchObject({
      visitors: 3,
      homepageVisitors: 2,
      reportsVisitors: 1,
      jobsViews: 2,
      nonJobsViews: 3,
      jobsPages: 1,
      nonJobsPages: 2,
      usVisitors: 1,
      internationalVisitors: 1,
      unknownCountryVisitors: 1,
    })
    expect(nonJobsShare(d)).toBeCloseTo(0.6)
    expect(nonJobsShare(rows[0])).toBeNull()
  })
})
