import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const findMany = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    companyWatchlistEntry: { findMany: vi.fn(async () => [{ id: 'w1', companyName: "Macy's Inc", lastViewedAt: new Date(0), createdAt: new Date(0) }]) },
    exclusiveJobPosting: { findMany: (...a: unknown[]) => findMany(...a) },
    surfacedJob: { findMany: vi.fn(async () => []) },
    candidateProfile: { findUnique: vi.fn(async () => null) },
  },
}))
vi.mock('@/lib/likely-openings/for-companies', () => ({ getLikelyOpeningsForCompanies: vi.fn(async () => new Map()) }))
vi.mock('@/lib/notify/follow-alert-server', () => ({ notifyOwnerOfFollow: vi.fn() }))
vi.mock('@/lib/market/adzuna-insights', () => ({ isAdzunaInsightsEnabled: () => false, getTopHiringCompanies: vi.fn(), memberMarketRole: vi.fn(), resolveState: vi.fn() }))

import { companyNameProbe, getWatchlistView } from '@/lib/company-tracker/watchlist'

describe('companyNameProbe', () => {
  it('takes the first word as a posting name would contain it', () => {
    expect(companyNameProbe("Macy's Inc")).toBe('macy')
    expect(companyNameProbe('The Home Depot')).toBe('home')
    expect(companyNameProbe('AT&T')).toBe('at&t')
    expect(companyNameProbe('  ')).toBe('')
  })
})

describe('getWatchlistView', () => {
  beforeEach(() => findMany.mockReset())

  it('reads only the watched company, bounded, and keeps exact name matches', async () => {
    const at = new Date(1)
    findMany.mockResolvedValue([
      { id: 'a', title: 'Buyer', companyName: 'Macys', location: null, url: 'u', createdAt: at },
      { id: 'b', title: 'Analyst', companyName: 'Macy Group Holdings Partners', location: null, url: 'u', createdAt: at },
    ])
    const view = await getWatchlistView('c1')
    const where = findMany.mock.calls[0][0]
    expect(where.where.companyName).toEqual({ contains: 'macy', mode: 'insensitive' })
    expect(where.take).toBeGreaterThan(0)
    expect(view[0].visiblePostings.map((p) => p.id)).toEqual(['a'])
  })
})
