import { describe, expect, it } from 'vitest'
import {
  classifyWorkType,
  compensationKind,
  defaultWorkTypes,
  hourlyMarketRange,
  parseWorkTypesParam,
  payBasisLabel,
  payComparison,
  payPeriodOf,
  roleProfileWorkType,
  workTypesParam,
} from '@/lib/jobs/work-type'

describe('classifyWorkType', () => {
  it('uses the crawler employment type when sent', () => {
    expect(classifyWorkType({ title: 'VP Finance', employmentType: 'full_time' })).toBe('full_time')
    expect(classifyWorkType({ title: 'VP Finance', employmentType: 'fractional' })).toBe('part_time')
    expect(classifyWorkType({ title: 'VP Finance', employmentType: 'interim' })).toBe('contract')
    expect(classifyWorkType({ title: 'VP Finance', employmentType: 'temporary' })).toBe('contract')
    expect(classifyWorkType({ title: 'VP Finance', employmentType: 'per-diem' })).toBe('part_time')
    expect(classifyWorkType({ title: 'Board member', employmentType: 'board' })).toBe('advisory')
  })

  it('lets a board title win over a crawler full_time', () => {
    expect(classifyWorkType({ title: 'Independent Board Director - Energy Sector', employmentType: 'full_time' })).toBe('advisory')
  })

  it('reads board and advisory seats from the title, but not financial advisors', () => {
    expect(classifyWorkType({ title: 'Volunteer Board Member — Fundraising & Grants' })).toBe('advisory')
    expect(classifyWorkType({ title: 'Community Advisory Board' })).toBe('advisory')
    expect(classifyWorkType({ title: 'Board Seat: Members (Advisory Task Force)' })).toBe('advisory')
    expect(classifyWorkType({ title: 'Non-Executive Director' })).toBe('advisory')
    expect(classifyWorkType({ title: 'Senior Financial Advisor' })).toBe('full_time')
  })

  it('reads part-time and fractional', () => {
    expect(classifyWorkType({ title: 'Fractional Head of Operations' })).toBe('part_time')
    expect(classifyWorkType({ title: 'Sales Manager (Part Time)' })).toBe('part_time')
    expect(classifyWorkType({ title: 'Part-Time Post-Acute Medical Director' })).toBe('part_time')
  })

  it('reads contract engagements but not jobs about contracts', () => {
    expect(classifyWorkType({ title: 'Recruiting Manager - Chewy Vet Care (Contract)' })).toBe('contract')
    expect(classifyWorkType({ title: 'Contract - Senior Technical Recruiter' })).toBe('contract')
    expect(classifyWorkType({ title: 'Senior Recruiter - Contractor (Remote)' })).toBe('contract')
    expect(classifyWorkType({ title: 'Business Development Manager 12 Month Fixed Term Contract' })).toBe('contract')
    expect(classifyWorkType({ title: 'Territory Manager (12 months contract)' })).toBe('contract')
    expect(classifyWorkType({ title: 'Interim CFO' })).toBe('contract')
    expect(classifyWorkType({ title: 'Senior Provider Contract Manager' })).toBe('full_time')
    expect(classifyWorkType({ title: 'Director of Contract Administration' })).toBe('full_time')
    expect(classifyWorkType({ title: 'General Manager, Contract Logistics' })).toBe('full_time')
    expect(classifyWorkType({ title: 'Sr. Contract Compliance Specialist' })).toBe('full_time')
  })

  it('falls back to the description, then full-time', () => {
    expect(classifyWorkType({ title: 'Head of Finance', description: 'This is a 6-month contract role reporting to the CEO.' })).toBe('contract')
    expect(classifyWorkType({ title: 'Head of Finance', description: 'About 20 hours per week, remote.' })).toBe('part_time')
    expect(classifyWorkType({ title: 'Head of Finance', description: 'A full-time role.' })).toBe('full_time')
    expect(classifyWorkType({ title: 'Head of Finance' })).toBe('full_time')
  })
})

describe('pay basis', () => {
  it('labels yearly, hourly, monthly retainer and project pay', () => {
    expect(payBasisLabel({ title: 'VP', salaryMin: 150000, salaryMax: 150000 })).toBe('$150k/yr')
    expect(payBasisLabel({ title: 'VP', salaryMin: 150000, salaryMax: 180000 })).toBe('$150k–$180k/yr')
    expect(payBasisLabel({ title: 'Fractional CFO', salaryMin: 175, salaryMax: 175 })).toBe('$175/hr')
    expect(payBasisLabel({ title: 'Advisor', salaryMin: 5000, salaryMax: 5000, workType: 'part_time' })).toBe('$5k/mo retainer')
    expect(payBasisLabel({ title: 'Consultant', salaryMin: 5000, salaryMax: 5000, workType: 'contract' })).toBe('$5k/mo')
    expect(payBasisLabel({ title: 'Consultant', salaryMin: 10000, salaryMax: 10000, payPeriod: 'one_time' })).toBe('$10k per project')
    expect(payBasisLabel({ title: 'VP', salaryMin: 100000, salaryMax: 120000, salaryCurrency: 'CAD' })).toBe('CAD $100k–$120k/yr')
  })

  it('labels unpaid and equity-only clearly, and nothing when pay is not posted', () => {
    expect(payBasisLabel({ title: 'Volunteer Board Member' })).toBe('Unpaid')
    expect(payBasisLabel({ title: 'Board member', compensationType: 'unpaid', salaryMin: 0 })).toBe('Unpaid')
    expect(payBasisLabel({ title: 'Advisor', description: 'Compensation is equity only.' })).toBe('Equity only')
    expect(payBasisLabel({ title: 'VP' })).toBeNull()
  })

  it('reads the pay period from the import first, then the amount', () => {
    expect(payPeriodOf({ salaryMax: 90, payPeriod: 'YEARLY' })).toBe('year')
    expect(payPeriodOf({ salaryMax: 90 })).toBe('hour')
    expect(payPeriodOf({ salaryMax: 8000 })).toBe('month')
    expect(payPeriodOf({ salaryMax: 140000 })).toBe('year')
    expect(payPeriodOf({})).toBeNull()
  })

  it('does not treat a paid role mentioning volunteers as unpaid', () => {
    expect(compensationKind({ title: 'Director of Volunteer Programs', description: 'Pay: $120,000' })).toBe('paid')
    expect(compensationKind({ title: 'Director', description: 'Lead our volunteer program. Salary $120,000.' })).toBe('paid')
    expect(compensationKind({ title: 'Chief Financial Officer (CFO)', description: 'investment oversight, and volunteer Board governance.' })).toBe('paid')
    expect(compensationKind({ title: 'Board Treasurer', description: 'This is an unpaid volunteer position.' })).toBe('unpaid')
    expect(compensationKind({ title: 'Trustee', description: 'Trustees serve without compensation.' })).toBe('unpaid')
  })
})

describe('market pay comparison', () => {
  it('compares paid full-time only, hourly with hourly', () => {
    expect(payComparison('full_time', 'paid', 'year')).toEqual({ compare: true, basis: 'year' })
    expect(payComparison('full_time', 'paid', 'hour')).toEqual({ compare: true, basis: 'hour' })
    expect(payComparison('contract', 'paid', 'hour').compare).toBe(false)
    expect(payComparison('part_time', 'paid', 'year').compare).toBe(false)
    expect(payComparison('advisory', 'paid', 'month').compare).toBe(false)
    expect(payComparison('full_time', 'unpaid', null)).toEqual({ compare: false, reason: 'Unpaid role' })
    expect(hourlyMarketRange(150000, 200000)).toBe('$72–$96/hr')
  })
})

describe('default work types', () => {
  it('is full-time only for someone who said nothing else', () => {
    expect(defaultWorkTypes({})).toEqual(['full_time'])
    expect(defaultWorkTypes({ interimConsultingInterest: false, boardAdvisoryWillingness: false })).toEqual(['full_time'])
  })
  it('adds part-time and contract for interim interest, advisory for board willingness', () => {
    expect(defaultWorkTypes({ interimConsultingInterest: true })).toEqual(['full_time', 'part_time', 'contract'])
    expect(defaultWorkTypes({ gigDirectoryUnlockAnswer: '$200/hr' })).toEqual(['full_time', 'part_time', 'contract'])
    expect(defaultWorkTypes({ boardAdvisoryWillingness: true })).toEqual(['full_time', 'advisory'])
  })
  it('drops full-time for a next-act journey', () => {
    expect(defaultWorkTypes({ journey: 'NEXT_ACT' })).toEqual(['part_time', 'contract', 'advisory'])
  })
  it('uses the saved choice over everything', () => {
    expect(defaultWorkTypes({ jobBoardWorkTypes: ['advisory', 'bogus'], journey: 'NEXT_ACT' })).toEqual(['advisory'])
    expect(defaultWorkTypes({ jobBoardWorkTypes: ['bogus'] })).toEqual(['full_time'])
  })
})

describe('types URL parameter', () => {
  it('round-trips and ignores junk', () => {
    expect(parseWorkTypesParam('contract,full_time')).toEqual(['full_time', 'contract'])
    expect(parseWorkTypesParam('nope')).toBeNull()
    expect(parseWorkTypesParam(undefined)).toBeNull()
    expect(workTypesParam(['advisory', 'full_time'])).toBe('full_time,advisory')
  })
  it('maps employer role types', () => {
    expect(roleProfileWorkType('BOARD_UNPAID')).toBe('advisory')
    expect(roleProfileWorkType('CONSULTING_PAID')).toBe('contract')
    expect(roleProfileWorkType('FULL_TIME')).toBe('full_time')
  })
})
