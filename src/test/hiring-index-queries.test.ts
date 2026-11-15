import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ queryRaw: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRawUnsafe: db.queryRaw, exclusiveJobPosting: { count: vi.fn(), findMany: vi.fn() } } }))
vi.mock('@/lib/companies/posting-company', () => ({ linkPostingsToCompanies: vi.fn() }))

import { closeArchivedOpenings, sweepOpenOpenings, SWEEP_WINDOW } from '@/lib/companies/job-openings'
import { openingIdsToPrice, sweepAfterFrom } from '@/lib/companies/hiring-index'

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

describe('closeArchivedOpenings keyset', () => {
  it('carries the url bound to the posting side too, so a batch does not walk its url index from the top', async () => {
    db.queryRaw.mockResolvedValueOnce([{ n: 0, last: null }])
    await closeArchivedOpenings({ since: new Date() })
    expect(db.queryRaw.mock.calls[0][0]).toContain('p.url > $1')
  })
})

describe('sweepOpenOpenings', () => {
  it('walks fixed windows of open openings from where it was left, and stops at its deadline with the position', async () => {
    db.queryRaw.mockResolvedValue([{ seen: SWEEP_WINDOW, n: 7, last: 'https://a/2' }])
    const r = await sweepOpenOpenings({ after: 'https://a/1', deadline: Date.now() - 1 })
    expect(r).toEqual({ closed: 7, windows: 1, after: 'https://a/2' })
    const [sql, after] = db.queryRaw.mock.calls[0]
    expect(after).toBe('https://a/1')
    expect(sql).toContain(`LIMIT ${SWEEP_WINDOW}`)
    expect(sql).toContain('o."closedAt" IS NULL AND o.url > $1')
  })

  it('starts at the top without a position and returns null once it reaches the last opening', async () => {
    db.queryRaw.mockResolvedValueOnce([{ seen: SWEEP_WINDOW, n: 1, last: 'https://a/5' }]).mockResolvedValueOnce([{ seen: 12, n: 2, last: 'https://z/1' }])
    const r = await sweepOpenOpenings({ after: null, deadline: Date.now() + 60_000 })
    expect(r).toEqual({ closed: 3, windows: 2, after: null })
    expect(db.queryRaw.mock.calls[0][1]).toBe('')
    expect(db.queryRaw.mock.calls[1][1]).toBe('https://a/5')
  })
})

describe('sweepAfterFrom', () => {
  it('reads the position from a ledger note or a result, even one cut at 2,000 characters', () => {
    expect(sweepAfterFrom(JSON.stringify({ sweepAfter: 'https://a/"q"', step: 'sweep', ms: 3 }))).toBe('https://a/"q"')
    expect(sweepAfterFrom(JSON.stringify({ sweepAfter: 'https://a/1', ms: { x: 'y'.repeat(3000) } }).slice(0, 2000))).toBe('https://a/1')
  })

  it('starts at the top when there is no position', () => {
    expect(sweepAfterFrom(null)).toBeNull()
    expect(sweepAfterFrom(JSON.stringify({ sweepAfter: null, step: 'link' }))).toBeNull()
    expect(sweepAfterFrom(JSON.stringify({ step: 'profiles', ms: 4 }))).toBeNull()
    expect(sweepAfterFrom('not json')).toBeNull()
  })
})

describe('openingIdsToPrice', () => {
  it('has no ORDER BY in the SQL (it forced a primary-key walk of the whole table) and returns the ids sorted', async () => {
    db.queryRaw.mockResolvedValue([{ id: 'c' }, { id: 'a' }, { id: 'b' }])
    expect(await openingIdsToPrice({ since: new Date(0), shard: 1 })).toEqual(['a', 'b', 'c'])
    expect(db.queryRaw.mock.calls[0][0]).not.toMatch(/ORDER BY/i)
  })
})
