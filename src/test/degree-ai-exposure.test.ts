import { describe, it, expect } from 'vitest'
import { degreeExposure, roleMixExposure } from '@/lib/crm/degree-ai-exposure'

describe('degreeExposure', () => {
  it('maps known fields, leaves unknown ones unmapped, and weights by share', () => {
    const r = degreeExposure([
      { field: 'Business & management', share: 0.5 },
      { field: 'Liberal arts & general studies', share: 0.25 },
      { field: 'Health professions', share: 0.25 },
    ])
    expect(r.majors[1].band).toBeNull()
    expect(r.coveredShare).toBeCloseTo(0.75)
    expect(r.highShare).toBeCloseTo(0.5)
    expect(r.weightedExposure).toBeGreaterThan(35)
  })
  it('handles no data', () => {
    expect(degreeExposure(null).weightedExposure).toBeNull()
  })
})

describe('roleMixExposure', () => {
  it('weights by roles and ignores unmatched functions', () => {
    const r = roleMixExposure([{ fn: 'it', roles: 50 }, { fn: 'sales', roles: 30 }, { fn: 'mystery', roles: 20 }])
    expect(r.coveredShare).toBeCloseTo(0.8)
    expect(r.highShare).toBeCloseTo(0.5)
    expect(r.weighted).toBeGreaterThan(50)
  })
  it('returns null with nothing to match', () => {
    expect(roleMixExposure([{ fn: 'mystery', roles: 5 }]).weighted).toBeNull()
  })
})
