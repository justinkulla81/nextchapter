import { describe, expect, it } from 'vitest'
import { exposureComparisonLine, payChangeLine } from '@/lib/skills/pivot-exposure'
import type { OccupationExposure } from '@/lib/skills/ai-exposure'

const some: OccupationExposure = { soc6: '13-2011', title: 'Accountants', score: 0.2, band: 'some' }
const high: OccupationExposure = { soc6: '15-1251', title: 'Programmers', score: 0.7, band: 'high' }

describe('exposureComparisonLine', () => {
  it('compares when both are measured', () => {
    expect(exposureComparisonLine(some, high)).toBe('Your current role: Some. This role: High.')
  })
  it('says nothing when either is missing', () => {
    expect(exposureComparisonLine(null, high)).toBeNull()
    expect(exposureComparisonLine(some, null)).toBeNull()
  })
})

describe('payChangeLine', () => {
  it('words more, less, same and floor', () => {
    expect(payChangeLine(12, false)).toBe('Pays 12% more than your field')
    expect(payChangeLine(-8, false)).toBe('Pays 8% less than your field')
    expect(payChangeLine(0, false)).toBe('Pays about the same as your field')
    expect(payChangeLine(30, true)).toBe('Pays at least 30% more than your field')
    expect(payChangeLine(null, false)).toBeNull()
  })
})
