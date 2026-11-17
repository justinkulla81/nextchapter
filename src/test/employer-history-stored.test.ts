import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('next/cache', () => ({ unstable_cache: (f: unknown) => f }))

import { historyFromRow, storedHistoryRow } from '@/lib/seo/employer-insights'

const NOW = new Date('2026-11-17T12:00:00Z')

describe('storedHistoryRow: the history the nightly profile build keeps', () => {
  it('reads the stored shape into the same row the live query gives, so the page builds the same history from either', () => {
    const stored = { months: [{ month: '2026-10', opened: 4 }, { month: '2026-11', opened: 2 }], closed: 3, firstSeen: '2026-09-02T08:00:00.000Z', last90: 6, prior90: 1 }
    const row = storedHistoryRow(JSON.parse(JSON.stringify(stored)))
    expect(row).toEqual({ months: stored.months, closed: 3, last90: 6, prior90: 1, first_seen: new Date('2026-09-02T08:00:00Z') })
    const h = historyFromRow(row!, NOW)
    expect(h.months).toEqual([{ month: '2026-09', opened: 0 }, { month: '2026-10', opened: 4 }, { month: '2026-11', opened: 2 }])
    expect([h.opened12mo, h.closed12mo, h.trackedSince, h.trackedDays, h.last90, h.prior90]).toEqual([6, 3, '2026-09-02', 76, 6, 1])
  })

  it('keeps an employer never seen as untracked', () => {
    const row = storedHistoryRow({ months: [], closed: 0, firstSeen: null, last90: 0, prior90: 0 })
    expect(historyFromRow(row!, NOW)).toMatchObject({ months: [], trackedSince: null, trackedDays: 0 })
  })

  it('answers null for no history or another shape, so the page falls back to the live query', () => {
    for (const v of [null, undefined, {}, { months: 'x' }, { months: [], closed: '3', last90: 0, prior90: 0 }]) expect(storedHistoryRow(v)).toBeNull()
  })
})
