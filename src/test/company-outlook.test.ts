import { describe, expect, it } from 'vitest'
import { companyOutlook } from '@/lib/seo/company-outlook'

const NOW = Date.parse('2026-11-02T00:00:00Z')
const base = { layoffs12: 0, layoffs12to24: 0, fundraises12: 0, federal: null, hiring: null, now: NOW }

describe('company outlook', () => {
  it('is Building when hiring is brisk and capital was raised', () => {
    const o = companyOutlook({ ...base, hiring: { openNow: 20, opened90d: 12 }, fundraises12: 1 })
    expect(o.label).toBe('Building')
    expect(o.evidence.join(' ')).toContain('No layoff notices')
  })
  it('is capped at Cooling by a layoff notice in the last 12 months, whatever else is true', () => {
    expect(companyOutlook({ ...base, hiring: { openNow: 30, opened90d: 20 }, fundraises12: 2, layoffs12: 1, federal: { awards: 3, latestStart: new Date('2026-09-01') } }).label).toBe('Cooling')
  })
  it('is Steady with an older notice and brisk hiring', () => {
    expect(companyOutlook({ ...base, hiring: { openNow: 20, opened90d: 12 }, layoffs12to24: 1 }).label).toBe('Steady')
  })
  it('counts a federal award only if it is recent', () => {
    const old = companyOutlook({ ...base, hiring: { openNow: 5, opened90d: 0 }, federal: { awards: 2, latestStart: new Date('2024-01-01') } })
    expect(old.label).toBe('Not enough data')
  })
  it('needs two sources with data', () => {
    expect(companyOutlook({ ...base, hiring: { openNow: 40, opened90d: 30 } }).label).toBe('Not enough data')
    expect(companyOutlook(base).evidence).toEqual([])
  })
})
