import { describe, expect, it } from 'vitest'
import { assessConference, type ConferenceFactInput } from '@/lib/seo/topic-quality'

const thin: ConferenceFactInput = {
  datesConfirmed: true, startDate: '2027-03-01', typicalMonth: null, format: 'IN_PERSON', city: 'Austin', state: 'TX', access: 'PAID', costLow: 500, costHigh: 900,
  speaking: 'UNKNOWN', speakingDeadline: null, organizer: 'Example Association', seniorities: [], roles: [], programFormats: [], whyAttend: null, cheaperWays: null,
  verified: false, checkedAt: null, industries: ['Finance'], functions: [],
}

describe('assessConference with employers and speakers', () => {
  it('a thin row stays below the bar', () => {
    expect(assessConference(thin, false, 0).indexable).toBe(false)
  })
  it('a sourced employer list and a sourced speaker list each add a fact, and the employer list a link', () => {
    const base = assessConference(thin, false, 0)
    const richer = assessConference(thin, false, 0, 0, { employers: 12, speakers: 8 })
    expect(richer.facts).toBe(base.facts + 2)
    expect(richer.links).toBe(base.links + 1)
  })
  it('crosses the bar when the row is one fact short and has both lists', () => {
    const nearly = { ...thin, seniorities: ['SENIOR'] , whyAttend: 'x'.repeat(50) }
    const a = assessConference(nearly, false, 0), b = assessConference(nearly, false, 0, 0, { employers: 5, speakers: 5 })
    expect(b.facts).toBeGreaterThan(a.facts)
  })
})
