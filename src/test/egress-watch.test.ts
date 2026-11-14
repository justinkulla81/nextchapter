import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/email/resend-client', () => ({ createResend: vi.fn() }))
import { dailyDelta, rowBytes } from '@/lib/perf/egress-watch'

describe('egress watch', () => {
  it('counts a full posting text read as wide and a left() stub as narrow', () => {
    expect(rowBytes('SELECT "id", "description" FROM "ExclusiveJobPosting"')).toBe(5000)
    expect(rowBytes('SELECT id, left(description, $1) AS d FROM "ExclusiveJobPosting"')).toBe(250)
    expect(rowBytes('SELECT "id", "title" FROM "BoardLightRow"')).toBe(250)
  })
  it('takes rows since the snapshot, and all of them after a reset or for a new statement', () => {
    const d = dailyDelta(
      [
        { queryid: 'a', rows: 1_000_000, calls: 10, query: 'SELECT "title"' },
        { queryid: 'b', rows: 50, calls: 1, query: 'SELECT "title"' },
        { queryid: 'c', rows: 400, calls: 2, query: 'SELECT "description"' },
      ],
      { a: { rows: 600_000, calls: 4 }, b: { rows: 900, calls: 9 } }
    )
    expect(d.find((x) => x.queryid === 'a')?.deltaRows).toBe(400_000)
    expect(d.find((x) => x.queryid === 'b')?.deltaRows).toBe(50)
    expect(d.find((x) => x.queryid === 'c')?.deltaRows).toBe(400)
    expect(d[0].queryid).toBe('a')
  })
})
