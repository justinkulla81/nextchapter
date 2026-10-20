import { describe, it, expect } from 'vitest'
import { blockerStep, withBlockerStep, motivationLine, noteWhyWithMotivation } from '@/lib/personalization/blocker-step'
import { BLOCKER_OPTIONS, MOTIVATIONS_OPTIONS } from '@/lib/constants/onboarding'

const plan = [{ text: 'Tell 5 more people what you’re looking for', actionType: 'OUTREACH_MESSAGE' }, { text: 'Send 5 applications' }]

describe('blockerStep', () => {
  it('has a step for every blocker the form offers', () => {
    for (const o of BLOCKER_OPTIONS) expect(blockerStep([o.value])).not.toBeNull()
  })

  it('leads with the blocker whose step helps soonest when several are chosen', () => {
    const pick = blockerStep(['family_caregiving', 'networking_discomfort', 'financial_pressure'])
    expect(pick?.item.text).toMatch(/benefits/)
  })

  it('returns nothing without a blocker, with an unknown one, or on a gentle journey', () => {
    expect(blockerStep([])).toBeNull()
    expect(blockerStep(['not_a_blocker'])).toBeNull()
    expect(blockerStep(['procrastination_tendency'], 'TIME_OFF')).toBeNull()
    expect(blockerStep(['procrastination_tendency'], 'LAID_OFF')).not.toBeNull()
  })

  it('says why the step is first, in the member’s terms', () => {
    expect(blockerStep(['discouragement_tendency'])?.because).toMatch(/^You said/)
  })
})

describe('withBlockerStep', () => {
  it('puts the step first and keeps the rest in order', () => {
    const out = withBlockerStep(plan, ['procrastination_tendency'])
    expect(out.plan[0].text).toMatch(/20-minute timer/)
    expect(out.plan.slice(1)).toEqual(plan)
    expect(out.because).toMatch(/^You said/)
  })

  it('does not duplicate a step the plan already has', () => {
    const first = withBlockerStep(plan, ['networking_discomfort']).plan
    const again = withBlockerStep(first, ['networking_discomfort']).plan
    expect(again.filter((p) => p.text === first[0].text)).toHaveLength(1)
  })

  it('leaves the plan alone when there is nothing to answer', () => {
    expect(withBlockerStep(plan, [])).toEqual({ plan, because: null })
  })
})

describe('motivation line', () => {
  it('has a line for every motivation the form offers', () => {
    for (const o of MOTIVATIONS_OPTIONS) expect(motivationLine([o.value])).not.toBeNull()
  })

  it('adds what drives them to the reason and keeps the original wording first', () => {
    const out = noteWhyWithMotivation('Most roles are filled through a person, not a posting.', ['provide_for_family'])
    expect(out).toBe('Most roles are filled through a person, not a posting, and it brings you closer to providing for your family.')
  })

  it('leaves the reason as it was when they have not said', () => {
    expect(noteWhyWithMotivation('Most roles are filled through a person.', [])).toBe('Most roles are filled through a person.')
  })
})
