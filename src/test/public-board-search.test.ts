import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

const count = vi.fn()
const findLight = vi.fn()
const findWide = vi.fn()
const limits: number[] = []
vi.mock('@/lib/prisma', () => ({
  prisma: {
    boardLightRow: { count: (...a: unknown[]) => count(...a), findMany: (...a: unknown[]) => findLight(...a) },
    exclusiveJobPosting: { findMany: (...a: unknown[]) => findWide(...a) },
  },
}))
vi.mock('@/lib/db/statement-timeout', () => ({
  withStatementTimeout: (q: Promise<unknown>, ms?: number) => {
    limits.push(ms ?? -1)
    return q
  },
}))
vi.mock('@/lib/jobs/job-dismiss-server', () => ({ getConfirmedGhostIds: async () => new Set<string>() }))
vi.mock('@/lib/jobs/public-job-page', () => ({ isPublicJob: () => true, isStaleVerified: () => false }))
vi.mock('@/lib/jobs/public-job-page-server', () => ({ PUBLIC_JOB_SELECT: {} }))
vi.mock('@/lib/seo/topics', () => ({ industryRawValues: () => [] }))

import { searchPublicBoard } from '@/lib/jobs/public-board'

const light = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `j${i}`, title: `Role ${i}`, companyName: 'Acme', location: 'Louisville, KY', postedAt: new Date('2026-11-01'), createdAt: new Date('2026-11-01'), salaryMin: null, salaryMax: null }))

beforeEach(() => {
  count.mockReset()
  findLight.mockReset()
  findWide.mockReset()
  limits.length = 0
  findWide.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id) => ({ id, url: `https://x/${id}`, lastVerifiedAt: new Date(), disclosure: 'OPEN' })))
})

describe('public board search', () => {
  it('counts and reads the board, each with a database time limit', async () => {
    count.mockResolvedValue(4573)
    findLight.mockResolvedValue(light(12))
    const result = await searchPublicBoard({ q: '', loc: ', KY', remote: false })
    expect(count).toHaveBeenCalledTimes(1)
    expect(findLight).toHaveBeenCalledTimes(1)
    expect(limits).toEqual([10_000, 10_000])
    expect(result.jobs).toHaveLength(12)
    expect(result.total).toBeGreaterThan(0)
  })

  it('skips the count query when the caller only wants the jobs (the saved-search alerts)', async () => {
    findLight.mockResolvedValue(light(5))
    const result = await searchPublicBoard({ q: 'analyst', loc: '', remote: false, skipTotal: true })
    expect(count).not.toHaveBeenCalled()
    expect(limits).toEqual([10_000])
    expect(result.total).toBe(0)
    expect(result.jobs).toHaveLength(5)
  })

  it('lets a read that cannot finish fail instead of answering with nothing', async () => {
    count.mockResolvedValue(1)
    findLight.mockRejectedValue(new Error('canceling statement due to statement timeout'))
    await expect(searchPublicBoard({ q: '', loc: ', KY', remote: false })).rejects.toThrow('statement timeout')
  })
})
