import { describe, expect, it } from 'vitest'
import { checkWarn } from '@/lib/tools/warn-check'

const base = { employerFullTime: 300, siteFullTime: 200, lossesAtSite: 10, isShutdown: false }

describe('checkWarn', () => {
  it('does not cover an employer under 100 full-time employees', () => {
    expect(checkWarn({ ...base, employerFullTime: 99, lossesAtSite: 60, isShutdown: true }).verdict).toBe('not_covered_employer')
  })
  it('requires notice for a plant closing of 50 or more', () => {
    expect(checkWarn({ ...base, lossesAtSite: 50, isShutdown: true }).verdict).toBe('notice_likely_required')
    expect(checkWarn({ ...base, lossesAtSite: 49, isShutdown: true }).verdict).toBe('notice_likely_not_required')
  })
  it('requires notice for a mass layoff of 500 or more at a site', () => {
    expect(checkWarn({ ...base, siteFullTime: 5000, lossesAtSite: 500 }).verdict).toBe('notice_likely_required')
  })
  it('requires notice at 50 to 499 only when at least a third of the site', () => {
    expect(checkWarn({ ...base, siteFullTime: 150, lossesAtSite: 50 }).verdict).toBe('notice_likely_required')
    expect(checkWarn({ ...base, siteFullTime: 151, lossesAtSite: 50 }).verdict).toBe('notice_likely_not_required')
  })
  it('does not require notice for a small layoff', () => {
    expect(checkWarn(base).verdict).toBe('notice_likely_not_required')
  })
})
