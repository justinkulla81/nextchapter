import { describe, expect, it } from 'vitest'
import { buildRelease, parseReleaseSlug, pctChange, releaseMonths, releaseSlugOf, stateTotals } from '@/lib/press/layoff-release-core'
import type { PublicNotice } from '@/lib/warn/layoff-pages'

let seq = 0
const notice = (date: string, state: string, employer: string, workers: number | null): PublicNotice => ({
  id: `n${seq++}`, state, employer, slug: employer.toLowerCase().replace(/\W+/g, '-'), place: null, city: null, workers,
  noticeDate: new Date(`${date}T12:00:00Z`), noticeDateKnown: true, fetchedAt: new Date(`${date}T12:00:00Z`), effectiveDate: null,
  type: null, division: null, sourceUrl: null, board: null,
})
const many = (date: string, count: number, state = 'TX', workers: number | null = 10) => Array.from({ length: count }, (_, i) => notice(date, state, `Employer ${state}${date}${i}`, workers))

const NOW = new Date('2026-11-05T00:00:00Z')

describe('slugs', () => {
  it('parses YYYY-MM and nothing else', () => {
    expect(parseReleaseSlug('2026-10')?.label).toBe('October 2026')
    expect(parseReleaseSlug('2026-13')).toBeNull()
    expect(parseReleaseSlug('october')).toBeNull()
    expect(parseReleaseSlug('2026-1')).toBeNull()
    expect(releaseSlugOf(2026, 0)).toBe('2026-01')
  })
})

describe('pctChange', () => {
  it('rounds and refuses a zero base', () => {
    expect(pctChange(150, 100)).toBe(50)
    expect(pctChange(80, 100)).toBe(-20)
    expect(pctChange(5, 0)).toBeNull()
  })
})

describe('buildRelease', () => {
  const all = [...many('2026-08-10', 12), ...many('2026-09-10', 20), ...many('2026-10-10', 30, 'CA', 50), ...many('2025-10-10', 15)]

  it('counts the month and compares with the month before and a year earlier', () => {
    const r = buildRelease(all, 2026, 9, NOW)!
    expect(r.notices).toBe(30)
    expect(r.workers).toBe(1500)
    expect(r.vsPrevious).toMatchObject({ label: 'September 2026', notices: 20, noticesPct: 50 })
    expect(r.vsLastYear).toMatchObject({ label: 'October 2025', notices: 15, noticesPct: 100 })
    expect(r.findings[0]).toContain('30 layoff notices dated October 2026')
    expect(r.findings.some((f) => f.includes('up 50%'))).toBe(true)
    expect(r.highestNoticesOfYear).toBe(true)
  })

  it('names the state with the most notices and the largest single filing', () => {
    const r = buildRelease([...all, notice('2026-10-12', 'NY', 'Big Co', 900)], 2026, 9, NOW)!
    expect(r.topStates[0].state).toBe('CA')
    expect(r.largest).toMatchObject({ employer: 'Big Co', workers: 900 })
    expect(r.findings.some((f) => f.includes('900 people at Big Co'))).toBe(true)
  })

  it('flags the current month as partial and never calls it the highest', () => {
    const r = buildRelease(many('2026-11-02', 40), 2026, 10, NOW)!
    expect(r.partial).toBe(true)
    expect(r.highestNoticesOfYear).toBe(false)
  })

  it('gives no last-year comparison when that month falls outside the 24-month window', () => {
    const r = buildRelease([...many('2024-10-10', 5), ...many('2024-12-10', 12)], 2024, 11, new Date('2026-11-05T00:00:00Z'))!
    expect(r.vsLastYear).toBeNull()
  })

  it('returns null for a month with no notices', () => {
    expect(buildRelease(all, 2026, 3, NOW)).toBeNull()
  })

  it('ranks states by notices, then people', () => {
    expect(stateTotals([notice('2026-10-01', 'TX', 'A', 5), notice('2026-10-01', 'TX', 'B', 5), notice('2026-10-01', 'CA', 'C', 900)])[0].state).toBe('TX')
  })
})

describe('releaseMonths', () => {
  it('lists complete months with enough notices, newest first, never the current month', () => {
    const all = [...many('2026-08-10', 12), ...many('2026-09-10', 9), ...many('2026-10-10', 30), ...many('2026-11-02', 40)]
    expect(releaseMonths(all, NOW).map((s) => s.slug)).toEqual(['2026-10', '2026-08'])
  })
})
