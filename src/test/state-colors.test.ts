import { describe, expect, it } from 'vitest'
import { contrast } from '@/lib/branding/colors'
import { ctaColors } from '@/lib/branding/theme'
import { stateBrand, stateBrandFromSlug, statePhrase } from '@/lib/branding/state-colors'
import { STATE_NAMES } from '@/lib/workforce/places'

describe('state colors', () => {
  const codes = Object.keys(STATE_NAMES)
  it('has colors for every state and DC', () => {
    const fiftyOne = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ')
    expect(fiftyOne).toHaveLength(51)
    for (const c of fiftyOne) expect(stateBrand(c), c).not.toBeNull()
    // A territory with no flag colors here keeps NextChapter's own look.
    expect(stateBrand('GU')).toBeNull()
  })
  it('keeps text readable on the band and the button visible against it, for every state', () => {
    for (const c of codes) {
      const b = stateBrand(c)
      if (!b) continue
      expect(contrast(b.primary, b.primaryInk)).toBeGreaterThanOrEqual(4.5)
      const cta = ctaColors(b)
      expect(contrast(cta.bg, b.primary)).toBeGreaterThanOrEqual(3)
      expect(contrast(cta.bg, cta.ink)).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('finds a state from its page slug and names it for the independence line', () => {
    expect(stateBrandFromSlug('new-york')?.code).toBe('NY')
    expect(stateBrandFromSlug('nowhere')).toBeNull()
    expect(statePhrase('OH')).toBe('the State of Ohio')
    expect(statePhrase('DC')).toBe('the District of Columbia')
  })
})
