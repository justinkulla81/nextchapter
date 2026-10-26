import { describe, expect, it } from 'vitest'
import { isHigherEd, placeLinkCount } from '@/lib/events/conference-place-map'
import { assessConference, type ConferenceFactInput } from '@/lib/seo/topic-quality'
import { inferFunctions } from '@/lib/seo/function-inference'

const base: ConferenceFactInput = {
  datesConfirmed: true, startDate: '2027-03-01', typicalMonth: null, format: 'IN_PERSON', city: 'Indianapolis', state: 'IN', access: 'PAID', costLow: 500, costHigh: 900,
  speaking: 'OPEN_CFP', speakingDeadline: null, organizer: 'Acme Association', seniorities: ['MID'], roles: ['dean'], programFormats: [], whyAttend: null, cheaperWays: null,
  verified: false, checkedAt: null, industries: ['Education & EdTech'], functions: [],
}

describe('conference place links', () => {
  it('counts the state page for a US state and none for a province or no state', () => {
    expect(placeLinkCount('no-such-conference', 'IN')).toBe(1)
    expect(placeLinkCount('no-such-conference', 'ON')).toBe(0)
    expect(placeLinkCount('no-such-conference', null)).toBe(0)
  })
  it('lets place links lift a page that was one or two links short, but not one short of facts', () => {
    expect(assessConference(base, false, 0).indexable).toBe(false)
    expect(assessConference(base, false, 0, 3).links).toBe(4)
    const thin = { ...base, costLow: null, costHigh: null, access: 'PAID', speaking: 'UNKNOWN', roles: [], seniorities: [], organizer: null }
    expect(assessConference(thin, true, 3, 3).indexable).toBe(false)
  })
})

describe('higher-ed conferences', () => {
  it('includes education conferences and excludes K-12-only ones', () => {
    expect(isHigherEd({ industries: ['Education & EdTech'], segments: [] })).toBe(true)
    expect(isHigherEd({ industries: ['Education & EdTech'], segments: ['Student affairs and advising'] })).toBe(true)
    expect(isHigherEd({ industries: ['Education & EdTech'], segments: ['K-12 teachers', 'Early childhood education'] })).toBe(false)
    expect(isHigherEd({ industries: ['Insurance'], segments: [] })).toBe(false)
  })
})

describe('function inference', () => {
  it('places roles the catalog uses that earlier matched nothing', () => {
    expect(inferFunctions(['development officer'])).toContain('Fundraising & development')
    expect(inferFunctions(['medical science liaison'])).toContain('Clinical')
    expect(inferFunctions(['farm manager'])).toContain('Operations')
    expect(inferFunctions(['zookeeper'])).toEqual([])
  })
})
