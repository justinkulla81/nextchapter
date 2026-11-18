import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

const findLight = vi.fn()
const countLight = vi.fn()
const findWide = vi.fn()
const limits: number[] = []
const scanOpts: ({ noIndexScan?: boolean } | undefined)[] = []
vi.mock('@/lib/prisma', () => ({
  prisma: {
    boardLightRow: { findMany: (...a: unknown[]) => findLight(...a), count: (...a: unknown[]) => countLight(...a) },
    exclusiveJobPosting: { findMany: (...a: unknown[]) => findWide(...a) },
  },
}))
vi.mock('@/lib/db/statement-timeout', () => ({
  withStatementTimeout: (q: Promise<unknown>, ms?: number, opts?: { noIndexScan?: boolean }) => {
    limits.push(ms ?? -1)
    scanOpts.push(opts)
    return q
  },
}))
vi.mock('@/lib/jobs/job-dismiss-server', () => ({ getConfirmedGhostIds: async () => new Set<string>() }))
vi.mock('@/lib/jobs/public-job-page', () => ({ isPublicJob: () => true, isStaleVerified: () => false }))
vi.mock('@/lib/jobs/public-job-page-server', () => ({ PUBLIC_JOB_LIST_SELECT: {}, withDescriptionStubs: async <T,>(rows: T[]) => rows }))
vi.mock('@/lib/seo/topics', () => ({ industryRawValues: () => [] }))

import { COUNT_CAP, searchPublicBoard } from '@/lib/jobs/public-board'

// What the count reads: each match's id and its two dates (the page is cut from it when it is complete).
const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, postedAt: new Date(Date.UTC(2026, 10, 1) + i * 60_000), createdAt: new Date('2026-11-01') }))
const light = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `j${i}`, title: `Role ${i}`, companyName: 'Acme', location: 'Louisville, KY', postedAt: new Date('2026-11-01'), createdAt: new Date('2026-11-01'), salaryMin: null, salaryMax: null }))

beforeEach(() => {
  findLight.mockReset()
  countLight.mockReset()
  findWide.mockReset()
  limits.length = 0
  scanOpts.length = 0
  findWide.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id) => ({ id, url: `https://x/${id}`, lastVerifiedAt: new Date(), disclosure: 'OPEN' })))
})

describe('public board search', () => {
  it('counts (up to the cap) and reads the board, each with a database time limit', async () => {
    countLight.mockResolvedValueOnce(COUNT_CAP + 1)
    findLight.mockResolvedValueOnce(light(12))
    const result = await searchPublicBoard({ q: '', loc: ', KY', remote: false })
    expect(countLight).toHaveBeenCalledTimes(1)
    expect(findLight).toHaveBeenCalledTimes(1)
    expect(limits).toEqual([10_000, 10_000])
    expect(result.jobs).toHaveLength(12)
  })

  it('stops counting at the cap and says the count is capped, never a number it did not count', async () => {
    countLight.mockResolvedValueOnce(COUNT_CAP + 1)
    findLight.mockResolvedValueOnce(light(12))
    const result = await searchPublicBoard({ q: '', loc: ', KY', remote: false })
    const countCall = countLight.mock.calls[0][0]
    expect(countCall.take).toBe(COUNT_CAP + 1)
    expect(countCall.skip).toBeUndefined()
    // A count (no ORDER BY, so it stops at the cap) with plain index scans off: ordered, it walked the date index row by row (#12).
    expect(countCall.orderBy).toBeUndefined()
    expect(scanOpts[0]).toEqual({ noIndexScan: true })
    // Over the cap, the page comes off the date index.
    expect(findLight.mock.calls[0][0].orderBy).toBeDefined()
    expect(scanOpts[1]?.noIndexScan).toBeUndefined()
    expect(result.total).toBe(COUNT_CAP)
    expect(result.totalCapped).toBe(true)
  })

  it('keeps an exact count when the matches are at or under the cap, and cuts the page from them instead of an ordered scan', async () => {
    countLight.mockResolvedValueOnce(40)
    findLight.mockResolvedValueOnce(ids(40)).mockImplementationOnce(async ({ where }: { where: { id: { in: string[] } } }) =>
      // Read by id, returned in another order: the page keeps the count's newest-first order.
      [...where.id.in].reverse().map((id) => ({ ...light(1)[0], id })),
    )
    const result = await searchPublicBoard({ q: 'analyst', loc: 'Louisville, KY', remote: false })
    expect(result.total).toBe(40)
    expect(result.totalCapped).toBeUndefined()
    const pageCall = findLight.mock.calls[1][0]
    expect(pageCall.orderBy).toBeUndefined()
    expect(pageCall.where.id.in[0]).toBe('c39') // the newest posted first
    expect(result.jobs.map((j) => j.id).slice(0, 3)).toEqual(['c39', 'c38', 'c37'])
    expect(limits).toEqual([10_000, 10_000]) // the count and the matches' ids, each with a time limit; the page is read by primary key
  })

  it('pages through the matches it counted', async () => {
    countLight.mockResolvedValueOnce(40)
    findLight.mockResolvedValueOnce(ids(40)).mockImplementationOnce(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id) => ({ ...light(1)[0], id })))
    await searchPublicBoard({ q: 'analyst', loc: '', remote: false, offset: 30 })
    expect(findLight.mock.calls[1][0].where.id.in).toEqual(['c9', 'c8', 'c7', 'c6', 'c5', 'c4', 'c3', 'c2', 'c1', 'c0'])
  })

  it('skips the count for a search with no terms at all (every live job matches) and says the count is capped', async () => {
    findLight.mockResolvedValueOnce(light(12))
    const result = await searchPublicBoard({ q: '', loc: '', remote: false })
    expect(findLight).toHaveBeenCalledTimes(1)
    expect(findLight.mock.calls[0][0].orderBy).toBeDefined() // the newest page, off the date index
    expect(result.total).toBe(COUNT_CAP)
    expect(result.totalCapped).toBe(true)
    expect(result.jobs).toHaveLength(12)
  })

  it('skips the count query when the caller only wants the jobs (the saved-search alerts)', async () => {
    findLight.mockResolvedValue(light(5))
    const result = await searchPublicBoard({ q: 'analyst', loc: '', remote: false, skipTotal: true })
    expect(findLight).toHaveBeenCalledTimes(1)
    expect(limits).toEqual([10_000])
    expect(result.total).toBe(0)
    expect(result.jobs).toHaveLength(5)
  })

  it('lets a read that cannot finish fail instead of answering with nothing', async () => {
    findLight.mockRejectedValue(new Error('canceling statement due to statement timeout'))
    await expect(searchPublicBoard({ q: '', loc: ', KY', remote: false })).rejects.toThrow('statement timeout')
  })
})

describe('newestFirst', () => {
  it('orders as the board does: posted newest first, no posted date last, then created newest first', async () => {
    const { newestFirst } = await import('@/lib/jobs/public-board')
    const d = (s: string) => new Date(s)
    const rows = [
      { id: 'none-old', postedAt: null, createdAt: d('2026-11-01') },
      { id: 'p1', postedAt: d('2026-11-10'), createdAt: d('2026-11-01') },
      { id: 'none-new', postedAt: null, createdAt: d('2026-11-12') },
      { id: 'p2-late', postedAt: d('2026-11-12'), createdAt: d('2026-11-02') },
      { id: 'p2-early', postedAt: d('2026-11-12'), createdAt: d('2026-11-01') },
    ]
    expect(newestFirst(rows).map((r) => r.id)).toEqual(['p2-late', 'p2-early', 'p1', 'none-new', 'none-old'])
  })
})
