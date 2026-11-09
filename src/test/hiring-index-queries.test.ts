import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ queryRaw: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRawUnsafe: db.queryRaw, exclusiveJobPosting: { count: vi.fn(), findMany: vi.fn() } } }))
vi.mock('@/lib/companies/posting-company', () => ({ linkPostingsToCompanies: vi.fn() }))

import { closeArchivedOpenings } from '@/lib/companies/job-openings'
import { openingIdsToPrice } from '@/lib/companies/hiring-index'

beforeEach(() => db.queryRaw.mockReset())

describe('closeArchivedOpenings', () => {
  it('continues each batch after the last url of the one before, and stops on a short batch', async () => {
    db.queryRaw.mockResolvedValueOnce([{ n: 5000, last: 'https://a/5000' }]).mockResolvedValueOnce([{ n: 12, last: 'https://a/5100' }])
    expect(await closeArchivedOpenings()).toBe(5012)
    expect(db.queryRaw).toHaveBeenCalledTimes(2)
    expect(db.queryRaw.mock.calls[0].slice(1)).toEqual([''])
    expect(db.queryRaw.mock.calls[1].slice(1)).toEqual(['https://a/5000'])
  })

  it('looks only at postings archived since a day before the last good run when given one', async () => {
    db.queryRaw.mockResolvedValueOnce([{ n: 3, last: 'https://a/1' }])
    const since = new Date('2026-11-07T08:24:00Z')
    expect(await closeArchivedOpenings({ since })).toBe(3)
    const [sql, last, from] = db.queryRaw.mock.calls[0]
    expect(sql).toContain('"archivedAt" >= $2')
    expect(last).toBe('')
    expect((from as Date).toISOString()).toBe('2026-11-06T08:24:00.000Z')
  })

  it('does not start another batch past its deadline', async () => {
    db.queryRaw.mockResolvedValue([{ n: 5000, last: 'https://a/x' }])
    await closeArchivedOpenings({ deadline: Date.now() - 1 })
    expect(db.queryRaw).toHaveBeenCalledTimes(1)
  })
})

describe('openingIdsToPrice', () => {
  it('has no ORDER BY in the SQL (it forced a primary-key walk of the whole table) and returns the ids sorted', async () => {
    db.queryRaw.mockResolvedValue([{ id: 'c' }, { id: 'a' }, { id: 'b' }])
    expect(await openingIdsToPrice({ since: new Date(0), shard: 1 })).toEqual(['a', 'b', 'c'])
    expect(db.queryRaw.mock.calls[0][0]).not.toMatch(/ORDER BY/i)
  })
})
