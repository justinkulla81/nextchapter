import { describe, expect, it } from 'vitest'
import { isOnboardingBundlesOn, resolveOnboardingFlow } from './flag'
import { nextPreAccountPath, progressOf, progressPatch } from './progress'

describe('onboarding flag', () => {
  it('is off by default, for everyone', () => {
    expect(isOnboardingBundlesOn(null, {})).toBe(false)
    expect(isOnboardingBundlesOn('someone@example.com', {})).toBe(false)
  })

  it('turns on for everyone with ONBOARDING_BUNDLES=on, even before there is an email', () => {
    expect(isOnboardingBundlesOn(null, { ONBOARDING_BUNDLES: 'on' })).toBe(true)
    expect(isOnboardingBundlesOn(undefined, { ONBOARDING_BUNDLES: ' ON ' })).toBe(true)
    expect(isOnboardingBundlesOn(null, { ONBOARDING_BUNDLES: 'off' })).toBe(false)
  })

  it('turns on for the redesign allow-list where the email is known', () => {
    expect(isOnboardingBundlesOn('a@b.co', { CANDIDATE_REDESIGN_EMAILS: 'a@b.co' })).toBe(true)
    expect(isOnboardingBundlesOn(null, { CANDIDATE_REDESIGN_EMAILS: 'a@b.co' })).toBe(false)
  })

  it('keeps a member in the flow they started, whatever the switch says now', () => {
    const on = { ONBOARDING_BUNDLES: 'on' }
    expect(resolveOnboardingFlow({ env: on })).toBe('bundles')
    expect(resolveOnboardingFlow({ env: {} })).toBe('classic')
    // Half way through the classic flow when the switch flips on: stays classic.
    expect(resolveOnboardingFlow({ desireComplete: true, journeyDetails: {}, env: on })).toBe('classic')
    // Started on bundles, switch flips off: stays on bundles.
    expect(resolveOnboardingFlow({ desireComplete: true, journeyDetails: { onboardingFlow: 'bundles' }, env: {} })).toBe('bundles')
  })
})

describe('bundle progress', () => {
  it('records each bundle once and leaves the marker', () => {
    const a = progressPatch({}, { completed: 'where_you_are' })
    const b = progressPatch(a, { completed: 'where_you_are' })
    const c = progressPatch(b, { completed: 'aiming' })
    expect(progressOf(c).completed).toEqual(['where_you_are', 'aiming'])
    expect(c.onboardingFlow).toBe('bundles')
  })

  it('keeps earlier times when a later step is recorded', () => {
    const at = new Date('2026-10-19T12:00:00Z')
    const a = progressPatch({}, { finishedAt: at })
    const b = progressPatch(a, { googleRevealAt: at })
    expect(progressOf(b).finishedAt).toBe(at.toISOString())
    expect(progressOf(b).googleRevealAt).toBe(at.toISOString())
  })

  it('ignores junk in the stored value', () => {
    expect(progressOf({ onboardingBundles: { completed: ['nope', 'aiming'], finishedAt: 5 } })).toEqual({ completed: ['aiming'], finishedAt: null, googleRevealAt: null })
    expect(progressOf(null).completed).toEqual([])
  })

  it('sends the hub to the first bundle that is not done', () => {
    const base = { desireComplete: true, resumeStepComplete: true, onboardingResumeConfirmedAt: new Date(), onboardingLocationConfirmedAt: new Date(), journeyDetails: {} }
    expect(nextPreAccountPath({ ...base, desireComplete: false })).toBe('/onboarding/desire')
    expect(nextPreAccountPath({ ...base, resumeStepComplete: false })).toBe('/onboarding/resume')
    expect(nextPreAccountPath({ ...base, onboardingResumeConfirmedAt: null })).toBe('/onboarding/confirm')
    expect(nextPreAccountPath({ ...base, onboardingLocationConfirmedAt: null })).toBe('/onboarding/location')
    expect(nextPreAccountPath(base)).toBe('/onboarding/coach')
    const coached = progressPatch({}, { completed: 'coach' })
    // After the five questions comes the required Google step (it creates the account); the payoff comes after it.
    expect(nextPreAccountPath({ ...base, journeyDetails: coached })).toBe('/onboarding/connect')
    expect(nextPreAccountPath({ ...base, journeyDetails: progressPatch(coached, { finishedAt: new Date() }) })).toBe('/onboarding/connect')
  })
})
