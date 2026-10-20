import { describe, expect, it } from 'vitest'
import { hrBlurb, kitLabel, kitUrl, parseKitLabel } from '@/lib/cohorts/launch-kit'

describe('launch kit', () => {
  it('round-trips a kit label', () => {
    expect(parseKitLabel(kitLabel('abc123', 'hr'))).toEqual({ cohortId: 'abc123', source: 'hr' })
  })
  it('ignores ordinary referral labels', () => {
    expect(parseKitLabel('Justin LinkedIn')).toBeNull()
    expect(parseKitLabel('lc:abc')).toBeNull()
  })
  it('builds a tagged tracked link', () => {
    expect(kitUrl('https://x.com/', 'k2m4', 'partner')).toBe('https://x.com/api/r/k2m4?to=%2F%3Futm_source%3Dpartner%26utm_medium%3Dcohort_kit')
  })
  it('keeps the blurb free of pricing and names the company', () => {
    const b = hrBlurb('Acme', 'https://x.com/a')
    expect(b).toContain('Acme')
    expect(b).not.toMatch(/\$/)
  })
})
