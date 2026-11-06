import { describe, expect, it } from 'vitest'
import { analyzePortalUsage, normalizePortalPath, stuckPages } from '@/lib/admin/portal-usage-analysis'

const t = (iso: string) => new Date(iso)
const ev = (candidateId: string, path: string, iso: string) => ({ candidateId, path, createdAt: t(iso) })

describe('normalizePortalPath', () => {
  it('drops query and trailing slash, collapses ids', () => {
    expect(normalizePortalPath('/dashboard/jobs/?q=1')).toBe('/dashboard/jobs')
    expect(normalizePortalPath('/dashboard/jobs/cm1234567890abcdefghijk')).toBe('/dashboard/jobs/:id')
    expect(normalizePortalPath('/Dashboard')).toBe('/dashboard')
    expect(normalizePortalPath(null)).toBeNull()
  })
})

describe('analyzePortalUsage', () => {
  const events = [
    // Ann: visit 1 has three pages ending on /dashboard/resume; visit 2 (2 hours later) is a one-page bounce.
    ev('ann', '/dashboard', '2026-11-02T14:00:00Z'),
    ev('ann', '/dashboard/jobs', '2026-11-02T14:05:00Z'),
    ev('ann', '/dashboard/resume', '2026-11-02T14:10:00Z'),
    ev('ann', '/dashboard', '2026-11-02T16:30:00Z'),
    // Bob: opens the same page three times in one visit.
    ev('bob', '/dashboard/resume', '2026-11-02T15:00:00Z'),
    ev('bob', '/dashboard/resume', '2026-11-02T15:02:00Z'),
    ev('bob', '/dashboard/resume', '2026-11-02T15:04:00Z'),
  ]
  const a = analyzePortalUsage(events, ['2026-11-02'])

  it('splits visits on a 30 minute gap', () => {
    expect(a.members).toBe(2)
    expect(a.visits).toBe(3)
    expect(a.pageViews).toBe(7)
    expect(a.pagesPerVisit.average).toBeCloseTo(7 / 3)
    expect(a.pagesPerVisit.median).toBe(3)
  })
  it('counts exits, bounces and loops per page', () => {
    const resume = a.pages.find((p) => p.page === '/dashboard/resume')!
    expect(resume.exits).toBe(2)
    expect(resume.loops).toBe(1)
    const home = a.pages.find((p) => p.page === '/dashboard')!
    expect(home.bounces).toBe(1)
  })
  it('buckets visit starts by Eastern hour (9 AM EST = 14:00Z)', () => {
    expect(a.startsByHour.weekday[9]).toBe(1)
    expect(a.startsByHour.weekday[10]).toBe(1)
    expect(a.startsByHour.weekday[11]).toBe(1)
  })
  it('ranks stuck pages by exit rate, ignoring thin pages', () => {
    expect(stuckPages(a.pages, 2).map((p) => p.page)).toEqual(['/dashboard/resume'])
    expect(stuckPages(a.pages, 10)).toEqual([])
  })
})
