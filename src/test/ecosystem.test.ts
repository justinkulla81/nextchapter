import { describe, expect, it } from 'vitest'
import { canClaim, canDecide, canInvite, domainMatches, inviteMessage, inviteUrl, isPlausibleInviteToken, normalizeCommitments } from '@/lib/workforce/ecosystem'

describe('ecosystem', () => {
  it('only the steward decides, and only on a claim', () => {
    expect(canDecide('CLAIMED')).toBe(true)
    expect(canDecide('INVITED')).toBe(false)
    expect(canDecide('CONFIRMED')).toBe(false)
  })
  it('an invitation can be made or remade until the partner is confirmed', () => {
    expect(canInvite('UNINVITED')).toBe(true)
    expect(canInvite('DECLINED')).toBe(true)
    expect(canInvite('CONFIRMED')).toBe(false)
    expect(canClaim('INVITED')).toBe(true)
    expect(canClaim('UNINVITED')).toBe(false)
    expect(canClaim('CONFIRMED')).toBe(false)
  })
  it('checks the email domain against the website, as a hint', () => {
    expect(domainMatches('dana@bellarmine.edu', 'https://www.bellarmine.edu')).toBe(true)
    expect(domainMatches('dana@careers.bellarmine.edu', 'bellarmine.edu')).toBe(true)
    expect(domainMatches('dana@kctcs.edu', 'https://jefferson.kctcs.edu')).toBe(true)
    expect(domainMatches('dana@gmail.com', 'https://www.bellarmine.edu')).toBe(false)
    expect(domainMatches('dana@gmail.com', null)).toBeNull()
  })
  it('keeps known commitments in a fixed order', () => {
    expect(normalizeCommitments(['HIRING', 'NOPE', 'SEATS'])).toEqual(['SEATS', 'HIRING'])
  })
  it('the invitation names the partner and the link, and promises nothing public', () => {
    const m = inviteMessage({ partner: 'Acme College', org: 'One Louisville', region: 'Louisville region', link: inviteUrl('https://x.test', 'demo', 'tok') })
    expect(m).toContain('Acme College')
    expect(m).toContain('https://x.test/i/demo/partner/tok')
    expect(m).toMatch(/does not publish anything/)
  })
  it('checks the token shape', () => {
    expect(isPlausibleInviteToken('a'.repeat(32))).toBe(true)
    expect(isPlausibleInviteToken('nope')).toBe(false)
  })
})
