import { describe, expect, it } from 'vitest'
import { registrationStop, type StopInput } from '@/lib/admin/registration-stop'

const base: StopInput = {
  journeyDetails: null,
  desireComplete: false,
  resumeStepComplete: false,
  firstName: null,
  lastName: null,
  email: null,
  onboardingResumeConfirmedAt: null,
  onboardingLocationConfirmedAt: null,
  onboardingComfortConfirmedAt: null,
  contractAcceptedAt: null,
  registrationCompletedAt: null,
  introCommittedAt: null,
  duplicateEmailBlockedAt: null,
}
const now = new Date()
const classic = (over: Partial<StopInput>): StopInput => ({ ...base, desireComplete: true, ...over })

describe('registrationStop (classic flow)', () => {
  it('a fresh profile has not finished the first question', () => {
    expect(registrationStop(base).path).toBe('/onboarding/desire')
  })
  it('follows the hub order', () => {
    expect(registrationStop(classic({})).path).toBe('/onboarding/resume')
    expect(registrationStop(classic({ resumeStepComplete: true })).path).toBe('/onboarding/confirm')
    expect(registrationStop(classic({ resumeStepComplete: true, onboardingResumeConfirmedAt: now })).path).toBe('/onboarding/location')
  })
  it('unregistered after every question stops at the account step', () => {
    const done = classic({ resumeStepComplete: true, onboardingResumeConfirmedAt: now, onboardingLocationConfirmedAt: now, onboardingComfortConfirmedAt: now, contractAcceptedAt: now })
    expect(registrationStop(done).rank).toBe(6)
  })
  it('registered without the welcome stops at welcome, with it is finished', () => {
    const done = classic({ resumeStepComplete: true, onboardingResumeConfirmedAt: now, onboardingLocationConfirmedAt: now, onboardingComfortConfirmedAt: now, contractAcceptedAt: now, registrationCompletedAt: now })
    expect(registrationStop(done).path).toBe('/onboarding/welcome')
    expect(registrationStop({ ...done, introCommittedAt: now }).path).toBeNull()
  })
  it('a blocked duplicate email stays on the account step', () => {
    expect(registrationStop(classic({ duplicateEmailBlockedAt: now })).rank).toBe(6)
  })
})

describe('registrationStop (bundles flow)', () => {
  const bundles = (over: Partial<StopInput>): StopInput => ({ ...base, journeyDetails: { onboardingFlow: 'bundles' }, ...over })
  it('starts at the first question', () => {
    expect(registrationStop(bundles({})).path).toBe('/onboarding/desire')
  })
  it('asks for name and email when the résumé gave none', () => {
    expect(registrationStop(bundles({ desireComplete: true, resumeStepComplete: true })).path).toBe('/onboarding/details')
  })
  it('a registered member without the payoff stops at the payoff', () => {
    const p = bundles({ desireComplete: true, resumeStepComplete: true, firstName: 'A', lastName: 'B', email: 'a@example.com', registrationCompletedAt: now })
    expect(registrationStop(p).path).toBe('/onboarding/finish')
  })
})
