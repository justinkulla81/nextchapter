import { describe, it, expect } from 'vitest'
import { scorePartner, logScale } from '@/lib/geo/partner-scoring'

describe('partner scoring', () => {
  const rich = { whiteCollarShare: 0.5, laborForce: 1_500_000, layoffs12mo: 5000, layoffs90d: 1500, wcUnemploymentEst: 0.05 }
  it('ranks a reachable board in a professional, high-layoff area above a bare one', () => {
    const good = scorePartner({ kind: 'WIOA_BOARD', area: rich, hasName: true, hasEmail: true, hasPhone: true, hasWebsite: true })
    const bare = scorePartner({ kind: 'WIOA_BOARD', area: { whiteCollarShare: 0.3, laborForce: 30_000, layoffs12mo: 60 }, hasName: false, hasEmail: false, hasPhone: false, hasWebsite: false })
    expect(good.total).toBeGreaterThan(bare.total + 40)
    expect(good.total).toBeLessThanOrEqual(100)
  })
  it('scores missing area data as neutral and says so', () => {
    const s = scorePartner({ kind: 'EDD', area: {}, hasName: true, hasEmail: true, hasPhone: false, hasWebsite: true })
    expect(s.coverage).toBeLessThan(0.6)
    expect(s.parts.find((p) => p.key === 'whiteCollar')!.known).toBe(false)
  })
  it('marks youth and veteran nonprofits down', () => {
    const base = { kind: 'NONPROFIT_WORKFORCE' as const, area: rich, hasName: true, hasEmail: true, hasPhone: true, hasWebsite: true, revenue: 5e6 }
    expect(scorePartner({ ...base, name: 'Youth Opportunity Council' }).total).toBeLessThan(scorePartner({ ...base, name: 'Career Transition Network' }).total)
  })
  it('lifts a comprehensive job center with a business rep over an affiliate without one', () => {
    const b = { kind: 'AJC' as const, area: rich, hasName: false, hasEmail: true, hasPhone: true, hasWebsite: false }
    expect(scorePartner({ ...b, ajcType: 'Comprehensive', hasBusinessRep: true }).total).toBeGreaterThan(scorePartner({ ...b, ajcType: 'Affiliate', hasBusinessRep: false }).total)
  })
})

describe('scales', () => {
  it('log scale clamps', () => { expect(logScale(1, 1000, 1e6)).toBe(0); expect(logScale(1e9, 1000, 1e6)).toBe(1); expect(logScale(null, 1, 2)).toBeNull() })
})
