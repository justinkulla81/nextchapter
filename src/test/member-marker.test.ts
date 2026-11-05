import { describe, expect, it } from 'vitest'
import { isMemberSessionCookie, markerDomain, memberStatus } from '@/lib/auth/member-marker'

describe('member marker', () => {
  it('counts a member session cookie, chunked or not', () => {
    expect(isMemberSessionCookie('sb-abcdefgh-auth-token')).toBe(true)
    expect(isMemberSessionCookie('sb-abcdefgh-auth-token.0')).toBe(true)
  })
  it('does not count a partner portal session or other cookies', () => {
    for (const n of ['sb-recruiter-auth-token', 'sb-coach-auth-token', 'sb-admin-auth-token', 'sb-org-auth-token', 'sb-talent-auth-token.1', 'nc_member', 'sb-abcdefgh-code-verifier']) {
      expect(isMemberSessionCookie(n)).toBe(false)
    }
  })
  it('reads the session and the marker', () => {
    expect(memberStatus([{ name: 'a' }])).toEqual({ session: false, marker: false })
    expect(memberStatus([{ name: 'sb-x-auth-token' }, { name: 'nc_member' }])).toEqual({ session: true, marker: true })
    expect(memberStatus([{ name: 'sb-recruiter-auth-token' }])).toEqual({ session: false, marker: false })
  })
  it('puts the marker on the whole site, not on one host', () => {
    expect(markerDomain('https://launchyournextchapter.com')).toBe('launchyournextchapter.com')
    expect(markerDomain('https://www.launchyournextchapter.com')).toBe('launchyournextchapter.com')
    expect(markerDomain('http://localhost:3000')).toBeUndefined()
    expect(markerDomain(undefined)).toBeUndefined()
  })
})
