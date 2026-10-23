import { describe, expect, it } from 'vitest'
import { eligibleTriggers, offerAllowed, offerCopy, pickTrigger, type OfferSignals } from '@/lib/upgrade-offer/triggers'

const now = new Date('2026-10-23T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)
const base: OfferSignals = { openRoles: 120, roleLabel: 'Product Manager', placeLabel: 'Ohio', outreachLast14: 5, contacts: 20, tenureDays: 30, activeRecently: true }

describe('offerAllowed', () => {
  it('waits out the first two weeks', () => expect(offerAllowed({ sentAt: [] }, 13, now)).toBe(false))
  it('allows a first offer after that', () => expect(offerAllowed({ sentAt: [] }, 14, now)).toBe(true))
  it('keeps three weeks between offers', () => {
    expect(offerAllowed({ sentAt: [daysAgo(20)] }, 90, now)).toBe(false)
    expect(offerAllowed({ sentAt: [daysAgo(21)] }, 90, now)).toBe(true)
  })
  it('stops at four in 120 days', () => {
    expect(offerAllowed({ sentAt: [daysAgo(25), daysAgo(50), daysAgo(75), daysAgo(100)] }, 200, now)).toBe(false)
    expect(offerAllowed({ sentAt: [daysAgo(25), daysAgo(50), daysAgo(75), daysAgo(130)] }, 200, now)).toBe(true)
  })
})

describe('eligibleTriggers', () => {
  it('sends nothing to someone who has gone quiet', () => expect(eligibleTriggers({ ...base, activeRecently: false, openRoles: 3 })).toEqual([]))
  it('flags a narrow market', () => expect(eligibleTriggers({ ...base, openRoles: 12 })).toEqual(['narrow_market']))
  it('flags a quiet network', () => expect(eligibleTriggers({ ...base, outreachLast14: 1 })).toEqual(['quiet_network']))
  it('flags a long search', () => expect(eligibleTriggers({ ...base, tenureDays: 60 })).toEqual(['long_search']))
  it('sends nothing when the numbers look healthy', () => expect(eligibleTriggers(base)).toEqual([]))
  it('ignores a narrow market it cannot name', () => expect(eligibleTriggers({ ...base, openRoles: 3, roleLabel: null })).toEqual([]))
})

describe('pickTrigger', () => {
  it('rotates through what applies', () => {
    const t = ['narrow_market', 'quiet_network'] as const
    expect(pickTrigger([...t], 0)).toBe('narrow_market')
    expect(pickTrigger([...t], 1)).toBe('quiet_network')
    expect(pickTrigger([...t], 2)).toBe('narrow_market')
  })
  it('returns null when nothing applies', () => expect(pickTrigger([], 0)).toBeNull())
})

describe('offerCopy', () => {
  it('puts the member’s own number in the subject and hero', () => {
    const c = offerCopy('narrow_market', { ...base, openRoles: 12 }, 'Sam')
    expect(c.subject).toContain('12')
    expect(c.hero.value).toBe('12')
    expect(c.features).toHaveLength(3)
  })
})
