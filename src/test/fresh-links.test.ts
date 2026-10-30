import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const day = 86_400_000
vi.mock('@/lib/seo/topic-data', () => ({
  getRecentNotices: async () => [
    { id: '1', state: 'TX', employer: 'Acme', slug: 'acme', workers: 100, noticeDate: new Date(Date.now() - 3 * day).toISOString() },
    { id: '2', state: 'CA', employer: 'Acme', slug: 'acme', workers: 40, noticeDate: new Date(Date.now() - 1 * day).toISOString() },
    { id: '3', state: 'NY', employer: 'Beta', slug: 'beta', workers: 500, noticeDate: new Date(Date.now() - 2 * day).toISOString() },
  ],
}))
vi.mock('@/lib/warn/company-announcements', () => ({
  getAnnouncements: async () => new Map([['tiktok', { slug: 'tiktok', name: 'TikTok', latest: new Date(Date.now() - 0.5 * day), items: [] }]]),
  hasRecentAnnouncement: () => true,
}))
vi.mock('@/lib/jobs/public-board', () => ({
  cleanPublicQuery: () => ({ q: '', loc: '', remote: false }),
  searchPublicBoardCached: async () => ({ total: 3, jobs: [
    { id: 'a', title: 'Director', company: 'X', pagePath: '/jobs/a', salaryMin: 150000, salaryMax: null },
    { id: 'b', title: 'No pay', company: 'Y', pagePath: '/jobs/b', salaryMin: null, salaryMax: null },
    { id: 'c', title: 'No page', company: 'Z', pagePath: null, salaryMin: 90000, salaryMax: 100000 },
  ] }),
}))

import { getFreshJobLinks, getFreshLayoffLinks } from '@/lib/seo/fresh-links'

describe('fresh links', () => {
  it('lists each employer once, newest first, announcements included', async () => {
    const links = await getFreshLayoffLinks()
    expect(links.map((l) => l.href)).toEqual(['/layoffs/company/tiktok', '/layoffs/company/acme', '/layoffs/company/beta'])
    expect(links[0].label).toBe('TikTok layoffs')
  })
  it('lists only jobs with a public page and stated pay', async () => {
    const links = await getFreshJobLinks()
    expect(links.map((l) => l.href)).toEqual(['/jobs/a'])
  })
})
