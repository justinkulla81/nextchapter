import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ exec: vi.fn(), queryUnsafe: vi.fn(), queryRaw: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/jobs/public-job-page-server', async () => {
  const { Prisma } = await import('@prisma/client')
  return { PUBLIC_JOB_STATIC_SQL: Prisma.sql`status = 'approved'`, PUBLIC_JOB_LIVE_SQL: Prisma.sql`"lastVerifiedAt" > now() - make_interval(days => ${14}::int)` }
})
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => unknown) => fn({ $executeRawUnsafe: db.exec, $queryRawUnsafe: db.queryUnsafe, $queryRaw: db.queryRaw }),
  },
}))

import { scanBoard } from '@/lib/segments/scan'

const raw = (id: string) => ({
  id, title: 'T', company: 'Acme', companyId: null, st: 'TX', city: 'Austin', level: null, payMin: null, payMax: null, payPeriod: null, currency: null,
  postedAt: null, createdAt: new Date('2026-11-01T00:00:00Z'), industry: null, reqTags: null, postingType: null, sourceCategory: null, skills: [], noExp: null, soc: null, socCode: null, sector: null,
})

beforeEach(() => {
  db.exec.mockReset().mockResolvedValue(0)
  db.queryUnsafe.mockReset()
  db.queryRaw.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('scanBoard', () => {
  it('reads the board once through a cursor, with the day counts written in, and closes it', async () => {
    db.queryUnsafe.mockResolvedValueOnce([raw('a'), raw('b')])
    const seen: string[] = []
    expect(await scanBoard((rows) => seen.push(...rows.map((r) => r.id)))).toBe(2)
    expect(seen).toEqual(['a', 'b'])
    const declare = db.exec.mock.calls.map((c) => c[0] as string).find((s) => s.startsWith('DECLARE'))!
    expect(declare).toContain('make_interval(days => 14::int)')
    expect(declare).not.toMatch(/\$\d/)
    expect(db.exec.mock.calls.map((c) => c[0])).toContain('CLOSE board_scan')
    expect(db.queryRaw).not.toHaveBeenCalled()
  })

  it('asks for the next page while the cursor keeps returning full pages', async () => {
    const full = Array.from({ length: 20_000 }, (_, i) => raw(`id${i}`))
    db.queryUnsafe.mockResolvedValueOnce(full).mockResolvedValueOnce([raw('last')])
    expect(await scanBoard(() => {})).toBe(20_001)
    expect(db.queryUnsafe).toHaveBeenCalledTimes(2)
  })

  it('falls back to reading in pages when the cursor cannot start', async () => {
    db.exec.mockImplementation(async (sql: string) => {
      if (sql.startsWith('DECLARE')) throw new Error('cursors are not available here')
      return 0
    })
    db.queryRaw.mockResolvedValueOnce([raw('a')])
    const seen: string[] = []
    expect(await scanBoard((rows) => seen.push(...rows.map((r) => r.id)))).toBe(1)
    expect(seen).toEqual(['a'])
  })

  it('does not fall back once rows were handed over, so none is counted twice', async () => {
    db.queryUnsafe.mockResolvedValueOnce(Array.from({ length: 20_000 }, (_, i) => raw(`id${i}`))).mockRejectedValueOnce(new Error('connection lost'))
    await expect(scanBoard(() => {})).rejects.toThrow('connection lost')
    expect(db.queryRaw).not.toHaveBeenCalled()
  })
})

