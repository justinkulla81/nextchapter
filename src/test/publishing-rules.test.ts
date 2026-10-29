import { describe, expect, it } from 'vitest'
import { DAILY_INDEX_LIMIT, applyFilters, dailyPicks, readFilters } from '@/lib/warn/publishing-rules'
import type { PublishingRow } from '@/lib/warn/publishing-queue'

const NOW = Date.parse('2026-10-29T12:00:00Z')
const day = 86_400_000
let n = 0
const row = (o: Partial<PublishingRow> = {}): PublishingRow => ({
  noticeId: `n${++n}`, employer: `Co ${n}`, kind: 'filing', type: 'warn', state: 'TX', summary: null, workers: 100, date: new Date(NOW - 5 * day),
  path: `/layoffs/company/co-${n}`, rssPublishedAt: null, linkedin: null, linkedinPostedAt: null, indexRequestedAt: null, xPostedAt: null, ...o,
})

describe('readFilters', () => {
  it('defaults to U.S. only, all types, push-first order', () => {
    expect(readFilters({})).toEqual({ type: 'all', where: 'us', sort: 'priority' })
    expect(readFilters({ type: 'bogus', where: 'x', sort: 'y' })).toEqual({ type: 'all', where: 'us', sort: 'priority' })
    expect(readFilters({ type: 'buyout', where: 'all', sort: 'size' })).toEqual({ type: 'buyout', where: 'all', sort: 'size' })
  })
})

describe('applyFilters', () => {
  const rows = [row({ workers: 50, type: 'warn' }), row({ workers: 25000, state: null, type: 'news' }), row({ workers: 900, type: 'buyout', kind: 'announcement' }), row({ workers: 300, type: 'news', kind: 'announcement' })]
  it('drops layoffs with no U.S. state unless asked for everywhere', () => {
    expect(applyFilters(rows, { type: 'all', where: 'us', sort: 'size' }, NOW).map((r) => r.workers)).toEqual([900, 300, 50])
    expect(applyFilters(rows, { type: 'all', where: 'all', sort: 'size' }, NOW)[0].workers).toBe(25000)
  })
  it('filters by type and sorts by size or recency', () => {
    expect(applyFilters(rows, { type: 'buyout', where: 'us', sort: 'size' }, NOW)).toHaveLength(1)
    const dated = [row({ date: new Date(NOW - 3 * day) }), row({ date: new Date(NOW - 1 * day) })]
    expect(applyFilters(dated, { type: 'all', where: 'us', sort: 'newest' }, NOW)[0].date.getTime()).toBe(NOW - 1 * day)
  })
})

describe('dailyPicks', () => {
  it('takes the largest U.S. layoffs from the last 48 hours first, then the largest remaining', () => {
    const fresh = [row({ workers: 300, date: new Date(NOW - 0.5 * day) }), row({ workers: 4000, date: new Date(NOW - 1 * day) })]
    const old = [row({ workers: 90000, date: new Date(NOW - 20 * day) })]
    const picks = dailyPicks([...old, ...fresh], 0, NOW)
    expect(picks.map((r) => r.workers)).toEqual([4000, 300, 90000])
  })
  it('skips non-U.S. and already requested pages and caps at ten minus today’s requests', () => {
    const rows = [row({ state: null, workers: 99999 }), row({ indexRequestedAt: new Date(NOW), workers: 5000 }), ...Array.from({ length: 15 }, (_, i) => row({ workers: 1000 - i }))]
    expect(dailyPicks(rows, 0, NOW)).toHaveLength(DAILY_INDEX_LIMIT)
    expect(dailyPicks(rows, 4, NOW)).toHaveLength(DAILY_INDEX_LIMIT - 4)
    expect(dailyPicks(rows, 10, NOW)).toHaveLength(0)
  })
  it('lists one page once even when two notices point at it', () => {
    const a = row({ workers: 500, path: '/layoffs/company/same' })
    const b = row({ workers: 400, path: '/layoffs/company/same' })
    expect(dailyPicks([a, b], 0, NOW)).toHaveLength(1)
  })
})
