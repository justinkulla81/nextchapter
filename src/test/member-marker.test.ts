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

describe('member name cookie', () => {
  it('round-trips a first name, including accents and spaces', async () => {
    const { encodeMemberName, decodeMemberName } = await import('@/lib/auth/member-marker')
    for (const n of ['Justin', 'José', 'Mary Ann']) expect(decodeMemberName(encodeMemberName(n))).toBe(n)
  })
  it('caps the length and treats junk as no name', async () => {
    const { encodeMemberName, decodeMemberName } = await import('@/lib/auth/member-marker')
    expect(decodeMemberName(encodeMemberName('x'.repeat(100)))?.length).toBe(40)
    expect(decodeMemberName(undefined)).toBeNull()
    expect(decodeMemberName('%E0%A4%A')).toBeNull()
    expect(decodeMemberName('%20')).toBeNull()
  })
})
