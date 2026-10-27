import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const findMany = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { warnNotice: { findMany }, workforceBoard: { findMany: vi.fn().mockResolvedValue([]) } } }))

const base = { state: 'PA', county: null, address: null, layoffType: null, sourceUrl: 'https://www.pa.gov/x', workforceBoardId: null, companyMatchStatus: 'NONE', company: null, fetchedAt: new Date('2026-10-20') }

describe('public notices without a filing date', () => {
  it('uses the effective date minus 60 days and marks the date unknown; dated notices stay known', async () => {
    findMany.mockResolvedValue([
      { ...base, id: 'a', employer: 'Adare Pharmaceuticals, Inc.', employees: 137, noticeDate: null, effectiveDate: new Date('2026-03-01T00:00:00Z') },
      { ...base, id: 'b', employer: 'Dated Co', employees: 10, state: 'OH', noticeDate: new Date('2026-09-01T00:00:00Z'), effectiveDate: null },
      { ...base, id: 'c', employer: 'Future Co', employees: 5, noticeDate: null, effectiveDate: new Date('2027-06-01T00:00:00Z') },
    ])
    const { getPublicNotices } = await import('@/lib/warn/layoff-pages')
    const out = await getPublicNotices()
    const a = out.find((n) => n.id === 'a')!
    expect(a.noticeDateKnown).toBe(false)
    expect(a.noticeDate.toISOString().slice(0, 10)).toBe('2025-12-31')
    expect(out.find((n) => n.id === 'b')!.noticeDateKnown).toBe(true)
    expect(out.find((n) => n.id === 'c')!.noticeDate.getTime()).toBeLessThanOrEqual(Date.now())
    const times = out.map((n) => n.noticeDate.getTime())
    expect(times).toEqual([...times].sort((x, y) => y - x))
  })
})
