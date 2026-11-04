import { describe, expect, it } from 'vitest'
import { isVerifierMissing, signedInJustNow } from '@/lib/auth/callback-session'

const NOW = Date.parse('2026-11-04T05:20:00Z')
const session = (over: { is_anonymous?: boolean; last_sign_in_at?: string | null }) => ({ user: { is_anonymous: false, last_sign_in_at: '2026-11-04T05:19:40Z', ...over } })

describe('isVerifierMissing', () => {
  it('recognizes the supabase-js error by name and by message', () => {
    expect(isVerifierMissing({ name: 'AuthPKCECodeVerifierMissingError' })).toBe(true)
    expect(isVerifierMissing({ name: 'AuthApiError', message: 'PKCE code verifier not found in storage.' })).toBe(true)
  })

  it('does not swallow any other error', () => {
    expect(isVerifierMissing({ name: 'AuthApiError', message: 'invalid flow state, no valid flow state found' })).toBe(false)
    expect(isVerifierMissing({ name: 'AuthApiError', message: 'Email link is invalid or has expired' })).toBe(false)
    expect(isVerifierMissing(null)).toBe(false)
    expect(isVerifierMissing(undefined)).toBe(false)
  })
})

describe('signedInJustNow', () => {
  it('accepts a real account that signed in seconds ago, the session the link just created', () => {
    expect(signedInJustNow(session({}), NOW)).toBe(true)
  })

  it('rejects no session, so a link opened in another browser stays an error', () => {
    expect(signedInJustNow(null, NOW)).toBe(false)
    expect(signedInJustNow(undefined, NOW)).toBe(false)
  })

  it('rejects an anonymous session, which onboarding gives every visitor', () => {
    expect(signedInJustNow(session({ is_anonymous: true }), NOW)).toBe(false)
  })

  it('rejects an older session, such as someone else already signed in on that browser', () => {
    expect(signedInJustNow(session({ last_sign_in_at: '2026-11-04T04:00:00Z' }), NOW)).toBe(false)
  })

  it('rejects a missing or unreadable sign-in time', () => {
    expect(signedInJustNow(session({ last_sign_in_at: null }), NOW)).toBe(false)
    expect(signedInJustNow(session({ last_sign_in_at: 'not a date' }), NOW)).toBe(false)
  })

  it('rejects a sign-in time in the future beyond clock skew', () => {
    expect(signedInJustNow(session({ last_sign_in_at: '2026-11-04T05:30:00Z' }), NOW)).toBe(false)
  })
})
