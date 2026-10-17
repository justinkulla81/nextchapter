import { describe, expect, it } from 'vitest'
import { ROLE_SOC, growthWords, outlookForRole, outlookLine, outlookMultiplier } from './occupation-outlook'
import { ROLES } from './pivot-map'

describe('occupation outlook', () => {
  it('maps only real roles, to SOC codes', () => {
    for (const [role, soc] of Object.entries(ROLE_SOC)) {
      expect(ROLES.has(role), role).toBe(true)
      expect(soc).toMatch(/^\d{2}-\d{4}\.\d{2}$/)
    }
  })

  it('has imported data for most mapped occupations', () => {
    const socs = [...new Set(Object.values(ROLE_SOC))]
    const found = socs.filter((s) => Object.entries(ROLE_SOC).some(([r, x]) => x === s && outlookForRole(r)))
    expect(found.length / socs.length).toBeGreaterThan(0.8)
  })

  it('uses BLS growth wording', () => {
    expect(growthWords(34)).toBe('much faster than average')
    expect(growthWords(5)).toBe('faster than average')
    expect(growthWords(3)).toBe('about as fast as average')
    expect(growthWords(0)).toBe('little or no change')
    expect(growthWords(-6)).toBe('declining')
  })

  it('writes a plain line and nudges ranking by growth, not the Bright Outlook flag', () => {
    const base = { soc: 'x', title: 't', annualOpenings: 1, medianWage: 1, wageYear: '2025', baseYear: '2024', projectedYear: '2034' }
    expect(outlookLine({ ...base, pctChange: 6, brightOutlook: true })).toBe('Projected to grow 6% from 2024 to 2034 (faster than average). O*NET Bright Outlook.')
    expect(outlookLine({ ...base, pctChange: -6, brightOutlook: false })).toBe('Projected to shrink 6% from 2024 to 2034.')
    expect(outlookMultiplier({ ...base, pctChange: -6, brightOutlook: true })).toBeLessThan(1)
    expect(outlookMultiplier({ ...base, pctChange: 15, brightOutlook: false })).toBeGreaterThan(1)
    expect(outlookMultiplier(null)).toBe(1)
  })

  it('gives no outlook for roles without one honest SOC match', () => {
    expect(outlookForRole('customer_success')).toBeNull()
    expect(outlookForRole('product_management')).toBeNull()
  })
})
