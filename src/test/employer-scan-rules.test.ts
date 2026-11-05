import { describe, expect, it } from 'vitest'
import { looksLikeCompanyName } from '@/lib/branding/employer-scan-rules'

describe('which layoff employers are read for colors', () => {
  it('accepts ordinary company names', () => {
    for (const n of ['Dell', 'American Express', 'Zillow Group', 'Wells Fargo', 'Johnson & Johnson']) expect(looksLikeCompanyName(n)).toBe(true)
  })
  it('rejects addresses, sites and notes', () => {
    expect(looksLikeCompanyName('Spirit Airlines Orlando International Airport (MCO) 1 Jeff Fuqua Blvd, Orlando ORLANDO, FL, 32827')).toBe(false)
    expect(looksLikeCompanyName('Intel Corporation - SC-12 facility')).toBe(false)
    expect(looksLikeCompanyName('*Updated* Community Healthlink')).toBe(false)
    expect(looksLikeCompanyName('Ficosa North America-Revised')).toBe(false)
    expect(looksLikeCompanyName('AB')).toBe(false)
  })
})
