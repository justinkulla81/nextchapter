import { describe, it, expect } from 'vitest'
import { parsePackageWishes } from '@/lib/review-prep/package-wishes'
import { benefitsAsks } from '@/lib/review-prep/benefits'

const blank = { ptoWeeksExpected: null, remoteDaysPerWeekDesired: null, paidParentalLeaveWeeksExpected: null }

describe('parsePackageWishes', () => {
  it('treats ticked benefits as yes and unticked as no', () => {
    const r = parsePackageWishes({ benefits: ['wants401kMatch', 'wantsGymMembership', 'notABenefit'], numbers: blank })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.wishes.wants401kMatch).toBe(true)
    expect(r.wishes.wantsGymMembership).toBe(true)
    expect(r.wishes.wantsDisabilityInsurance).toBe(false)
    expect(r.wishes).not.toHaveProperty('notABenefit')
  })

  it('reads blank numbers as no preference and whole numbers as given', () => {
    const r = parsePackageWishes({ benefits: [], numbers: { ptoWeeksExpected: '4', remoteDaysPerWeekDesired: '  ', paidParentalLeaveWeeksExpected: '0' } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.wishes.ptoWeeksExpected).toBe(4)
    expect(r.wishes.remoteDaysPerWeekDesired).toBeNull()
    expect(r.wishes.paidParentalLeaveWeeksExpected).toBe(0)
  })

  it('names the field when a number is out of range or not whole', () => {
    const tooMany = parsePackageWishes({ benefits: [], numbers: { ...blank, remoteDaysPerWeekDesired: '6' } })
    expect(tooMany).toEqual({ ok: false, error: 'Days a week working from home: enter a whole number from 0 to 5, or leave it blank.' })
    const decimal = parsePackageWishes({ benefits: [], numbers: { ...blank, ptoWeeksExpected: '2.5' } })
    expect(decimal.ok).toBe(false)
  })

  it('feeds the ask list the same way the old yes/no answers did', () => {
    const r = parsePackageWishes({ benefits: ['wantsCommuterBenefits'], numbers: { ...blank, ptoWeeksExpected: '3' } })
    if (!r.ok) throw new Error('expected ok')
    expect(benefitsAsks(r.wishes)).toEqual(['3 weeks of paid time off', 'Commuter benefits'])
  })
})
