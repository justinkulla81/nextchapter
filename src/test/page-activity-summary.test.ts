import { describe, it, expect } from 'vitest'
import { computePageActivitySummary, formatDuration } from '@/lib/admin/page-activity-summary'

const MIN = 60_000

describe('computePageActivitySummary', () => {
  it('attributes the gap between consecutive page views to the earlier page', () => {
    const summary = computePageActivitySummary([
      { eventType: 'PAGE_VIEW', path: '/dashboard', createdAt: new Date('2026-08-20T10:00:00Z') },
      { eventType: 'PAGE_VIEW', path: '/dashboard/network', createdAt: new Date('2026-08-20T10:05:00Z') },
    ])

    const dashboard = summary.byPage.find((p) => p.path === '/dashboard')
    expect(dashboard?.visits).toBe(1)
    expect(dashboard?.totalMs).toBe(5 * MIN)

    // The last page view in the whole set has no known duration yet — never
    // attributed a fabricated gap.
    const network = summary.byPage.find((p) => p.path === '/dashboard/network')
    expect(network?.totalMs).toBe(0)
  })

  it('does not attribute a gap past the session-timeout threshold (they left, not read for 3 hours)', () => {
    const summary = computePageActivitySummary([
      { eventType: 'PAGE_VIEW', path: '/dashboard', createdAt: new Date('2026-08-20T10:00:00Z') },
      { eventType: 'PAGE_VIEW', path: '/dashboard/network', createdAt: new Date('2026-08-20T13:00:00Z') },
    ])

    const dashboard = summary.byPage.find((p) => p.path === '/dashboard')
    expect(dashboard?.totalMs).toBe(0)
  })

  it('excludes LINK_CLICK rows and null-path rows from the summary entirely', () => {
    const summary = computePageActivitySummary([
      { eventType: 'PAGE_VIEW', path: '/dashboard', createdAt: new Date('2026-08-20T10:00:00Z') },
      { eventType: 'LINK_CLICK', path: null, createdAt: new Date('2026-08-20T10:02:00Z') },
      { eventType: 'PAGE_VIEW', path: null, createdAt: new Date('2026-08-20T10:03:00Z') },
      { eventType: 'PAGE_VIEW', path: '/dashboard/network', createdAt: new Date('2026-08-20T10:05:00Z') },
    ])

    expect(summary.byPage.map((p) => p.path)).toEqual(['/dashboard', '/dashboard/network'])
    // The null-path PAGE_VIEW row is dropped entirely, so the gap counted
    // toward /dashboard runs straight through to the next REAL page view.
    const dashboard = summary.byPage.find((p) => p.path === '/dashboard')
    expect(dashboard?.totalMs).toBe(5 * MIN)
  })

  it('sums repeat visits to the same page across the whole window', () => {
    const summary = computePageActivitySummary([
      { eventType: 'PAGE_VIEW', path: '/dashboard', createdAt: new Date('2026-08-20T10:00:00Z') },
      { eventType: 'PAGE_VIEW', path: '/dashboard/network', createdAt: new Date('2026-08-20T10:02:00Z') },
      { eventType: 'PAGE_VIEW', path: '/dashboard', createdAt: new Date('2026-08-20T10:10:00Z') },
      { eventType: 'PAGE_VIEW', path: '/dashboard/network', createdAt: new Date('2026-08-20T10:13:00Z') },
    ])

    const dashboard = summary.byPage.find((p) => p.path === '/dashboard')
    expect(dashboard?.visits).toBe(2)
    expect(dashboard?.totalMs).toBe(2 * MIN + 3 * MIN)
  })

  it('groups by ET calendar day and orders most-recent-first', () => {
    const summary = computePageActivitySummary([
      { eventType: 'PAGE_VIEW', path: '/dashboard', createdAt: new Date('2026-08-20T15:00:00Z') },
      { eventType: 'PAGE_VIEW', path: '/dashboard', createdAt: new Date('2026-08-20T15:10:00Z') },
      { eventType: 'PAGE_VIEW', path: '/dashboard', createdAt: new Date('2026-08-21T15:00:00Z') },
    ])

    expect(summary.byDay.map((d) => d.dateKey)).toEqual(['2026-08-21', '2026-08-20'])
    expect(summary.byDay.find((d) => d.dateKey === '2026-08-20')?.pageViews).toBe(2)
  })

  it('handles an empty event list', () => {
    expect(computePageActivitySummary([])).toEqual({ byPage: [], byDay: [] })
  })
})

describe('formatDuration', () => {
  it('formats sub-minute durations as <1m', () => {
    expect(formatDuration(30_000)).toBe('<1m')
  })

  it('formats minutes-only durations', () => {
    expect(formatDuration(5 * MIN)).toBe('5m')
  })

  it('formats hour-plus durations with both units', () => {
    expect(formatDuration(90 * MIN)).toBe('1h 30m')
  })
})
