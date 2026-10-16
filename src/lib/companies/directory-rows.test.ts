import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  company: { findMany: vi.fn(), count: vi.fn() },
  memberEmployment: { groupBy: vi.fn() },
}))
const bulkMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/companies/company-ranking-data', () => ({ loadBulkCompanyRows: bulkMock }))

const week = new Date('2026-10-05T00:00:00Z')
const bulkRow = (id: string, name: string) => ({
  id,
  name,
  canonicalNameNormalized: name.toLowerCase(),
  industry: 'Software',
  sizeBand: null,
  hqMetro: null,
  signals: [{ trajectory: 'growing', openRolesTotal: 3, weekStartDate: week, rolesDelta12wk: 1 }],
})

async function freshModule() {
  vi.resetModules()
  return import('./directory-rows')
}

describe('loadDirectoryRows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    bulkMock.mockResolvedValue([bulkRow('b', 'Beta'), bulkRow('a', 'Alpha')])
    prismaMock.memberEmployment.groupBy.mockResolvedValue([{ companyId: 'a', _count: { _all: 2 } }])
    prismaMock.company.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
  })

  it('keeps the database name order, merges member counts and drops extra signal fields', async () => {
    const { loadDirectoryRows } = await freshModule()
    const rows = await loadDirectoryRows({}, true)
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(rows.map((r) => r._count.memberEmployment)).toEqual([2, 0])
    expect(rows[0].signals[0]).toEqual({ trajectory: 'growing', openRolesTotal: 3, weekStartDate: week })
  })

  it('reuses the ordered ids and member counts across calls without a name query', async () => {
    const { loadDirectoryRows } = await freshModule()
    await loadDirectoryRows({}, true)
    await loadDirectoryRows({}, true)
    expect(prismaMock.company.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.memberEmployment.groupBy).toHaveBeenCalledTimes(1)
  })

  it('queries ids per request when a name filter is set', async () => {
    const { loadDirectoryRows } = await freshModule()
    const where = { name: { contains: 'al', mode: 'insensitive' as const } }
    await loadDirectoryRows(where, true)
    await loadDirectoryRows(where, true)
    expect(prismaMock.company.findMany).toHaveBeenCalledTimes(2)
    expect(prismaMock.company.findMany).toHaveBeenCalledWith({ where, orderBy: { name: 'asc' }, select: { id: true } })
  })

  it('falls back to the direct query when the bulk cache lacks a row', async () => {
    const { loadDirectoryRows } = await freshModule()
    bulkMock.mockResolvedValue([bulkRow('a', 'Alpha')])
    prismaMock.company.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]).mockResolvedValueOnce(['direct'])
    expect(await loadDirectoryRows({}, true)).toEqual(['direct'])
  })

  it('does not cache a failed read', async () => {
    const { loadDirectoryRows } = await freshModule()
    prismaMock.company.findMany.mockRejectedValueOnce(new Error('db down'))
    await expect(loadDirectoryRows({}, true)).rejects.toThrow('db down')
    await Promise.resolve()
    expect((await loadDirectoryRows({}, true)).length).toBe(2)
  })
})

describe('loadDirectoryPage', () => {
  it('has the database order, skip, take and count', async () => {
    vi.clearAllMocks()
    prismaMock.company.findMany.mockResolvedValue(['row'])
    prismaMock.company.count.mockResolvedValue(42)
    const { loadDirectoryPage } = await freshModule()
    const where = { name: { contains: 'x', mode: 'insensitive' as const } }
    expect(await loadDirectoryPage(where, 25, 25)).toEqual({ rows: ['row'], total: 42 })
    expect(prismaMock.company.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, orderBy: { name: 'asc' }, skip: 25, take: 25 }))
    expect(prismaMock.company.count).toHaveBeenCalledWith({ where })
  })
})
