import { describe, expect, it } from 'vitest'
import { highestTier, offeredFeatures, readProgramSettings, servicesForPackage, tierIncludes } from '@/lib/employer/program-settings'

const keys = (xs: { key: string }[]) => xs.map((x) => x.key)

describe('outplacement services menu', () => {
  it('offers NextChapter services only within the tier', () => {
    expect(keys(offeredFeatures({}, 'CORE'))).not.toContain('coaching')
    expect(keys(offeredFeatures({}, 'PLUS'))).toContain('coaching')
    expect(keys(offeredFeatures({}, 'PLUS'))).not.toContain('alumniMembership')
    expect(offeredFeatures({}, null)).toEqual([])
  })
  it('honors switches, including the old features map', () => {
    expect(keys(offeredFeatures({ services: { coaching: { on: false } } }, 'PLUS'))).not.toContain('coaching')
    expect(keys(offeredFeatures({ features: { resume: false } }, 'PLUS'))).not.toContain('resume')
  })
  it('the company’s own version works on any tier, once it says how to reach it', () => {
    const own = { services: { coaching: { on: true, provider: 'own', note: 'Call the EAP' } } }
    const c = offeredFeatures(own, 'CORE').find((f) => f.key === 'coaching')
    expect(c?.provider).toBe('own')
    expect(c?.note).toBe('Call the EAP')
    expect(keys(offeredFeatures({ services: { eap: { on: true, provider: 'own' } } }, 'CORE'))).not.toContain('eap')
    expect(keys(offeredFeatures({ services: { eap: { on: true, provider: 'own', url: 'https://eap.example.com' } } }, 'CORE'))).toContain('eap')
  })
  it('refuses a provider that can’t deliver it', () => {
    expect(readProgramSettings({ services: { dossier: { provider: 'own' } } }).services.dossier.provider).toBe('nextchapter')
    expect(readProgramSettings({ services: { eap: { provider: 'nextchapter' } } }).services.eap.provider).toBe('own')
  })
  it('packages narrow what one person gets; unknown or none = everything offered', () => {
    const json = { packages: [{ key: 'exec', name: 'Executives', services: ['coaching', 'resume'] }] }
    expect(keys(servicesForPackage(json, 'PLUS', 'exec'))).toEqual(['coaching', 'resume'])
    expect(servicesForPackage(json, 'PLUS', null).length).toBe(offeredFeatures(json, 'PLUS').length)
    expect(servicesForPackage(json, 'PLUS', 'gone').length).toBe(offeredFeatures(json, 'PLUS').length)
  })
  it('picks the highest active tier', () => {
    expect(highestTier(['CORE', 'PREMIUM', 'PLUS'])).toBe('PREMIUM')
    expect(highestTier([])).toBeNull()
    expect(tierIncludes('PREMIUM', 'alumniMembership')).toBe(true)
    expect(tierIncludes('PREMIUM', 'eap')).toBe(false)
  })
})
