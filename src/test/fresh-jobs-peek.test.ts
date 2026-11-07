import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const findMany = vi.fn()
const count = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { exclusiveJobPosting: { findMany: (...a: unknown[]) => findMany(...a), count: (...a: unknown[]) => count(...a) } } }))
vi.mock('@/lib/db/statement-timeout', () => ({ withStatementTimeout: (q: Promise<unknown>) => q }))
vi.mock('@/lib/jobs/board-shortlist', () => ({ liveBoardWhere: (extra: object) => ({ live: true, ...extra }) }))
vi.mock('@/lib/jobs/competition', () => ({ FRESH_HOURS: 72 }))
// A pass-through cache: each call runs the query, so the test sees exactly what reaches the database.
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

import { FRESH_PEEK_COUNT_CAP, getFreshJobsCount, getFreshJobsPeek, resetFreshJobsFailureMemo } from '@/lib/jobs/fresh-jobs-peek'

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `j${i}`, title: `Job ${i}`, companyName: 'Acme', disclosure: 'OPEN', postedAt: null, createdAt: new Date() }))

beforeEach(() => {
  findMany.mockReset()
  count.mockReset()
  resetFreshJobsFailureMemo()
})

describe('fresh jobs badge count', () => {
  it('reads at most the cap plus one row with a plain limit, never Prisma count (which forces ORDER BY id and a full primary-key scan)', async () => {
    findMany.mockResolvedValueOnce(rows(7))
    expect(await getFreshJobsCount('Operations', null)).toBe(7)
    expect(count).not.toHaveBeenCalled()
    const args = findMany.mock.calls[0][0]
    expect(args.take).toBe(FRESH_PEEK_COUNT_CAP + 1)
    expect(args.orderBy).toBeUndefined()
  })

  it('caps the number shown', async () => {
    findMany.mockResolvedValueOnce(rows(FRESH_PEEK_COUNT_CAP + 1))
    expect(await getFreshJobsCount('Sales', null)).toBe(FRESH_PEEK_COUNT_CAP)
  })

  it('remembers a failure for a minute so a struggling database is not asked again on every page view, then tries again', async () => {
    findMany.mockRejectedValueOnce(new Error('timeout'))
    const t0 = 1_000_000
    await expect(getFreshJobsCount('Finance', null, t0)).rejects.toThrow('timeout')
    await expect(getFreshJobsCount('Finance', null, t0 + 30_000)).rejects.toThrow('timeout')
    expect(findMany).toHaveBeenCalledTimes(1)
    findMany.mockResolvedValueOnce(rows(3))
    expect(await getFreshJobsCount('Finance', null, t0 + 61_000)).toBe(3)
    expect(findMany).toHaveBeenCalledTimes(2)
  })

  it('keeps one function\'s failure from hiding another\'s badge', async () => {
    findMany.mockRejectedValueOnce(new Error('timeout'))
    await expect(getFreshJobsCount('Finance', null, 5)).rejects.toThrow()
    findMany.mockResolvedValueOnce(rows(2))
    expect(await getFreshJobsCount('Sales', null, 6)).toBe(2)
  })
})

describe('fresh jobs prompt', () => {
  it('gets the count and the three newest from one query', async () => {
    findMany.mockResolvedValueOnce(rows(12))
    const peek = await getFreshJobsPeek('Operations', null)
    expect(peek.count).toBe(12)
    expect(peek.top.map((r) => r.id)).toEqual(['j0', 'j1', 'j2'])
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(count).not.toHaveBeenCalled()
    expect(findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' })
  })

  it('reads as nothing new when there is no function or the read fails', async () => {
    expect(await getFreshJobsPeek(null, null)).toEqual({ count: 0, top: [] })
    findMany.mockRejectedValueOnce(new Error('down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await getFreshJobsPeek('Legal', null)).toEqual({ count: 0, top: [] })
  })
})
