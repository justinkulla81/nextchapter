import { describe, expect, it } from 'vitest'
import { bandFor, buildReadiness, coverRows, LIFE_CONVERSION_DAYS, windowDate } from '@/lib/tools/readiness'

const state = { maxWeekly: 500, minWeekly: 100, maxWeeks: 26 }
const base = { annualPay: 78_000, savings: 12_000, monthlyExpenses: 4_000, severance: 0, state, throughWork: { health: true, life: true, disability: false } }

describe('bandFor', () => {
  it('splits at three and six months', () => {
    expect(bandFor(2.9)).toBe('thin')
    expect(bandFor(3)).toBe('workable')
    expect(bandFor(6)).toBe('workable')
    expect(bandFor(6.1)).toBe('strong')
  })
})

describe('buildReadiness', () => {
  it('measures the band on savings alone, not on estimated benefits', () => {
    const r = buildReadiness(base)
    expect(r.monthsWithoutBenefits).toBeCloseTo(3)
    expect(r.band).toBe('workable')
    expect(r.monthsWithBenefits).toBeGreaterThan(r.monthsWithoutBenefits)
    expect(r.ui?.weekly).toBe(500) // half of 1500 a week is 750, held at the 500 maximum
    expect(r.ui?.cappedAtMax).toBe(true)
  })

  it('counts severance toward the cushion and the gap to six months', () => {
    const r = buildReadiness({ ...base, severance: 12_000 })
    expect(r.monthsWithoutBenefits).toBeCloseTo(6)
    expect(r.gapToSixMonths).toBe(0)
    expect(buildReadiness(base).gapToSixMonths).toBe(12_000)
  })

  it('suggests building a cushion only when it is thin', () => {
    const thin = buildReadiness({ ...base, savings: 2_000 })
    expect(thin.band).toBe('thin')
    expect(thin.actions.some((a) => a.id === 'cushion')).toBe(true)
    expect(buildReadiness(base).actions.some((a) => a.id === 'cushion')).toBe(false)
  })

  it('only adds actions for cover the person has', () => {
    const none = buildReadiness({ ...base, throughWork: { health: false, life: false, disability: false } })
    expect(none.cover).toEqual([])
    expect(none.actions.some((a) => a.id === 'cobra' || a.id === 'certificates')).toBe(false)
    const all = buildReadiness(base)
    expect(all.actions.some((a) => a.id === 'cobra')).toBe(true)
    expect(all.actions.some((a) => a.id === 'certificates')).toBe(true)
  })

  it('has no benefit estimate without a state', () => {
    const r = buildReadiness({ ...base, state: null })
    expect(r.ui).toBeNull()
    expect(r.monthsWithBenefits).toBeCloseTo(r.monthsWithoutBenefits)
  })
})

describe('coverRows', () => {
  it('lists health, life, disability in that order with their windows', () => {
    const rows = coverRows({ health: true, life: true, disability: true })
    expect(rows.map((r) => r.cover)).toEqual(['health', 'life', 'disability'])
    expect(rows[0].windowDays).toBe(60)
    expect(rows[1].windowDays).toBe(LIFE_CONVERSION_DAYS)
    expect(rows[2].windowDays).toBeNull()
  })
})

describe('windowDate', () => {
  it('counts days from the last day', () => {
    expect(windowDate(new Date(Date.UTC(2026, 0, 1)), 31).toISOString().slice(0, 10)).toBe('2026-02-01')
  })
})
