import { describe, it, expect } from 'vitest'
import { isWarmPerson, isHunterSourced, type WarmFacts } from '@/lib/mailing/warm-rules'

const base: WarmFacts = { warmth: 'UNKNOWN', emailSource: null, linkedinDegree: null, connected: false, engagedBefore: false }

describe('isWarmPerson', () => {
  it('treats someone who engaged with earlier list mail as warm, even from Hunter', () => {
    expect(isWarmPerson({ ...base, emailSource: 'hunter-finder', engagedBefore: true })).toBe(true)
  })
  it('treats a Hunter-sourced address as cold even if the CRM says WARM', () => {
    expect(isWarmPerson({ ...base, warmth: 'WARM', emailSource: 'hunter-domain-search' })).toBe(false)
  })
  it('treats HOT and WARM contacts, LinkedIn connections and 1st-degree people as warm', () => {
    expect(isWarmPerson({ ...base, warmth: 'HOT' })).toBe(true)
    expect(isWarmPerson({ ...base, warmth: 'WARM' })).toBe(true)
    expect(isWarmPerson({ ...base, connected: true })).toBe(true)
    expect(isWarmPerson({ ...base, linkedinDegree: '1st' })).toBe(true)
  })
  it('treats unknown, cold and 2nd-degree contacts as cold', () => {
    expect(isWarmPerson(base)).toBe(false)
    expect(isWarmPerson({ ...base, warmth: 'COLD' })).toBe(false)
    expect(isWarmPerson({ ...base, linkedinDegree: '2nd' })).toBe(false)
  })
  it('spots Hunter sources', () => {
    expect(isHunterSourced('hunter-guess-verified')).toBe(true)
    expect(isHunterSourced(null)).toBe(false)
  })
})
