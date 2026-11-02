import { describe, expect, it } from 'vitest'
import { FAST_QUERIES, FAST_WINDOW_HOURS, QUERIES } from '@/lib/warn/news-check'
import { cronSchedules } from '@/lib/cron/schedule'

describe('layoff news fast lane', () => {
  it('uses a small set of the full check queries, so the hourly cadence stays light on the news host', () => {
    expect(FAST_QUERIES.length).toBeLessThanOrEqual(8)
    for (const q of FAST_QUERIES) expect(QUERIES).toContain(q)
  })
  it('reads a window wider than its hourly cadence', () => {
    expect(FAST_WINDOW_HOURS).toBeGreaterThan(1)
  })
  it('is scheduled hourly, off the minutes the full check and IndexNow use', () => {
    const fast = cronSchedules().find((c) => c.job === 'layoff-news-fast')
    expect(fast?.schedule).toBe('50 * * * *')
    expect(fast?.maxGapMinutes).toBe(180)
  })
})
