import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
  it('shares the layoff-news cron, which runs hourly, and the project stays within the 100 crons Vercel allows', () => {
    const all = cronSchedules()
    const news = all.find((c) => c.job === 'layoff-news')
    expect(news?.schedule).toBe('20 * * * *')
    expect(news?.maxGapMinutes).toBe(180)
    // Vercel's limit is on the cron entries in vercel.json; bundled jobs share an entry, so count those (not the jobs inside them).
    const entries = (JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as { crons: unknown[] }).crons.length
    expect(entries).toBeLessThanOrEqual(100)
    expect(all.length).toBeGreaterThanOrEqual(entries)
  })
})
