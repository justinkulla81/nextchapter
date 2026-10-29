import { describe, expect, it } from 'vitest'
import { CONNECT_PATH, FINISH_PATH, afterAccountPath, nextPreAccountPath, progressPatch } from './progress'

const answered = { desireComplete: true, resumeStepComplete: true, firstName: 'Ana', lastName: 'Lee', email: 'ana@example.com', onboardingResumeConfirmedAt: new Date(), onboardingLocationConfirmedAt: new Date() }
const withCoachDone = progressPatch(null, { completed: 'coach' })

describe('nextPreAccountPath', () => {
  it('walks the five question steps in order', () => {
    expect(nextPreAccountPath({ ...answered, desireComplete: false, journeyDetails: null })).toBe('/onboarding/desire')
    expect(nextPreAccountPath({ ...answered, resumeStepComplete: false, journeyDetails: null })).toBe('/onboarding/resume')
    expect(nextPreAccountPath({ ...answered, onboardingResumeConfirmedAt: null, journeyDetails: null })).toBe('/onboarding/confirm')
    expect(nextPreAccountPath({ ...answered, onboardingLocationConfirmedAt: null, journeyDetails: null })).toBe('/onboarding/location')
    expect(nextPreAccountPath({ ...answered, journeyDetails: null })).toBe('/onboarding/coach')
  })

  it('goes straight from the last question to the required Google step, not to the payoff, while Google connect is on', () => {
    expect(nextPreAccountPath({ ...answered, journeyDetails: withCoachDone }, true)).toBe(CONNECT_PATH)
  })

  it('goes straight from the last question to the email and password step while Google connect is off', () => {
    expect(nextPreAccountPath({ ...answered, journeyDetails: withCoachDone }, false)).toBe('/onboarding/create-account')
    expect(nextPreAccountPath({ ...answered, journeyDetails: withCoachDone })).toBe('/onboarding/create-account')
  })

  it('treats a skipped résumé like an uploaded one: the step is complete', () => {
    // Skipping sets resumeStepComplete, so the next step is the aiming questions.
    expect(nextPreAccountPath({ ...answered, onboardingResumeConfirmedAt: null, journeyDetails: { resumeSkippedAt: 'x' } })).toBe('/onboarding/confirm')
  })

  it('asks for the details first when the résumé step is done but a name or email is missing', () => {
    expect(nextPreAccountPath({ ...answered, firstName: null, journeyDetails: null })).toBe('/onboarding/details')
    expect(nextPreAccountPath({ ...answered, email: null, onboardingResumeConfirmedAt: null, journeyDetails: null })).toBe('/onboarding/details')
    expect(nextPreAccountPath({ ...answered, resumeStepComplete: false, firstName: null, journeyDetails: null })).toBe('/onboarding/resume')
  })
})

describe('afterAccountPath', () => {
  it('shows the payoff first once the account exists', () => {
    expect(afterAccountPath({ finishedAt: null, googleRevealAt: 'x', introCommitted: false })).toBe(FINISH_PATH)
  })

  it('then goes to welcome, and on to the dashboard once they have committed', () => {
    expect(afterAccountPath({ finishedAt: 'x', googleRevealAt: 'x', introCommitted: false })).toBe('/onboarding/welcome')
    expect(afterAccountPath({ finishedAt: 'x', googleRevealAt: 'x', introCommitted: true })).toBe('/dashboard')
  })

  it('still gives members who registered under the earlier order their one optional Google reveal', () => {
    expect(afterAccountPath({ finishedAt: 'x', googleRevealAt: null, introCommitted: false }, true)).toBe('/onboarding/google')
  })

  it('skips that Google reveal while Google connect is off', () => {
    expect(afterAccountPath({ finishedAt: 'x', googleRevealAt: null, introCommitted: false }, false)).toBe('/onboarding/welcome')
    expect(afterAccountPath({ finishedAt: 'x', googleRevealAt: null, introCommitted: false })).toBe('/onboarding/welcome')
    expect(afterAccountPath({ finishedAt: 'x', googleRevealAt: null, introCommitted: true })).toBe('/dashboard')
  })
})
