import { describe, expect, it } from 'vitest'
import { annualPay, displayTitle, titleSlug, GENERIC_TITLES } from '@/lib/seo/job-title-rules'

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
