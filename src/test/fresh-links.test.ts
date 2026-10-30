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
vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn }))
vi.mock('@/lib/db/heavy', () => ({ heavy: (fn: () => unknown) => fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: async () => [{ id: 'a', title: 'Director', companyName: 'X' }, { id: 'b', title: 'Manager', companyName: 'Y' }] } }))
vi.mock('@/lib/jobs/public-job-page', () => ({ PUBLIC_JOB_MIN_INDEX_DESCRIPTION: 1500 }))
vi.mock('@/lib/jobs/public-job-page-server', () => ({ PUBLIC_JOB_STATIC_SQL: '', PUBLIC_JOB_LIVE_SQL: '', PUBLIC_JOB_OFFERED_SQL: '' }))

import { getFreshJobLinks, getFreshLayoffLinks } from '@/lib/seo/fresh-links'

describe('fresh links', () => {
  it('lists each employer once, newest first, announcements included', async () => {
    const links = await getFreshLayoffLinks()
    expect(links.map((l) => l.href)).toEqual(['/layoffs/company/tiktok', '/layoffs/company/acme', '/layoffs/company/beta'])
    expect(links[0].label).toBe('TikTok layoffs')
  })
  it('links the newest jobs the sitemap offers, to their own pages', async () => {
    const links = await getFreshJobLinks()
    expect(links.map((l) => l.href)).toEqual(['/jobs/a', '/jobs/b'])
    expect(links[0].label).toBe('Director, X')
  })
})
