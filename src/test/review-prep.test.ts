import { describe, expect, it } from 'vitest'
import { benefitsAsks } from '@/lib/review-prep/benefits'
import { buildCase, type CaseInput } from '@/lib/review-prep/case'

const empty: CaseInput = { trackRecord: null, workSamples: [], quotes: [], completedReferences: 0, learning: [] }
const now = new Date('2026-10-13T00:00:00Z')

describe('build your case', () => {
  it('an empty case says what to do first, with a reason and a place', () => {
    const c = buildCase({ ...empty, now })
    expect(c.strength).toBe('STARTING')
    expect(c.gaps.map((g) => g.key)).toEqual(['trackRecord', 'workSamples', 'references', 'learning'])
    for (const g of c.gaps) {
      expect(g.why.length).toBeGreaterThan(20)
      expect(g.href.startsWith('/dashboard')).toBe(true)
    }
  })
  it('turns the Track Record into plain facts, only for what was recorded', () => {
    const c = buildCase({
      ...empty,
      now,
      trackRecord: { largestTeamManaged: 'SIX_TO_TWENTY', peopleHiredDirectly: 'NONE', budgetOwned: 'ONE_M_TO_10M', largestInitiativeScope: null, pnlAccountability: null, boardExposure: null, geographicScope: null, reportedToLevel: null, ledThroughRestructuring: true },
    })
    expect(c.results).toEqual(['Led a team of 6-20 people', 'Owned a budget of $1M-$10M', 'Led a team through a restructuring'])
    expect(c.gaps.map((g) => g.key)).not.toContain('trackRecord')
  })
  it('a work sample with a before and after shows the numbers; one without asks for the result', () => {
    const c = buildCase({
      ...empty,
      now,
      workSamples: [
        { title: 'Onboarding rebuild', outcome: null, beforeMetric: '14 days', afterMetric: '6 days' },
        { title: 'Vendor cleanup', outcome: null, beforeMetric: null, afterMetric: null },
      ],
    })
    expect(c.samples[0].line).toBe('14 days to 6 days')
    expect(c.samples[1].line).toMatch(/Add the result/)
  })
  it('only counts learning from the last year', () => {
    const c = buildCase({ ...empty, now, learning: [{ title: 'Old course', completedAt: new Date('2024-01-01') }, { title: 'New course', completedAt: new Date('2026-06-01') }] })
    expect(c.learning).toEqual(['New course'])
  })
  it('is strong only when results, samples, quotes and learning are all there', () => {
    const c = buildCase({
      now,
      trackRecord: { largestTeamManaged: 'ONE_TO_FIVE', peopleHiredDirectly: null, budgetOwned: null, largestInitiativeScope: null, pnlAccountability: null, boardExposure: null, geographicScope: null, reportedToLevel: null, ledThroughRestructuring: null },
      workSamples: [{ title: 'A', outcome: 'Did it', beforeMetric: null, afterMetric: null }],
      quotes: [{ theme: 'Under pressure', quoteText: 'Steady.' }],
      completedReferences: 3,
      learning: [{ title: 'Course', completedAt: new Date('2026-08-01') }],
    })
    expect(c.strength).toBe('STRONG')
    expect(c.gaps).toEqual([])
  })
})

describe('what to ask for besides pay', () => {
  const none = { wantsHealthDentalVisionInsurance: null, wantsDisabilityInsurance: null, wants401kMatch: null, ptoWeeksExpected: null, remoteDaysPerWeekDesired: null, paidParentalLeaveWeeksExpected: null, wantsProfessionalDevReimbursement: null, wantsCommuterBenefits: null, wantsGymMembership: null }
  it('lists only what the member said they want', () => {
    expect(benefitsAsks(none)).toEqual([])
    expect(benefitsAsks({ ...none, wants401kMatch: true, wantsGymMembership: false, ptoWeeksExpected: 4, remoteDaysPerWeekDesired: 1 })).toEqual(['A 401(k) match', '4 weeks of paid time off', '1 remote day a week'])
  })
})
