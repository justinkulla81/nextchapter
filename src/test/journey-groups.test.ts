import { describe, expect, it } from 'vitest'
import { PERSONAS } from '@/lib/constants/personas'
import { JOURNEY_GROUPS, ONBOARDING_GROUPS, groupForSlug, onboardingGroupOfJourney } from '@/lib/constants/journey-groups'
import { JOURNEYS } from '@/lib/journey/journey'
import { journeyOfSituation } from '@/lib/onboarding/bundles'

describe('journey groups', () => {
  it('puts every situation in exactly one group', () => {
    const all = JOURNEY_GROUPS.flatMap((g) => g.slugs)
    expect(new Set(all).size).toBe(all.length)
    expect([...all].sort()).toEqual(PERSONAS.map((p) => p.slug).sort())
  })

  it('asks at most four things on each screen', () => {
    expect(JOURNEY_GROUPS.length).toBeLessThanOrEqual(4)
    for (const g of JOURNEY_GROUPS) expect(g.slugs.length).toBeLessThanOrEqual(4)
  })

  it('finds a situation’s group', () => {
    expect(groupForSlug('laid-off')?.key).toBe('out')
    expect(groupForSlug('nope')).toBeUndefined()
  })
})

describe('onboarding groups', () => {
  it('puts each of the twelve journeys in exactly one group, at most four to a group', () => {
    const all = ONBOARDING_GROUPS.flatMap((g) => g.journeys)
    expect(new Set(all).size).toBe(all.length)
    expect([...all].sort()).toEqual(JOURNEYS.map((j) => j.key).sort())
    expect(ONBOARDING_GROUPS.length).toBeLessThanOrEqual(4)
    for (const g of ONBOARDING_GROUPS) expect(g.journeys.length).toBeLessThanOrEqual(4)
  })

  it('finds a journey’s group, including the ones a legacy situation key stands for', () => {
    expect(onboardingGroupOfJourney('LAID_OFF')?.key).toBe('out')
    expect(onboardingGroupOfJourney(journeyOfSituation('just_resigned'))?.key).toBe('out')
    expect(onboardingGroupOfJourney(journeyOfSituation('ready_to_move'))?.key).toBe('working')
    expect(onboardingGroupOfJourney(null)).toBeUndefined()
  })

  it('uses the homepage picker’s four questions', () => {
    expect(ONBOARDING_GROUPS.map((g) => g.key)).toEqual(JOURNEY_GROUPS.map((g) => g.key))
  })
})
