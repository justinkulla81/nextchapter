import { describe, expect, it } from 'vitest'
import { calculateSeverance } from '@/lib/tools/severance'

describe('calculateSeverance', () => {
  it('shows one to two weeks per year of service by default', () => {
    const r = calculateSeverance({ annualPay: 104000, yearsOfService: 5 })
    expect(r.weeklyPay).toBe(2000)
    expect([r.lowWeeks, r.highWeeks]).toEqual([5, 10])
    expect([r.low, r.high]).toEqual([10000, 20000])
  })
  it('uses the offer’s own rate when given', () => {
    const r = calculateSeverance({ annualPay: 52000, yearsOfService: 3, weeksPerYear: 2 })
    expect([r.low, r.high]).toEqual([6000, 6000])
  })
  it('values employer-paid coverage', () => {
    expect(calculateSeverance({ annualPay: 52000, yearsOfService: 1, coverageMonths: 6, cobraMonthly: 700 }).coverageValue).toBe(4200)
  })
})
