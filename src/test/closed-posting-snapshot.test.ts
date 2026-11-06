import { beforeEach, describe, expect, it, vi } from 'vitest'

// The closed-postings map is read from the nightly snapshot; grouping the closed postings (16-25 s on a cold instance) is the fallback only.
const db = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  groupBy: vi.fn(),
  grouped: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    closedPostingSnapshot: { findFirst: db.findFirst, create: db.create, findMany: db.findMany, deleteMany: db.deleteMany },
    exclusiveJobPosting: { groupBy: db.groupBy },
  },
}))
vi.mock('@/lib/jobs/board-light-rows', () => ({ groupClosedPostings: db.grouped }))

const DAY = 24 * 60 * 60 * 1000
const load = async () => {
  vi.resetModules()
  return import('@/lib/jobs/ghost-risk-data')
}

beforeEach(() => {
  Object.values(db).forEach((f) => f.mockReset())
  db.groupBy.mockResolvedValue([])
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('getClosedPostingCounts', () => {
  it('reads the newest snapshot and does not group the closed postings', async () => {
    db.findFirst.mockResolvedValue({ computedAt: new Date(Date.now() - DAY), data: { 'acme|controller|austin, tx': 3 } })
    const { getClosedPostingCounts } = await load()
    const counts = await getClosedPostingCounts()
    expect(counts.get('acme|controller|austin, tx')).toBe(3)
    expect(db.grouped).not.toHaveBeenCalled()
  })

  it('groups the closed postings itself when there is no snapshot yet', async () => {
    db.findFirst.mockResolvedValue(null)
    db.grouped.mockResolvedValue([{ companyName: 'Acme', title: 'Controller', location: 'Austin, TX', count: 2 }])
    const { getClosedPostingCounts } = await load()
    expect((await getClosedPostingCounts()).get('acme|controller|austin, tx')).toBe(2)
    expect(db.grouped).toHaveBeenCalledTimes(1)
  })

  it('does not trust a snapshot older than three days', async () => {
    db.findFirst.mockResolvedValue({ computedAt: new Date(Date.now() - 4 * DAY), data: { stale: 9 } })
    db.grouped.mockResolvedValue([])
    const { getClosedPostingCounts } = await load()
    const counts = await getClosedPostingCounts()
    expect(counts.has('stale')).toBe(false)
    expect(db.grouped).toHaveBeenCalledTimes(1)
  })

  it('falls back to grouping when the snapshot cannot be read (for example the table is missing)', async () => {
    db.findFirst.mockRejectedValue(new Error('relation "ClosedPostingSnapshot" does not exist'))
    db.grouped.mockResolvedValue([{ companyName: 'Acme', title: 'Controller', location: null, count: 1 }])
    const { getClosedPostingCounts } = await load()
    expect((await getClosedPostingCounts()).get('acme|controller|')).toBe(1)
  })

  it('ignores a snapshot whose data is not an object', async () => {
    db.findFirst.mockResolvedValue({ computedAt: new Date(), data: [1, 2] })
    db.grouped.mockResolvedValue([])
    const { getClosedPostingCounts } = await load()
    await getClosedPostingCounts()
    expect(db.grouped).toHaveBeenCalledTimes(1)
  })

  it('holds the answer, so a second call neither reads nor groups again', async () => {
    db.findFirst.mockResolvedValue({ computedAt: new Date(), data: { a: 1 } })
    const { getClosedPostingCounts } = await load()
    await getClosedPostingCounts()
    await getClosedPostingCounts()
    expect(db.findFirst).toHaveBeenCalledTimes(1)
  })
})

describe('rebuildClosedPostingSnapshot', () => {
  it('groups once, stores the map as an object, and prunes all but the newest three', async () => {
    db.grouped.mockResolvedValue([
      { companyName: 'Acme', title: 'Controller', location: 'Austin, TX', count: 2 },
      { companyName: 'Beta  Co', title: 'Analyst', location: null, count: 1 },
    ])
    db.findMany.mockResolvedValue([{ id: 'old1' }, { id: 'old2' }])
    const { rebuildClosedPostingSnapshot } = await load()
    const result = await rebuildClosedPostingSnapshot()
    expect(result).toEqual({ keys: 2 })
    expect(db.create).toHaveBeenCalledWith({ data: { data: { 'acme|controller|austin, tx': 2, 'beta co|analyst|': 1 } } })
    expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 3 }))
    expect(db.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['old1', 'old2'] } } })
  })

  it('removes a collapsed duplicate from the stored counts, as the live grouping does', async () => {
    db.grouped.mockResolvedValue([{ companyName: 'Acme', title: 'Controller', location: 'Austin, TX', count: 2 }])
    db.groupBy.mockResolvedValue([{ companyName: 'Acme', title: 'Controller', location: 'Austin, TX', _count: { _all: 2 } }])
    db.findMany.mockResolvedValue([])
    const { rebuildClosedPostingSnapshot } = await load()
    expect(await rebuildClosedPostingSnapshot()).toEqual({ keys: 0 })
    expect(db.deleteMany).not.toHaveBeenCalled()
  })
})
