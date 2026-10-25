import { describe, expect, it } from 'vitest'
import { sectionAppPath, switcherItems } from '@/lib/employer/section-links'
import { employerSectionTrail } from '@/lib/employer/sections'
import { employerUseForPath, portalTypeLabel } from '@/lib/partners/portal-types'
import { readSessionCookie, tokenIsLive } from '@/lib/supabase/peek-session'

describe('section links', () => {
  it('lists only the sections the person holds, in display order', () => {
    const items = switcherItems({ sections: ['outplacement', 'hiring'], grants: [{ section: 'hiring' }, { section: 'outplacement' }] })
    expect(items.map((i) => i.key)).toEqual(['hiring', 'outplacement'])
    expect(items.map((i) => i.appPath)).toEqual(['/talent/dashboard', '/employer'])
  })

  it('never links a section that is not in the list', () => {
    const items = switcherItems({ sections: ['hiring'], grants: [{ section: 'hiring' }, { section: 'employees', services: { learning: true } }] })
    expect(items.map((i) => i.key)).toEqual(['hiring'])
  })

  it('opens Employees on the first service that is on', () => {
    expect(sectionAppPath('employees', { learning: true, retention: true })).toBe('/employer/learning')
    expect(sectionAppPath('employees', { learning: false, retention: true })).toBe('/employer/growth')
    expect(sectionAppPath('employees', {})).toBe('/employer')
  })
})

describe('top bar trail', () => {
  it('the bar label matches the section trail for every employer path', () => {
    for (const path of ['/employer', '/employer/roster', '/employer/growth', '/employer/learning/x', '/talent/dashboard']) {
      const use = path.startsWith('/talent') ? 'Hiring' : employerUseForPath(path)
      expect(portalTypeLabel('employer', use)).toBe(['Employer', ...employerSectionTrail(path)].join(' · '))
    }
  })

  it('uses the Employees wording for all three services', () => {
    expect(portalTypeLabel('employer', 'Retention')).toBe('Employer · Employees · Retention')
    expect(portalTypeLabel('employer', 'Learning and development')).toBe('Employer · Employees · Learning and development')
    expect(portalTypeLabel('employer', 'Job retraining')).toBe('Employer · Employees · Job retraining')
  })
})

describe('reading a session cookie without refreshing it', () => {
  const session = { access_token: 'tok', refresh_token: 'refresh-secret', expires_at: 2_000_000_000 }
  const b64url = (s: string) => Buffer.from(s).toString('base64url')

  it('reads a base64 cookie', () => {
    const r = readSessionCookie([{ name: 'sb-employer-auth-token', value: `base64-${b64url(JSON.stringify(session))}` }], 'sb-employer-auth-token')
    expect(r).toEqual({ accessToken: 'tok', expiresAt: 2_000_000_000 })
  })

  it('joins chunks in numeric order', () => {
    const v = `base64-${b64url(JSON.stringify(session))}`
    const half = Math.floor(v.length / 2)
    const r = readSessionCookie(
      [
        { name: 'sb-talent-auth-token.1', value: v.slice(half) },
        { name: 'sb-talent-auth-token.0', value: v.slice(0, half) },
        { name: 'sb-employer-auth-token', value: 'other' },
      ],
      'sb-talent-auth-token'
    )
    expect(r?.accessToken).toBe('tok')
  })

  it('returns null for a missing, corrupt or look-alike cookie, and never exposes the refresh token', () => {
    expect(readSessionCookie([], 'sb-employer-auth-token')).toBeNull()
    expect(readSessionCookie([{ name: 'sb-employer-auth-token', value: 'base64-@@@' }], 'sb-employer-auth-token')).toBeNull()
    expect(readSessionCookie([{ name: 'sb-employer-auth-tokens', value: 'x' }], 'sb-employer-auth-token')).toBeNull()
    const r = readSessionCookie([{ name: 'sb-employer-auth-token', value: JSON.stringify(session) }], 'sb-employer-auth-token')
    expect(JSON.stringify(r)).not.toContain('refresh-secret')
  })

  it('treats a token near expiry as expired', () => {
    expect(tokenIsLive(1000, 1_000_000 - 60_000)).toBe(true)
    expect(tokenIsLive(1000, 1_000_000 - 5_000)).toBe(false)
    expect(tokenIsLive(1000, 2_000_000)).toBe(false)
  })
})
