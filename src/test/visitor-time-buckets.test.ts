import { describe, expect, it } from 'vitest'
import { allTimeDayCount, byHourOfDay, byWeekday, perDaySeries, perHourSeries } from '@/lib/admin/visitor-time-buckets'
import { classifyForbidden } from '@/lib/google/search-console'

const HUMAN = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'
const ev = (iso: string, ip: string, userAgent: string | null = HUMAN) => ({ createdAt: new Date(iso), userAgent, ip, eventType: 'PAGE_VIEW' })

// Mon 2026-10-26 20:00 ET = 2026-10-27T00:00Z (EDT, UTC-4).
const NOW = new Date('2026-10-27T01:00:00Z') // Mon 9 PM ET

describe('visitor time buckets', () => {
  it('buckets by ET hour and dedupes unique visitors by IP', () => {
    const events = [ev('2026-10-27T00:10:00Z', 'a'), ev('2026-10-27T00:20:00Z', 'a'), ev('2026-10-27T00:30:00Z', 'b')]
    const views = perHourSeries(events, NOW, 24, false)
    const uniques = perHourSeries(events, NOW, 24, true)
    expect(views).toHaveLength(24)
    expect(views.at(-2)).toEqual({ key: '2026-10-26 20', count: 3 })
    expect(uniques.at(-2)).toEqual({ key: '2026-10-26 20', count: 2 })
  })

  it('ignores bots and zero-fills days', () => {
    const days = perDaySeries([ev('2026-10-26T15:00:00Z', 'a'), ev('2026-10-26T15:00:00Z', 'b', 'Googlebot/2.1')], NOW, 7, false)
    expect(days).toHaveLength(7)
    expect(days.at(-1)).toEqual({ key: '2026-10-26', count: 1 })
    expect(days[0].count).toBe(0)
  })

  it('averages per occurrence of each weekday', () => {
    const w = byWeekday([ev('2026-10-26T15:00:00Z', 'a'), ev('2026-10-19T15:00:00Z', 'a')], NOW, 14, false)
    expect(w[0]).toEqual({ label: 'Monday', average: 1 })
    expect(w[1].average).toBe(0)
  })

  it('splits hour-of-day into weekday and weekend', () => {
    const events = [ev('2026-10-26T15:00:00Z', 'a'), ev('2026-10-24T15:00:00Z', 'a')] // Mon 11 AM, Sat 11 AM ET
    const weekday = byHourOfDay(events, NOW, 14, false, 'weekday')
    const weekend = byHourOfDay(events, NOW, 14, false, 'weekend')
    expect(weekday[11].average).toBeCloseTo(1 / 10)
    expect(weekend[11].average).toBeCloseTo(1 / 4)
  })
})

describe('all time', () => {
  it('starts at the first human page view and counts both end days', () => {
    // First human view Sat 2026-09-26 ET; NOW is Mon 2026-10-26 ET: 30 days apart, 31 days inclusive.
    const events = [ev('2026-09-26T15:00:00Z', 'a'), ev('2026-10-26T15:00:00Z', 'b')]
    expect(allTimeDayCount(events, NOW)).toBe(31)
    const days = perDaySeries(events, NOW, allTimeDayCount(events, NOW), false)
    expect(days).toHaveLength(31)
    expect(days[0]).toEqual({ key: '2026-09-26', count: 1 })
    expect(days.at(-1)).toEqual({ key: '2026-10-26', count: 1 })
  })

  it('ignores bots when finding the first visit, and never goes under the minimum', () => {
    const events = [ev('2026-01-01T15:00:00Z', 'a', 'Googlebot/2.1'), ev('2026-10-25T15:00:00Z', 'b')]
    expect(allTimeDayCount(events, NOW)).toBe(30)
    expect(allTimeDayCount([], NOW)).toBe(30)
  })

  it('reaches past a year without dropping the oldest day', () => {
    const events = [ev('2025-07-04T15:00:00Z', 'a')]
    const n = allTimeDayCount(events, NOW)
    expect(n).toBeGreaterThan(365)
    expect(perDaySeries(events, NOW, n, false)[0]).toEqual({ key: '2025-07-04', count: 1 })
  })
})

describe('classifyForbidden', () => {
  it('tells a disabled API from a missing scope', () => {
    expect(classifyForbidden(403, '{"error":{"status":"PERMISSION_DENIED","message":"Google Search Console API has not been used in project 123 before or it is disabled."}}')).toBe('api_disabled')
    expect(classifyForbidden(403, '{"error":{"message":"Request had insufficient authentication scopes."}}')).toBe('scope_missing')
    expect(classifyForbidden(403, '{"error":{"message":"User does not have sufficient permission for site"}}')).toBe('no_permission')
  })
})

import { searchTermsCsv } from '@/lib/google/search-console'

describe('searchTermsCsv', () => {
  it('quotes terms and defuses spreadsheet formulas', () => {
    const csv = searchTermsCsv([
      { query: 'cfo jobs, houston', clicks: 1, impressions: 20, ctr: 0.05, position: 3.26 },
      { query: '=HYPERLINK("x")', clicks: 0, impressions: 2, ctr: 0, position: 11 },
    ])
    expect(csv.split('\n')[0]).toBe('query,clicks,impressions,ctr_percent,avg_position')
    expect(csv).toContain('"cfo jobs, houston",1,20,5.00,3.3')
    expect(csv).toContain(`"'=HYPERLINK(""x"")",0,2,0.00,11.0`)
  })
})
