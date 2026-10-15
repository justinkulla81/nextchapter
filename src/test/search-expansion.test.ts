import { describe, expect, it } from 'vitest'
import { readSearchExpansion, STATE_NEIGHBORS } from '@/lib/profile/search-expansion'
import { computeFitAssessment } from '@/lib/jobs/job-fit-bucket'

describe('search expansion', () => {
  it('reads only valid values', () => {
    expect(readSearchExpansion({ remote: true, states: ['IN', 'xx', 'IN'], roles: ['data_analyst', 'Bad Role'], industries: ['Healthcare', 3] })).toEqual({ remote: true, states: ['IN'], roles: ['data_analyst'], industries: ['Healthcare'], at: null })
    expect(readSearchExpansion(null).states).toEqual([])
  })
  it('neighbors are symmetric', () => {
    const bad = Object.entries(STATE_NEIGHBORS).flatMap(([s, ns]) => ns.filter((n) => !(STATE_NEIGHBORS[n] ?? []).includes(s)).map((n) => `${s}-${n}`))
    expect(bad).toEqual([])
  })
  it('an opted-in state counts as local for job fit', () => {
    const base = { primaryFunction: 'Operations', secondaryFunction: null, highestLevelReached: 'Manager', levelRankScore: null, remotePreference: 'onsite', currentCity: 'Louisville', currentState: 'KY', openToRelocation: false, targetCompMin: null, compFlexible: false, targetRoleType: null, resumeKeywords: [], yearsExperience: 10, industryContext: null, secondaryIndustryContext: null, targetIndustries: [], hasJD: false, hasMD: false, hasDO: false, targetCompanySize: null, priorityMaxComp: null, priorityWorkLife: null, priorityBrandName: null, priorityMission: null, isPeopleManager: true } as never
    const job = { title: 'Operations Manager', description: 'Lead operations.', location: 'Jeffersonville, IN', salaryMin: null, salaryMax: null } as never
    const without = computeFitAssessment(base, job)
    const withIn = computeFitAssessment({ ...(base as object), searchExpansion: { states: ['IN'] } } as never, job)
    expect(without.place).toBe('no')
    expect(withIn.place).toBe('local')
  })
})
