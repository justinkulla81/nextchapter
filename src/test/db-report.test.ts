import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const send = vi.fn(async (_msg: { subject: string; html: string; text: string }) => ({ error: null as unknown }))
const queryRawUnsafe = vi.fn()
const queryRaw = vi.fn()
const findFirst = vi.fn()
const create = vi.fn(async (_args: unknown) => ({}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a),
    $queryRaw: (...a: unknown[]) => queryRaw(...a),
    analyticsEvent: { findFirst: (...a: unknown[]) => findFirst(...a), create: (a: unknown) => create(a) },
  },
}))
vi.mock('@/lib/email/resend-client', () => ({ createResend: () => ({ emails: { send } }) }))

import { cacheHitPct, runDbSlowQueryReport, tableGrowth, topBy, weeklyDelta, type StatementRow } from '@/lib/perf/db-report'

const st = (queryid: string, calls: number, totalMs: number, extra: Partial<StatementRow> = {}): StatementRow => ({ queryid, calls, totalMs, maxMs: 0, query: `q${queryid}`, ...extra })

describe('weeklyDelta rows and disk reads', () => {
  it('subtracts last week when the snapshot carried the counters', () => {
    const out = weeklyDelta([st('a', 30, 3_000, { rows: 1_000, blksRead: 500 })], { a: { calls: 10, totalMs: 1_000, rows: 400, blksRead: 100 } })
    expect(out[0]).toMatchObject({ deltaCalls: 20, deltaRows: 600, deltaBlksRead: 400 })
  })

  it('has no baseline (null, not the all-time figure) when the last snapshot predates the counters', () => {
    const out = weeklyDelta([st('a', 30, 3_000, { rows: 9_000_000, blksRead: 500 })], { a: { calls: 10, totalMs: 1_000 } })
    expect(out[0]).toMatchObject({ deltaCalls: 20, deltaRows: null, deltaBlksRead: null })
  })

  it('uses the full count for a statement that is new or whose counters were reset', () => {
    expect(weeklyDelta([st('a', 5, 500, { rows: 70 })], null)[0]).toMatchObject({ deltaRows: 70 })
    expect(weeklyDelta([st('a', 5, 500, { rows: 70 })], { a: { calls: 99, totalMs: 9_000, rows: 5_000 } })[0]).toMatchObject({ deltaRows: 70 })
  })

  it('never reports a negative figure', () => {
    const out = weeklyDelta([st('a', 30, 3_000, { rows: 100 })], { a: { calls: 10, totalMs: 1_000, rows: 400 } })
    expect(out[0].deltaRows).toBe(0)
  })
})

describe('topBy', () => {
  it('ranks by the chosen figure and leaves out statements with none', () => {
    const deltas = weeklyDelta(
      [st('a', 2, 10, { rows: 50 }), st('b', 2, 10, { rows: 900 }), st('c', 2, 10, { rows: 0 }), st('d', 2, 10)],
      { a: { calls: 1, totalMs: 5, rows: 10 }, b: { calls: 1, totalMs: 5, rows: 100 }, c: { calls: 1, totalMs: 5, rows: 0 }, d: { calls: 1, totalMs: 5 } },
    )
    expect(topBy(deltas, 'deltaRows').map((r) => r.queryid)).toEqual(['b', 'a'])
    expect(topBy(deltas, 'deltaRows', 1)).toHaveLength(1)
  })
})

describe('tableGrowth', () => {
  it('flags a table that grew by 20 percent or more and skips tables with no earlier size', () => {
    const out = tableGrowth({ Company: 120_000, WarnNotice: 5_000, GeoPlace: 70_000 }, { Company: 100_000, WarnNotice: 4_900 })
    expect(out).toEqual([
      { table: 'Company', now: 120_000, before: 100_000, pct: 20, flagged: true },
      { table: 'WarnNotice', now: 5_000, before: 4_900, pct: 2, flagged: false },
    ])
  })

  it('has nothing to compare on the first run', () => {
    expect(tableGrowth({ Company: 1 }, null)).toEqual([])
  })
})

describe('cacheHitPct', () => {
  it('is the share of reads from memory since the last snapshot', () => {
    expect(cacheHitPct({ hit: 1_900, read: 100 }, { hit: 900, read: 0 })).toBe(90.9)
  })

  it('falls back to the all-time share when there is no snapshot or the counters were reset', () => {
    expect(cacheHitPct({ hit: 83, read: 17 }, null)).toBe(83)
    expect(cacheHitPct({ hit: 83, read: 17 }, { hit: 9_000, read: 9_000 })).toBe(83)
  })

  it('is null with nothing counted', () => {
    expect(cacheHitPct({ hit: 0, read: 0 }, null)).toBeNull()
  })
})

describe('runDbSlowQueryReport', () => {
  const raw = (queryid: string, o: Partial<{ calls: number; total_ms: number; max_ms: number; rows: number; blks_read: number; query: string }> = {}) =>
    ({ queryid, calls: 10, total_ms: 1_000, max_ms: 100, rows: 100, blks_read: 10, query: `SELECT ${queryid}`, ...o })

  beforeEach(() => {
    send.mockClear()
    create.mockClear()
    queryRawUnsafe.mockReset()
    queryRaw.mockReset()
    findFirst.mockReset()
    process.env.RESEND_API_KEY = 'test'
  })

  it('emails the three rankings, the cache share and the flagged table, and stores the new snapshot', async () => {
    queryRawUnsafe
      .mockResolvedValueOnce([raw('t', { total_ms: 90_000, calls: 20 })])
      .mockResolvedValueOnce([raw('r', { rows: 5_000_000, calls: 20 })])
      .mockResolvedValueOnce([raw('d', { blks_read: 2_000_000, calls: 20 })])
    queryRaw
      .mockResolvedValueOnce([{ relname: 'Company', n: 130_000 }])
      .mockResolvedValueOnce([{ hit: 1_900, read: 100 }])
    findFirst.mockResolvedValue({
      properties: {
        totals: { t: { calls: 10, totalMs: 1_000, rows: 0, blksRead: 0 }, r: { calls: 10, totalMs: 1_000, rows: 100, blksRead: 0 }, d: { calls: 10, totalMs: 1_000, rows: 0, blksRead: 0 } },
        tables: { Company: 100_000 },
        io: { hit: 900, read: 0 },
      },
    })

    const result = await runDbSlowQueryReport()
    expect(result).toEqual({ reported: 3, firstRun: false })
    const msg = send.mock.calls[0][0]
    expect(msg.subject).toBe('Weekly database report: time, rows and disk reads')
    expect(msg.html).toContain('Most database time')
    expect(msg.html).toContain('Most rows returned')
    expect(msg.html).toContain('Most disk reads')
    expect(msg.html).toContain('4,999,900 rows')
    expect(msg.html).toContain('90.9%')
    expect(msg.html).toContain('+30%')
    expect(msg.text).toContain('Company: 130,000 rows, +30% (flagged)')
    expect(msg.text).toContain('https://supabase.com/dashboard/org/')
    const stored = (create.mock.calls[0][0] as { data: { properties: { totals: Record<string, { rows: number }>; tables: unknown; io: unknown } } }).data.properties
    expect(Object.keys(stored.totals).sort()).toEqual(['d', 'r', 't'])
    expect(stored.totals.r.rows).toBe(5_000_000)
    expect(stored.tables).toEqual({ Company: 130_000 })
    expect(stored.io).toEqual({ hit: 1_900, read: 100 })
  })

  it('says rows and disk reads start next week when the last snapshot had no counters', async () => {
    queryRawUnsafe.mockResolvedValue([raw('t', { total_ms: 90_000, calls: 20 })])
    queryRaw.mockResolvedValue([])
    findFirst.mockResolvedValue({ properties: { totals: { t: { calls: 10, totalMs: 1_000 } } } })
    await runDbSlowQueryReport()
    const msg = send.mock.calls[0][0]
    expect(msg.html).toContain('start counting from this week')
    expect(msg.html).not.toContain('Most rows returned')
  })

  it('still reports when the table sizes and block counters cannot be read', async () => {
    queryRawUnsafe.mockResolvedValue([raw('t', { total_ms: 90_000, calls: 20 })])
    queryRaw.mockRejectedValue(new Error('permission denied'))
    findFirst.mockResolvedValue(null)
    expect(await runDbSlowQueryReport()).toEqual({ reported: 1, firstRun: true })
    expect(send).toHaveBeenCalledOnce()
  })

  it('skips quietly when pg_stat_statements cannot be read', async () => {
    queryRawUnsafe.mockRejectedValue(new Error('relation "pg_stat_statements" does not exist'))
    expect(await runDbSlowQueryReport()).toEqual({ skipped: 'pg_stat_statements is not readable' })
    expect(send).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})
