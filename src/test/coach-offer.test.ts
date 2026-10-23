import { describe, expect, it } from 'vitest'
import { COACH_OFFER_COPY, COACH_OFFER_ORDER, coachOfferQuiet, coachOfferReasons, pickCoachOffer, type CoachOfferFacts } from '@/lib/coach/offer'
import { seniorMember } from '@/lib/coach/seniority'

const none: CoachOfferFacts = {
  hasCoach: false, stage: 'APPLYING', senior: false, pivoting: false, smallPool: false, networkingBlocker: false,
  daysSearching: 10, applicationsLast14: 5, outreachLast14: 3, outreachLast30: 6,
}
const NOW = new Date('2026-10-23T12:00:00Z')

describe('coachOfferReasons', () => {
  it('has no reason for someone searching normally', () => {
    expect(coachOfferReasons(none)).toEqual([])
  })
  it('offers a coach at once to a senior member, even before any search', () => {
    expect(coachOfferReasons({ ...none, senior: true, stage: 'EXPLORING', daysSearching: null })).toEqual(['senior'])
  })
  it('flags a pivot and a small pool', () => {
    expect(coachOfferReasons({ ...none, pivoting: true })).toEqual(['pivot'])
    expect(coachOfferReasons({ ...none, smallPool: true })).toEqual(['small_pool'])
  })
  it('flags trouble networking when they say so, or a month of searching with no outreach', () => {
    expect(coachOfferReasons({ ...none, networkingBlocker: true })).toEqual(['networking'])
    expect(coachOfferReasons({ ...none, daysSearching: 31, outreachLast30: 0, outreachLast14: 0 })).toContain('networking')
    expect(coachOfferReasons({ ...none, daysSearching: 20, outreachLast30: 0, outreachLast14: 0 })).not.toContain('networking')
  })
  it('flags a search over 60 days, but only while searching', () => {
    expect(coachOfferReasons({ ...none, daysSearching: 61 })).toEqual(['long_search'])
    expect(coachOfferReasons({ ...none, daysSearching: 61, stage: 'STAYING' })).toEqual([])
    expect(coachOfferReasons({ ...none, daysSearching: 60 })).toEqual(['long_search'])
    expect(coachOfferReasons({ ...none, daysSearching: 59 })).toEqual([])
  })
  it('flags no work in two weeks of an active search', () => {
    expect(coachOfferReasons({ ...none, daysSearching: 15, applicationsLast14: 0, outreachLast14: 0, outreachLast30: 2 })).toEqual(['not_doing_the_work'])
    expect(coachOfferReasons({ ...none, daysSearching: 15, applicationsLast14: 1, outreachLast14: 0 })).toEqual([])
    expect(coachOfferReasons({ ...none, daysSearching: 10, applicationsLast14: 0, outreachLast14: 0 })).toEqual([])
  })
  it('orders the strongest first and offers nothing to a member who has a coach', () => {
    const all = { ...none, senior: true, pivoting: true, smallPool: true, networkingBlocker: true, daysSearching: 90, applicationsLast14: 0, outreachLast14: 0, outreachLast30: 0 }
    expect(coachOfferReasons(all)).toEqual([...COACH_OFFER_ORDER])
    expect(coachOfferReasons({ ...all, hasCoach: true })).toEqual([])
  })
})

describe('pickCoachOffer and the 30-day quiet', () => {
  const facts = { ...none, senior: true }
  it('shows the strongest reason', () => {
    expect(pickCoachOffer({ ...facts, pivoting: true }, {}, NOW)).toBe('senior')
  })
  it('is quiet for 30 days after an answer, then comes back', () => {
    const until = new Date(NOW.getTime() + 29 * 86_400_000).toISOString()
    expect(coachOfferQuiet({ snoozedUntil: until }, NOW)).toBe(true)
    expect(pickCoachOffer(facts, { snoozedUntil: until }, NOW)).toBeNull()
    expect(pickCoachOffer(facts, { snoozedUntil: until }, new Date(NOW.getTime() + 30 * 86_400_000))).toBe('senior')
  })
  it('ignores a missing or broken snooze', () => {
    expect(coachOfferQuiet({}, NOW)).toBe(false)
    expect(coachOfferQuiet({ snoozedUntil: 'not a date' }, NOW)).toBe(false)
  })
})

describe('the words', () => {
  it('give every reason a title, a why and a plain explanation, with no hedging', () => {
    for (const r of COACH_OFFER_ORDER) {
      const c = COACH_OFFER_COPY[r]
      expect(c.title.length, r).toBeGreaterThan(10)
      expect(c.why.length, r).toBeGreaterThan(40)
      expect(c.whyDetail.startsWith('You see this because'), r).toBe(true)
      expect(`${c.title} ${c.why}`).not.toMatch(/\b(might|maybe|perhaps)\b/i)
    }
  })
})

describe('seniorMember', () => {
  it('reads level and title, not age', () => {
    expect(seniorMember({ highestLevelReached: 'VP' })).toBe(true)
    expect(seniorMember({ highestLevelReached: 'C-Suite' })).toBe(true)
    expect(seniorMember({ highestLevelReached: 'Manager', resumeLatestJobTitle: 'Chief Financial Officer' })).toBe(true)
    expect(seniorMember({ highestLevelReached: 'Director', resumeLatestJobTitle: 'Director of Operations' })).toBe(false)
    expect(seniorMember({ highestLevelReached: null, resumeLatestJobTitle: null })).toBe(false)
  })
})
