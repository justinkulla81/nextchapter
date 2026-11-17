import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

// Two block ranges; each read returns that range's rows.
let rangeRows: Record<string, unknown>[][] = []
const queryRaw = vi.fn(async (_s: unknown, range: { from: string }) => rangeRows[Number(/^\((\d+),0\)$/.exec(range.from)![1]) / 8000] ?? [])
const written: { stats: unknown[]; cities: unknown[] } = { stats: [], cities: [] }
const tx = {
  marketTargetStat: { deleteMany: async () => ({}), createMany: async ({ data }: { data: unknown[] }) => void written.stats.push(...data) },
  marketCityStat: { deleteMany: async () => ({}), createMany: async ({ data }: { data: unknown[] }) => void written.cities.push(...data) },
}
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: (...a: [unknown, { from: string }]) => queryRaw(...a), $transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx) } }))
vi.mock('@/lib/db/heap-ranges', async (actual) => ({
  ...(await actual<typeof import('@/lib/db/heap-ranges')>()),
  heapBlockCount: async () => 16_000,
  heapRangeSql: (r: unknown) => r,
}))

import { rebuildMarketTargetStats } from '@/lib/market/market-size-stats'

const now = new Date('2026-11-17T12:00:00Z')
const job = (id: string, over: Record<string, unknown> = {}) => ({
  id, title: 'Financial Analyst', targetFunction: 'Finance', subFunction: null, level: 'MID_IC', industry: null, location: 'Austin, TX',
  locationCity: 'Austin', locationState: 'TX', workArrangement: null, employmentType: 'full_time', postedAt: new Date('2026-11-10'),
  createdAt: new Date('2026-11-10'), archivedAt: null, closeReason: null, ...over,
})

beforeEach(() => {
  queryRaw.mockClear()
  written.stats = []
  written.cities = []
})

describe('rebuildMarketTargetStats', () => {
  it('reads every block range of the table', async () => {
    rangeRows = [[job('a'), job('b')], [job('c')]]
    const r = await rebuildMarketTargetStats(now)
    expect(queryRaw).toHaveBeenCalledTimes(2)
    expect(r.rowsRead).toBe(3)
  })

  it('counts a job read twice (moved by an update mid-pass) once', async () => {
    rangeRows = [[job('a'), job('b')], [job('c')]]
    await rebuildMarketTargetStats(now)
    const once = JSON.stringify(written)
    written.stats = []
    written.cities = []
    rangeRows = [[job('a'), job('b')], [job('c'), job('a')]]
    await rebuildMarketTargetStats(now)
    expect(JSON.stringify(written).replace(/"computedAt":"[^"]+"/g, '')).toBe(once.replace(/"computedAt":"[^"]+"/g, ''))
  })
})
