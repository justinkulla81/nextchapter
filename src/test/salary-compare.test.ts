import { describe, expect, it } from 'vitest'
import { costsFor } from '@/lib/market/area-costs'
import { jobVsLastSalary, postingAnnualMid, roleVsLastSalaryLine } from '@/lib/market/salary-compare'

const raleigh = costsFor({ metroCode: '39580' })
const columbus = costsFor({ metroCode: '18140' })

describe('postingAnnualMid', () => {
  it('takes the middle of an annual range', () => {
    expect(postingAnnualMid({ salaryMin: 120000, salaryMax: 140000, payPeriod: 'year' })).toBe(130000)
    expect(postingAnnualMid({ salaryMin: null, salaryMax: 150000, payPeriod: 'year' })).toBe(150000)
  })
  it('annualises hourly pay at 2,080 hours and skips other periods and currencies', () => {
    expect(postingAnnualMid({ salaryMin: 50, salaryMax: 60, payPeriod: 'hour' })).toBe(114400)
    expect(postingAnnualMid({ salaryMin: 9000, salaryMax: 10000, payPeriod: 'month' })).toBeNull()
    expect(postingAnnualMid({ salaryMin: 100000, salaryMax: 120000, payPeriod: 'year', salaryCurrency: 'EUR' })).toBeNull()
    expect(postingAnnualMid({ salaryMin: null, salaryMax: null, payPeriod: 'year' })).toBeNull()
  })
})

describe('jobVsLastSalary', () => {
  it('compares dollars as posted when there is no other place', () => {
    const r = jobVsLastSalary({ mid: 132000, lastSalary: 120000, home: raleigh, there: null })!
    expect(r.line).toBe('Midpoint $132,000 is 10% more than your last salary of $120,000.')
    expect(r.note).not.toMatch(/Census/)
  })
  it('says less, and about the same', () => {
    expect(jobVsLastSalary({ mid: 90000, lastSalary: 120000, home: null, there: null })!.line).toContain('25% less than your last salary')
    expect(jobVsLastSalary({ mid: 120000, lastSalary: 120000, home: null, there: null })!.line).toContain('about the same as your last salary')
  })
  it('names the home place and the source when the job is in another metro area', () => {
    const r = jobVsLastSalary({ mid: 130000, lastSalary: 120000, home: raleigh, there: columbus })!
    expect(r.line).toMatch(/^Midpoint \$130,000 in Columbus, OH covers about what \$[\d,]+ does in Raleigh-Cary, NC, /)
    expect(r.line).toMatch(/than your last salary of \$120,000\.$/)
    expect(r.note).toContain('Census Bureau')
  })
  it('uses plain dollars for the same metro area', () => {
    expect(jobVsLastSalary({ mid: 130000, lastSalary: 120000, home: raleigh, there: raleigh })!.line).toBe('Midpoint $130,000 is 8% more than your last salary of $120,000.')
  })
  it('flags dollars that are not adjusted for prices', () => {
    expect(jobVsLastSalary({ mid: 130000, lastSalary: 120000, home: raleigh, there: null, placeNotAdjusted: true })!.line).toContain('before adjusting for prices where the job is')
  })
  it('avoids verdict words', () => {
    const r = jobVsLastSalary({ mid: 130000, lastSalary: 120000, home: raleigh, there: columbus })!
    expect(`${r.line} ${r.note}`).not.toMatch(/\b(safe|risk|will)\b/i)
  })
})

describe('roleVsLastSalaryLine', () => {
  it('names the place and the comparison', () => {
    expect(roleVsLastSalaryLine({ pay: 132000, atLeast: false, lastSalary: 120000, areaName: 'Raleigh, NC' })).toBe('Typical pay for this role in Raleigh, NC is $132,000, which is 10% more than your last salary of $120,000.')
  })
  it('says at least for a floor, and says nothing when the floor is below the last salary', () => {
    expect(roleVsLastSalaryLine({ pay: 239200, atLeast: true, lastSalary: 200000, areaName: 'nationwide' })).toBe('Typical pay for this role nationwide is $239,200 or more, at least 20% more than your last salary of $200,000.')
    expect(roleVsLastSalaryLine({ pay: 239200, atLeast: true, lastSalary: 300000, areaName: 'nationwide' })).toBeNull()
  })
})
