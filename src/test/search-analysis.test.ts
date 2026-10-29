import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { QUERY_GROUPS } from '@/lib/seo/query-groups'
import {
  aggregatePages,
  aggregateQueries,
  csvCell,
  groupStats,
  nearMisses,
  pageTwoQueries,
  pctChange,
  perfWindows,
  sumRows,
  toCsv,
  type PerfRow,
} from '@/lib/seo/search-analysis'
import { SearchQueriesView } from '@/components/admin/SearchQueriesView'
import type { SearchPerformanceResult } from '@/lib/google/search-performance'

const row = (query: string, page: string, clicks: number, impressions: number, position: number): PerfRow => ({ query, page, clicks, impressions, position })
const BASE = 'https://launchyournextchapter.com'

describe('perfWindows', () => {
  it('ends two days back and compares with the window of the same length right before', () => {
    const { current, previous } = perfWindows(7, new Date('2026-10-28T15:00:00Z'))
    expect(current).toEqual({ startDate: '2026-10-20', endDate: '2026-10-26' })
    expect(previous).toEqual({ startDate: '2026-10-13', endDate: '2026-10-19' })
  })
})

describe('aggregation', () => {
  const rows = [
    row('cobra vs aca', `${BASE}/resources/cobra-aca`, 0, 60, 14),
    row('cobra vs aca', `${BASE}/resources/cobra-aca/texas`, 0, 20, 10),
    row('hbo communications coordinator', `${BASE}/jobs/abc`, 1, 45, 6),
  ]
  const prev = [row('cobra vs aca', `${BASE}/resources/cobra-aca`, 0, 40, 15)]

  it('weights the average position by impressions and keeps the busiest landing page', () => {
    const q = aggregateQueries(rows, prev).find((x) => x.query === 'cobra vs aca')!
    expect(q.impressions).toBe(80)
    expect(q.position).toBeCloseTo((14 * 60 + 10 * 20) / 80, 5)
    expect(q.topPage).toBe(`${BASE}/resources/cobra-aca`)
    expect(q.pages).toBe(2)
    expect(q.prevImpressions).toBe(40)
  })

  it('sorts by clicks then impressions', () => {
    expect(aggregateQueries(rows).map((q) => q.query)).toEqual(['hbo communications coordinator', 'cobra vs aca'])
  })

  it('sums pages and carries the previous window', () => {
    const p = aggregatePages(rows, prev).find((x) => x.page.endsWith('/resources/cobra-aca'))!
    expect(p.impressions).toBe(60)
    expect(p.prevImpressions).toBe(40)
  })

  it('computes totals and a change that is null with nothing before', () => {
    expect(sumRows(rows)).toMatchObject({ clicks: 1, impressions: 125 })
    expect(pctChange(60, 40)).toBeCloseTo(0.5)
    expect(pctChange(5, 0)).toBeNull()
  })
})

describe('near misses and page two', () => {
  const rows = [
    row('seen not clicked', '/a', 0, 10, 4),
    row('seen a little', '/b', 0, 2, 5),
    row('clicked', '/c', 2, 30, 3),
    row('page two', '/d', 0, 8, 12),
    row('way down', '/e', 0, 9, 40),
    row('edge low', '/f', 0, 4, 8),
    row('edge high', '/g', 0, 4, 20),
    row('just above', '/h', 0, 4, 7.9),
  ]
  const qs = aggregateQueries(rows)

  it('lists zero-click searches seen at least 3 times, most seen first', () => {
    expect(nearMisses(qs).map((q) => q.query)).toEqual(['seen not clicked', 'way down', 'page two', 'just above', 'edge low', 'edge high'])
  })

  it('lists searches at position 8 to 20 inclusive with enough impressions', () => {
    expect(pageTwoQueries(qs).map((q) => q.query)).toEqual(['page two', 'edge low', 'edge high'])
  })
})

describe('query groups', () => {
  const find = (key: string) => QUERY_GROUPS.find((g) => g.key === key)!
  const hit = (key: string, query: string, page = '/') => find(key).matches({ query, page })

  it('matches the cobra and aca spellings people use', () => {
    for (const q of ['cobra vs aca', 'cobra or obamacare', 'is aca cheaper than cobra in texas', 'cobra and the affordable care act']) expect(hit('cobra-aca', q)).toBe(true)
    expect(hit('cobra-aca', 'cobra kai season 6')).toBe(true) // a known false positive: the word cobra alone; the owner can tighten the rule
  })

  it('matches the other clusters by term or by landing page', () => {
    expect(hit('severance', 'is severance taxed')).toBe(true)
    expect(hit('unemployment', 'how to file for unemployment in ny')).toBe(true)
    expect(hit('layoffs-warn', 'warn act 60 days')).toBe(true)
    expect(hit('layoffs-warn', 'layoff risk assessment')).toBe(true)
    expect(hit('ai-skills-pay', 'ai skills salary premium')).toBe(true)
    expect(hit('salary', 'project lead salary')).toBe(true)
    expect(hit('jobs-city', 'marketing jobs jacksonville fl')).toBe(true)
    expect(hit('employers', 'carvana fairfield ct', `${BASE}/employers/carvana`)).toBe(true)
    expect(hit('employers', 'carvana fairfield ct', `${BASE}/jobs/abc`)).toBe(false)
  })

  it('counts rows that match no group under "Everything else" and lets a row sit in two groups', () => {
    const rows = [row('cobra vs aca', `${BASE}/resources/cobra-aca`, 1, 10, 5), row('severance cobra', '/x', 0, 5, 9), row('something unrelated', '/y', 0, 4, 30)]
    const stats = groupStats(rows, [])
    const by = Object.fromEntries(stats.map((s) => [s.key, s]))
    expect(by['cobra-aca'].impressions).toBe(15)
    expect(by['severance'].impressions).toBe(5)
    expect(by['other'].impressions).toBe(4)
  })
})

describe('csv', () => {
  it('quotes text and defuses spreadsheet formulas', () => {
    expect(csvCell('=SUM(A1)')).toBe(`"'=SUM(A1)"`)
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell(3.5)).toBe('3.5')
    expect(toCsv(['a', 'b'], [['x', 1]])).toBe('a,b\n"x",1')
  })
})

describe('SearchQueriesView', () => {
  const ok: SearchPerformanceResult = {
    status: 'ok',
    siteUrl: 'sc-domain:launchyournextchapter.com',
    days: 28,
    current: { startDate: '2026-09-29', endDate: '2026-10-26' },
    previous: { startDate: '2026-09-01', endDate: '2026-09-28' },
    rows: [row('cobra vs aca', `${BASE}/resources/cobra-aca`, 0, 71, 12), row('piper maddox chicago', `${BASE}/employers/piper`, 1, 7, 6)],
    prevRows: [row('cobra vs aca', `${BASE}/resources/cobra-aca`, 0, 40, 15)],
    totals: { clicks: 1, impressions: 90, ctr: 1 / 90, position: 11 },
    prevTotals: { clicks: 0, impressions: 40, ctr: 0, position: 15 },
    truncated: false,
  }
  const html = (r: SearchPerformanceResult, days: 7 | 28 | 90 = 28) => renderToStaticMarkup(createElement(SearchQueriesView, { result: r, days }))

  it('shows totals, the near miss, the page-two search and the groups', () => {
    const out = html(ok)
    expect(out).toContain('Search queries')
    expect(out).toContain('cobra vs aca')
    expect(out).toContain('Seen but never clicked')
    expect(out).toContain('Page-two searches')
    expect(out).toContain('COBRA vs ACA')
    expect(out).toContain('/api/admin/search-queries/export?days=28&amp;table=queries')
    expect(out).toContain('+31 (+78%)') // impressions 71 vs 40
    expect(out).toContain('4.0 places better')
  })

  it('shows a plain not-connected state with a connect link and no table', () => {
    const out = html({ status: 'not_connected' })
    expect(out).toContain('No Google account is connected yet')
    expect(out).toContain('/api/google/oauth/start?from=/support/admin/search-queries')
    expect(out).not.toContain('Seen but never clicked')
  })

  it('explains a reconnect, a missing property and an error without a stack trace', () => {
    expect(html({ status: 'needs_reconnect', reason: 'api_disabled', detail: 'a@b.c: disabled' })).toContain('not switched on')
    expect(html({ status: 'no_site', sites: ['https://other.com/'] })).toContain('https://other.com/')
    const err = html({ status: 'error', message: 'Google said boom' })
    expect(err).toContain('could not be read right now')
    expect(err).not.toContain('at async')
  })

  it('says so when the window is empty', () => {
    const empty = html({ ...ok, rows: [], prevRows: [], totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, prevTotals: { clicks: 0, impressions: 0, ctr: 0, position: 0 } })
    expect(empty).toContain('Google reported no impressions')
    expect(empty).toContain('No searches in this window.')
  })

  it('marks the chosen window', () => {
    expect(html(ok, 7)).toContain('aria-current="true"')
  })
})
