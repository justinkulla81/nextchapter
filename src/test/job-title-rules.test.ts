import { describe, expect, it } from 'vitest'
import { annualPay, baseTitle, comparePay, displayTitle, titleSlug, GENERIC_TITLES } from '@/lib/seo/job-title-rules'

describe('job title rules', () => {
  it('makes a slug and a display name', () => {
    expect(titleSlug('senior software engineer')).toBe('senior-software-engineer')
    expect(titleSlug('finance & accounting manager')).toBe('finance-and-accounting-manager')
    expect(displayTitle('director of hr operations')).toBe('Director of HR Operations')
  })
  it('keeps broad titles off the page list', () => {
    expect(GENERIC_TITLES.has('director')).toBe(true)
    expect(GENERIC_TITLES.has('product manager')).toBe(false)
  })
  it('annualizes stated pay and drops unusable figures', () => {
    expect(annualPay(100000, 120000, 'year')).toBe(110000)
    expect(annualPay(50, 60, 'hour')).toBe(114400)
    expect(annualPay(100, 100000, 'year')).toBeNull()
    expect(annualPay(5000, 6000, 'month')).toBeNull()
    expect(annualPay(null, null, 'year')).toBeNull()
  })
})

describe('pay against the market', () => {
  it('cuts a title the way the salary pages group it', () => {
    expect(baseTitle('Senior Software Engineer - Payments Team')).toBe('senior software engineer')
    expect(baseTitle('Product Manager, Growth (Remote)')).toBe('product manager')
    expect(baseTitle('  Data   Analyst | Hybrid ')).toBe('data analyst')
    expect(baseTitle('Full-Stack Engineer')).toBe('full-stack engineer')
  })
  it('places a listing against the quarters and median', () => {
    expect(comparePay(null, 90000, 100000, 120000)).toEqual({ position: null, vsMedianPct: null })
    expect(comparePay(80000, 90000, 100000, 120000)).toEqual({ position: 'below', vsMedianPct: -20 })
    expect(comparePay(110000, 90000, 100000, 120000)).toEqual({ position: 'within', vsMedianPct: 10 })
    expect(comparePay(150000, 90000, 100000, 120000)).toEqual({ position: 'above', vsMedianPct: 50 })
  })
})
