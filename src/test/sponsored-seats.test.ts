import { describe, expect, it } from 'vitest'
import { isSponsoredJourney, shouldApplySponsoredStart, sponsoredStart } from '@/lib/journey/sponsored'

describe('sponsored seats start a journey', () => {
  it('outplacement (no journey, or Laid off) starts Laid off, applying, over anything', () => {
    for (const j of [null, undefined, 'LAID_OFF'] as const) {
      const s = sponsoredStart(j)
      expect(s).toEqual({ journey: 'LAID_OFF', stage: 'APPLYING', onlyIfNotSearching: false })
      expect(shouldApplySponsoredStart(s, 'GROWING', 'STAYING')).toBe(true)
    }
  })
  it('career growth seats start the journey at its own default stage', () => {
    expect(sponsoredStart('GROWING')).toMatchObject({ journey: 'GROWING', stage: 'STAYING' })
    expect(sponsoredStart('PROMOTION')).toMatchObject({ journey: 'PROMOTION', stage: 'PREPARING' })
    expect(sponsoredStart('CAREER_CHANGE')).toMatchObject({ journey: 'CAREER_CHANGE', stage: 'EXPLORING' })
  })
  it('a career growth seat never overrides a member who is in a search', () => {
    const s = sponsoredStart('GROWING')
    expect(shouldApplySponsoredStart(s, null, null)).toBe(true)
    expect(shouldApplySponsoredStart(s, 'FRACTIONAL', 'STAYING')).toBe(true)
    expect(shouldApplySponsoredStart(s, 'LAID_OFF', 'APPLYING')).toBe(false)
    expect(shouldApplySponsoredStart(s, 'EXPLORING_MOVE', 'EXPLORING')).toBe(false)
    expect(shouldApplySponsoredStart(s, 'GROWING', 'STAYING')).toBe(false)
  })
  it('only the sponsored journeys can be chosen on a contract', () => {
    expect(isSponsoredJourney('GROWING')).toBe(true)
    expect(isSponsoredJourney('TIME_OFF')).toBe(false)
    expect(isSponsoredJourney('nonsense')).toBe(false)
  })
})
