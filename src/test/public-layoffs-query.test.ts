import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/warn/layoff-pages', () => ({ getPublicNotices: async () => [] }))

import { matchNotices, toAnswer } from '@/lib/layoffs/public-query'
import type { PublicNotice } from '@/lib/warn/layoff-pages'

const NOW = Date.parse('2026-10-30T12:00:00Z')
const day = 86_400_000
const n = (slug: string, employer: string, state: string, workers: number | null, daysAgo: number): PublicNotice => ({
  id: `${slug}-${daysAgo}`, state, employer, slug, place: null, workers, noticeDate: new Date(NOW - daysAgo * day), noticeDateKnown: true,
  fetchedAt: new Date(NOW), effectiveDate: null, type: 'Layoff', sourceUrl: 'https://example.gov/x', board: null,
})
const all = [n('comcast', 'Comcast', 'WA', 159, 1), n('comcast', 'Comcast', 'PA', 40, 20), n('walt-disney-parks-and-resorts-us', 'Walt Disney Parks & Resorts US, Inc.', 'CA', 159, 3), n('old-co', 'Old Co', 'TX', 500, 200)]

describe('matchNotices', () => {
  it('finds an employer by name or slug, within the days asked', () => {
    expect(matchNotices(all, { employer: 'Comcast', days: 30 }, NOW)).toHaveLength(2)
    expect(matchNotices(all, { employer: 'comcast', days: 5 }, NOW)).toHaveLength(1)
    expect(matchNotices(all, { employer: 'Walt Disney', days: 30 }, NOW)).toHaveLength(1)
  })
  it('filters by state and ignores notices older than the window', () => {
    expect(matchNotices(all, { state: 'wa', days: 30 }, NOW).map((x) => x.employer)).toEqual(['Comcast'])
    expect(matchNotices(all, { days: 30 }, NOW).some((x) => x.slug === 'old-co')).toBe(false)
    expect(matchNotices(all, { days: 365 }, NOW).some((x) => x.slug === 'old-co')).toBe(true)
  })
})

describe('toAnswer', () => {
  it('counts every match but returns only the limit, newest first, with the page to link to and the license', () => {
    const a = toAnswer(matchNotices(all, { days: 365 }, NOW), 2, new Date(NOW))
    expect(a.count).toBe(4)
    expect(a.totalWorkers).toBe(858)
    expect(a.notices).toHaveLength(2)
    expect(a.notices[0].employerPage).toBe('https://launchyournextchapter.com/layoffs/company/comcast')
    expect(a.license).toBe('CC BY 4.0')
  })
})
