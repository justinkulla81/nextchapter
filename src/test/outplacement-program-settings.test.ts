import { describe, expect, it } from 'vitest'
import { highestTier, offeredFeatures, readProgramSettings, tierIncludes } from '@/lib/employer/program-settings'

describe('outplacement program settings', () => {
  it('offers what the tier includes, minus what the org switched off', () => {
    const keys = (json: unknown, tier: Parameters<typeof offeredFeatures>[1]) => offeredFeatures(json, tier).map((f) => f.key)
    expect(keys({}, 'CORE')).not.toContain('coaching')
    expect(keys({}, 'PLUS')).toContain('coaching')
    expect(keys({ features: { coaching: false } }, 'PLUS')).not.toContain('coaching')
    expect(keys({ features: { alumniMembership: true } }, 'PLUS')).not.toContain('alumniMembership')
    expect(keys({}, null)).toEqual([])
  })
  it('reads only booleans and trims the welcome', () => {
    expect(readProgramSettings({ features: { coaching: 'no', resume: false }, welcome: '  Hi  ' })).toEqual({ features: { resume: false }, welcome: 'Hi' })
    expect(readProgramSettings(null)).toEqual({ features: {}, welcome: null })
  })
  it('picks the highest active tier', () => {
    expect(highestTier(['CORE', 'PREMIUM', 'PLUS'])).toBe('PREMIUM')
    expect(highestTier([])).toBeNull()
    expect(tierIncludes('PREMIUM', 'alumniMembership')).toBe(true)
  })
})
