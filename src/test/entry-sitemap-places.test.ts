import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ read: vi.fn(), queryRaw: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: db.queryRaw } }))
vi.mock('@/lib/jobs/stored-board-figures', () => ({ readBoardFigure: db.read }))
vi.mock('@/lib/jobs/public-job-page-server', async () => {
  const { Prisma } = await import('@prisma/client')
  return { PUBLIC_JOB_STATIC_SQL: Prisma.sql`status = 'approved'`, PUBLIC_JOB_LIVE_SQL: Prisma.sql`"archivedAt" IS NULL` }
})

import { placesThatAnswer } from '@/lib/entry-roles/sitemap-places'

const row = (place: string, n: number): [string, string, 'city', number, string] => ['sdr', place, 'city', n, place]
const stored = (ids: string[]) => ({ jobIds: ids })

beforeEach(() => {
  db.read.mockReset()
  db.queryRaw.mockReset()
})

describe('placesThatAnswer', () => {
  it('keeps big places without reading anything', async () => {
    const big = [row('a', 30), row('b', 40)]
    expect(await placesThatAnswer(big)).toEqual(big)
    expect(db.read).not.toHaveBeenCalled()
    expect(db.queryRaw).not.toHaveBeenCalled()
  })

  it('drops a small place whose listings have mostly closed, and keeps one that still has enough', async () => {
    const thin = row('cincinnati-oh', 10)
    const ok = row('austin-tx', 9)
    db.read.mockImplementation(async (key: string) =>
      key.endsWith('cincinnati-oh') ? stored(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10']) : stored(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9']),
    )
    // Cincinnati has 4 left live (below the bar of 5 plus a margin of 2); Austin has 8.
    db.queryRaw.mockResolvedValue(['c1', 'c2', 'c3', 'c4', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'].map((id) => ({ id })))
    expect(await placesThatAnswer([thin, ok, row('big', 40)])).toEqual([ok, row('big', 40)])
  })

  it('checks a place with 15 stored listings too: it can drop under the bar within hours', async () => {
    const mid = row('dallas-tx', 15)
    db.read.mockResolvedValue(stored(Array.from({ length: 15 }, (_, i) => `d${i}`)))
    db.queryRaw.mockResolvedValue(['d0', 'd1', 'd2'].map((id) => ({ id })))
    expect(await placesThatAnswer([mid])).toEqual([])
  })

  it('drops a small place that has no stored row', async () => {
    db.read.mockResolvedValue(null)
    db.queryRaw.mockResolvedValue([])
    expect(await placesThatAnswer([row('gone', 6)])).toEqual([])
  })
})
