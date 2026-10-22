import { describe, it, expect } from 'vitest'
import { degreeExposure } from '@/lib/crm/degree-ai-exposure'

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
