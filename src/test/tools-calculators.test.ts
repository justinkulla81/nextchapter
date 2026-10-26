import { describe, expect, it } from 'vitest'
import { convertAll, toYearly, validSchedule } from '@/lib/tools/salary-convert'
import { calculateRunway } from '@/lib/tools/runway'
import { estimateUi } from '@/lib/tools/ui-estimate'

describe('salary converter', () => {
  it('converts a full-time schedule', () => {
    expect(toYearly(25, 'hour')).toBe(52_000)
    const all = convertAll(104_000, 'year')
    expect(all.hour).toBeCloseTo(50, 5)
    expect(all.week).toBeCloseTo(2000, 5)
    expect(all.biweek).toBeCloseTo(4000, 5)
    expect(all.month).toBeCloseTo(8666.67, 1)
    expect(all.day).toBeCloseTo(400, 5)
  })
  it('follows a part-time schedule', () => {
    expect(toYearly(20, 'hour', { hoursPerWeek: 20, weeksPerYear: 50 })).toBe(20_000)
    expect(validSchedule({ hoursPerWeek: 0, weeksPerYear: 52 })).toBe(false)
    expect(validSchedule({ hoursPerWeek: 40, weeksPerYear: 53 })).toBe(false)
  })
})

describe('runway', () => {
  it('divides money by spending without benefits', () => {
    const r = calculateRunway({ savings: 12_000, monthlyExpenses: 4000, severance: 0, weeklyBenefit: 0, benefitWeeks: 0 })
    expect(r.monthsWithoutBenefits).toBe(3)
    expect(r.monthsWithBenefits).toBeCloseTo(3, 5)
  })
  it('counts benefits only for the weeks they last', () => {
    const none = calculateRunway({ savings: 20_000, monthlyExpenses: 4000, severance: 4000, weeklyBenefit: 400, benefitWeeks: 26 })
    expect(none.monthsWithBenefits).toBeGreaterThan(none.monthsWithoutBenefits)
    expect(none.benefitsTotal).toBe(10_400)
    // 24,000 / 4,000 = 6 months bare; 26 weeks of $400 = 10,400 extends it past 8 months.
    expect(none.monthsWithBenefits).toBeGreaterThan(8)
    expect(none.monthsWithBenefits).toBeLessThan(9)
  })
  it('handles zero spending', () => {
    expect(calculateRunway({ savings: 1000, monthlyExpenses: 0, severance: 0, weeklyBenefit: 0, benefitWeeks: 0 }).monthsWithBenefits).toBe(0)
  })
})

describe('unemployment estimate', () => {
  it('takes half of weekly pay up to the state maximum', () => {
    expect(estimateUi({ annualPay: 52_000, maxWeekly: 600, minWeekly: 50, maxWeeks: 26 })).toEqual({ weekly: 500, weeks: 26, total: 13_000, cappedAtMax: false })
    expect(estimateUi({ annualPay: 150_000, maxWeekly: 450, minWeekly: 50, maxWeeks: 26 })?.cappedAtMax).toBe(true)
    expect(estimateUi({ annualPay: 150_000, maxWeekly: 450, minWeekly: 50, maxWeeks: 26 })?.weekly).toBe(450)
  })
  it('respects the minimum and unknown limits', () => {
    expect(estimateUi({ annualPay: 5200, maxWeekly: null, minWeekly: 100, maxWeeks: null })).toEqual({ weekly: 100, weeks: null, total: null, cappedAtMax: false })
    expect(estimateUi({ annualPay: 0, maxWeekly: 500, minWeekly: null, maxWeeks: 26 })).toBeNull()
  })
})
