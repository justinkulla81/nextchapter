import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const findMany = vi.fn()
const groupBy = vi.fn()
const count = vi.fn()
const lightGroupBy = vi.fn()
const lightReady = vi.fn()
vi.mock('@/lib/jobs/board-light-rows', () => ({ mirrorCanAnswer: () => true, boardLightRowsReady: () => lightReady() }))
vi.mock('@/lib/prisma', () => ({
  prisma: { boardLightRow: { groupBy: (...a: unknown[]) => lightGroupBy(...a) }, exclusiveJobPosting: { findMany: (...a: unknown[]) => findMany(...a), groupBy: (...a: unknown[]) => groupBy(...a), count: (...a: unknown[]) => count(...a) } },
}))
vi.mock('@/lib/db/statement-timeout', () => ({ withStatementTimeout: (q: Promise<unknown>) => q }))
vi.mock('@/lib/jobs/board-shortlist', () => ({ liveBoardWhere: (extra: object) => ({ live: true, ...extra }) }))
vi.mock('@/lib/jobs/competition', () => ({ FRESH_HOURS: 72 }))
const readBoardFigure = vi.fn()
vi.mock('@/lib/jobs/stored-board-figures', () => ({ readBoardFigure: (...a: unknown[]) => readBoardFigure(...a) }))
// A pass-through cache: each call runs the query, so the test sees exactly what reaches the database.
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

import { FRESH_PEEK_COUNT_CAP, getFreshJobsCount, getFreshJobsPeek, resetFreshJobsFailureMemo } from '@/lib/jobs/fresh-jobs-peek'

const groups = (o: Record<string, number>) => Object.entries(o).map(([targetFunction, n]) => ({ targetFunction, _count: { _all: n } }))
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `j${i}`, title: `Job ${i}`, companyName: 'Acme', disclosure: 'OPEN', postedAt: null, createdAt: new Date() }))

beforeEach(() => {
  findMany.mockReset()
  groupBy.mockReset()
  count.mockReset()
  readBoardFigure.mockReset()
  lightGroupBy.mockReset()
  lightReady.mockReset()
  lightReady.mockResolvedValue(false)
  readBoardFigure.mockResolvedValue(null)
  resetFreshJobsFailureMemo()
})

describe('fresh jobs stored count', () => {
  it('reads the count the cron stored and never scans the board', async () => {
    readBoardFigure.mockResolvedValue({ at: Date.now() - 3_600_000, counts: { Sales: 12 } })
    expect(await getFreshJobsCount('Sales', null)).toBe(12)
    expect(groupBy).not.toHaveBeenCalled()
  })

  it('falls back to the live grouped count when the stored row is missing, too old or unreadable', async () => {
    groupBy.mockResolvedValue(groups({ Sales: 5 }))
    expect(await getFreshJobsCount('Sales', null)).toBe(5)
    readBoardFigure.mockResolvedValue({ at: Date.now() - 25 * 3_600_000, counts: { Sales: 99 } })
    expect(await getFreshJobsCount('Sales', null)).toBe(5)
    readBoardFigure.mockRejectedValue(new Error('down'))
    expect(await getFreshJobsCount('Sales', null)).toBe(5)
    expect(groupBy).toHaveBeenCalledTimes(3)
  })
})

describe('fresh jobs badge count', () => {
  it('reads one grouped count for every function, never a per-function query or Prisma count (which forces ORDER BY id and a full primary-key scan)', async () => {
    groupBy.mockResolvedValue(groups({ Operations: 7, Academic: 150 }))
    expect(await getFreshJobsCount('Operations', null)).toBe(7)
    expect(await getFreshJobsCount('Academic', null)).toBe(FRESH_PEEK_COUNT_CAP)
    expect(count).not.toHaveBeenCalled()
    expect(findMany).not.toHaveBeenCalled()
    const args = groupBy.mock.calls[0][0]
    expect(args.by).toEqual(['targetFunction'])
    expect(args.orderBy).toBeUndefined()
  })

  it('adds a member\'s two functions, caps the total, and counts a function with no new jobs as zero', async () => {
    groupBy.mockResolvedValue(groups({ Sales: 40, Marketing: 30 }))
    expect(await getFreshJobsCount('Sales', 'Marketing')).toBe(70)
    groupBy.mockResolvedValue(groups({ Sales: 80, Marketing: 60 }))
    expect(await getFreshJobsCount('Sales', 'Marketing')).toBe(FRESH_PEEK_COUNT_CAP)
    expect(await getFreshJobsCount('Legal', null)).toBe(0)
    expect(await getFreshJobsCount(null, null)).toBe(0)
  })

  it('remembers a failure for a minute so a struggling database is not asked again on every page view, then tries again', async () => {
    groupBy.mockRejectedValueOnce(new Error('timeout'))
    const t0 = 1_000_000
    await expect(getFreshJobsCount('Finance', null, t0)).rejects.toThrow('timeout')
    await expect(getFreshJobsCount('Sales', null, t0 + 30_000)).rejects.toThrow('timeout')
    expect(groupBy).toHaveBeenCalledTimes(1)
    groupBy.mockResolvedValueOnce(groups({ Finance: 3 }))
    expect(await getFreshJobsCount('Finance', null, t0 + 61_000)).toBe(3)
    expect(groupBy).toHaveBeenCalledTimes(2)
  })
})

describe('fresh jobs prompt', () => {
  it('takes the count from the shared grouped count and the three newest from a short ordered read', async () => {
    groupBy.mockResolvedValue(groups({ Operations: 12 }))
    findMany.mockResolvedValueOnce(rows(3))
    const peek = await getFreshJobsPeek('Operations', null)
    expect(peek.count).toBe(12)
    expect(peek.top.map((r) => r.id)).toEqual(['j0', 'j1', 'j2'])
    expect(count).not.toHaveBeenCalled()
    const args = findMany.mock.calls[0][0]
    expect(args.orderBy).toEqual({ createdAt: 'desc' })
    expect(args.take).toBe(3)
  })

  it('never shows fewer jobs than the count when the count is a few minutes older than the rows', async () => {
    groupBy.mockResolvedValue(groups({ Operations: 0 }))
    findMany.mockResolvedValueOnce(rows(3))
    expect((await getFreshJobsPeek('Operations', null)).count).toBe(3)
  })

  it('reads as nothing new when there is no function or either read fails', async () => {
    expect(await getFreshJobsPeek(null, null)).toEqual({ count: 0, top: [] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    groupBy.mockRejectedValueOnce(new Error('down'))
    findMany.mockResolvedValueOnce(rows(3))
    expect(await getFreshJobsPeek('Legal', null)).toEqual({ count: 0, top: [] })
  })
})

describe('fresh jobs live count fallback', () => {
  it('groups on the narrow copy when it is ready', async () => {
    lightReady.mockResolvedValue(true)
    lightGroupBy.mockResolvedValue(groups({ Sales: 7 }))
    expect(await getFreshJobsCount('Sales', null)).toBe(7)
    expect(groupBy).not.toHaveBeenCalled()
  })
  it('falls back to the wide table when the copy fails', async () => {
    lightReady.mockResolvedValue(true)
    lightGroupBy.mockRejectedValue(new Error('boom'))
    groupBy.mockResolvedValue(groups({ Sales: 9 }))
    expect(await getFreshJobsCount('Sales', null)).toBe(9)
  })
})
