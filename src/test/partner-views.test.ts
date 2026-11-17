import { describe, expect, it } from 'vitest'
import { DEFAULT_SCOPES, isPlausibleToken, normalizeScopes, viewStatus, viewUrl } from '@/lib/workforce/partner-views'

describe('partner views', () => {
  it('keeps only known scopes, once each, in a fixed order', () => {
    expect(normalizeScopes(['JOBS', 'SKILLS', 'SKILLS', 'NOPE'])).toEqual(['SKILLS', 'JOBS'])
  })
  it('profiles always bring the talent counts they come from', () => {
    expect(normalizeScopes(['PROFILES'])).toEqual(['TALENT', 'PROFILES'])
  })
  it('defaults differ by partner kind', () => {
    expect(DEFAULT_SCOPES.COLLEGE).toContain('PROGRAMS')
    expect(DEFAULT_SCOPES.EMPLOYER).toContain('TALENT')
    expect(DEFAULT_SCOPES.EMPLOYER).not.toContain('PROFILES')
  })
  it('status: active, expired, revoked', () => {
    const now = new Date('2026-12-01T00:00:00Z')
    expect(viewStatus({ expiresAt: new Date('2026-12-10T00:00:00Z'), revokedAt: null }, now)).toBe('Active')
    expect(viewStatus({ expiresAt: new Date('2026-11-30T00:00:00Z'), revokedAt: null }, now)).toBe('Expired')
    expect(viewStatus({ expiresAt: new Date('2026-12-10T00:00:00Z'), revokedAt: new Date('2026-11-29T00:00:00Z') }, now)).toBe('Revoked')
  })
  it('builds the address and checks tokens', () => {
    expect(viewUrl('https://example.test', 'demo', 'abc')).toBe('https://example.test/i/demo/view/abc')
    expect(isPlausibleToken('x'.repeat(32))).toBe(true)
    expect(isPlausibleToken('short')).toBe(false)
    expect(isPlausibleToken('has spaces and symbols!!!!!!!!!!')).toBe(false)
  })
})
