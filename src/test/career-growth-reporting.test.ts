import { describe, expect, it } from 'vitest'
import { GROWTH_MEASURES, growthRows } from '@/lib/employer/career-growth-metrics'

describe('career growth reporting for a company', () => {
  it('shows nothing for a cohort under 10', () => {
    const rows = growthRows(9, { wins: 9, active: 9 }, { wins: 'Logged a work win', active: 'Signed in' })
    expect(rows.every((r) => r.count === null && r.pct === null)).toBe(true)
  })
  it('rounds to the nearest 5 under 50 and is exact at 50 or more', () => {
    expect(growthRows(23, { wins: 12 }, {})[0]).toMatchObject({ count: 10, pct: 50 })
    expect(growthRows(60, { wins: 17 }, {})[0]).toMatchObject({ count: 17, pct: 28 })
  })
  it('never measures anything that looks like a job search', () => {
    const banned = /reference|applic|interview|offer|search|journey|stage|mood|recruiter|resume|dossier/i
    for (const m of GROWTH_MEASURES) {
      expect(m.key, m.key).not.toMatch(banned)
      expect(m.label, m.label).not.toMatch(banned)
      expect(JSON.stringify(m.where), m.key).not.toMatch(banned)
    }
  })
})
