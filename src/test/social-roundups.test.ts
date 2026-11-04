import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const notices = vi.hoisted(() => ({ rows: [] as unknown[] }))
vi.mock('@/lib/warn/layoff-pages', () => ({ getPublicNotices: async () => notices.rows }))
vi.mock('@/lib/rankings/store', () => ({ readRankingIndex: async () => [] }))
const report = vi.hoisted(() => ({ value: null as unknown }))
vi.mock('@/lib/reports', () => ({ latestReport: () => report.value }))

const fresh = (state: string, workers: number, at: Date) => ({ state, workers, fetchedAt: at, noticeDate: at, noticeDateKnown: true })

describe('dueRoundup', () => {
  beforeEach(() => { notices.rows = []; report.value = null })

  it('waits for 13:00 UTC before the notice roundups, and posts the daily one as plain text with the channel link', async () => {
    const { dueRoundup } = await import('@/lib/social/roundups')
    const at = new Date('2026-11-10T13:20:00Z')
    notices.rows = [fresh('CA', 200, at), fresh('CA', 50, at), fresh('WA', 100, at)].map((r) => ({ ...r, fetchedAt: new Date(at.getTime() - 3_600_000) }))
    expect(await dueRoundup(new Date('2026-11-10T11:00:00Z'), () => false)).toBeNull()
    const f = (await dueRoundup(at, () => false))!
    expect(f.key).toBe('layoffs-day-2026-11-10')
    expect(f.plain).toBe(true)
    expect(f.topic).toBe('roundup')
    const text = f.fallback('https://launchyournextchapter.com/layoffs/this-week?utm_source=bluesky&utm_medium=social&utm_campaign=daily-layoffs', false)
    expect(text).toContain('350 more people found out they are losing their jobs in the last 24 hours, in 2 states')
    expect(text).toContain('utm_source=bluesky')
  })

  it('does not repeat a roundup a channel already has, including one the old daily job posted', async () => {
    const { dueRoundup } = await import('@/lib/social/roundups')
    const at = new Date('2026-11-11T14:00:00Z')
    notices.rows = [fresh('CA', 200, at), fresh('CA', 50, at), fresh('WA', 100, at)].map((r) => ({ ...r, fetchedAt: new Date(at.getTime() - 3_600_000) }))
    expect(await dueRoundup(at, (k) => k === 'layoffs-day-2026-11-11')).toBeNull()
  })

  it('announces a fresh report edition once, tagging what it cites', async () => {
    const { dueRoundup } = await import('@/lib/social/roundups')
    report.value = { slug: 'white-collar-employment-report-october-2026', month: 'October 2026', title: 'Long searches are getting longer', publishedAt: '2026-11-09', cites: ['nber'] }
    const f = (await dueRoundup(new Date('2026-11-10T15:00:00Z'), () => false))!
    expect(f.key).toBe('report-white-collar-employment-report-october-2026')
    expect(f.cites).toEqual(['nber'])
    expect(f.fallback('https://launchyournextchapter.com/reports/x?utm_source=x', true)).toContain('October 2026')
    expect(await dueRoundup(new Date('2026-11-10T15:00:00Z'), (k) => k.startsWith('report-'))).toBeNull()
  })

  it('does not look again for an hour after a quiet day', async () => {
    const { dueRoundup } = await import('@/lib/social/roundups')
    const at = new Date('2026-11-12T13:05:00Z')
    notices.rows = [fresh('CA', 10, at)] // fewer than the daily minimum
    expect(await dueRoundup(at, () => false)).toBeNull()
    notices.rows = [fresh('CA', 200, at), fresh('CA', 50, at), fresh('WA', 100, at)].map((r) => ({ ...r, fetchedAt: new Date(at.getTime() - 3_600_000) }))
    expect(await dueRoundup(new Date('2026-11-12T13:30:00Z'), () => false)).toBeNull() // still inside the hour
    expect(await dueRoundup(new Date('2026-11-12T14:10:00Z'), () => false)).not.toBeNull()
  })
})
