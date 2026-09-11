import { describe, it, expect } from 'vitest'
import { goalsForRoles, goalsForOrgTypes, rolesForGoal, GOALS, PIPELINE_GOAL } from '@/lib/crm/goals'

describe('goalsForRoles', () => {
  it('maps an investor to fundraising', () => {
    expect(goalsForRoles(['INVESTOR_VC'])).toEqual(['FUNDRAISING'])
  })
  it('gives one person several goals when they are several things', () => {
    // Aneesh Raman is a policy adviser AND a BD partner AND an investor
    // contact — which is the whole reason goals are an array.
    const g = goalsForRoles(['POLICY_ANALYST', 'BD_PARTNER', 'INVESTOR_VC'])
    expect(g).toHaveLength(3)
    expect(g).toContain('ADVISORY_RECRUITING')
    expect(g).toContain('BD')
    expect(g).toContain('FUNDRAISING')
  })
  it('deduplicates when two roles share a goal', () => {
    expect(goalsForRoles(['COACH_PROSPECT', 'RECRUITER_PROSPECT'])).toEqual(['ECOSYSTEM_RECRUITING'])
  })
  it('gives connectors and press no goal, rather than inventing one', () => {
    expect(goalsForRoles(['CONNECTOR', 'PRESS', 'OTHER'])).toEqual([])
  })
})

describe('goalsForOrgTypes', () => {
  it('handles an organisation that is several things at once', () => {
    // Microsoft: cloud credits, a partner, and a layoff lead.
    const g = goalsForOrgTypes(['FUNDER_GRANT', 'VENDOR', 'OUTPLACEMENT_LEAD', 'EMPLOYER'])
    expect(g).toContain('FUNDRAISING')
    expect(g).toContain('BD')
    expect(g).toContain('SALES')
  })
})

describe('rolesForGoal', () => {
  it('reports which types feed a goal, so the mapping is inspectable', () => {
    expect(rolesForGoal('FUNDRAISING').sort()).toEqual(['INVESTOR_ANGEL', 'INVESTOR_VC'])
  })
})

describe('PIPELINE_GOAL', () => {
  it('covers every pipeline that exists', () => {
    const keys = ['fundraising', 'bd_partnerships', 'outplacement', 'coach_recruiting',
      'recruiter_recruiting', 'hiring_managers', 'employee_recruiting', 'policy_advisers', 'job_seekers']
    for (const k of keys) expect(GOALS).toContain(PIPELINE_GOAL[k])
  })
})
