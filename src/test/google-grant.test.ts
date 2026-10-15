import { describe, it, expect } from 'vitest'
import {
  CALENDAR_READ_SCOPE,
  GMAIL_READ_SCOPE,
  checkGoogleGrant,
  decodeIdTokenClaims,
  parseGrantedScopes,
} from '@/lib/google/grant'

function idToken(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'RS256' })}.${b64(claims)}.signature`
}

const BOTH = `openid email ${GMAIL_READ_SCOPE} ${CALENDAR_READ_SCOPE}`

describe('parseGrantedScopes', () => {
  it('splits Google\'s space-separated scope string and ignores blanks', () => {
    expect([...parseGrantedScopes('openid  email\n' + GMAIL_READ_SCOPE)]).toEqual(['openid', 'email', GMAIL_READ_SCOPE])
    expect(parseGrantedScopes(undefined).size).toBe(0)
    expect(parseGrantedScopes('').size).toBe(0)
  })
})

describe('decodeIdTokenClaims', () => {
  it('reads the payload, including non-ASCII names', () => {
    const claims = decodeIdTokenClaims(idToken({ email: 'a@gmail.com', email_verified: true, name: 'José' }))
    expect(claims).toMatchObject({ email: 'a@gmail.com', email_verified: true, name: 'José' })
  })

  it('returns null — never throws — for a missing or malformed token', () => {
    expect(decodeIdTokenClaims(undefined)).toBeNull()
    expect(decodeIdTokenClaims('')).toBeNull()
    expect(decodeIdTokenClaims('not-a-jwt')).toBeNull()
    expect(decodeIdTokenClaims('a.%%%.c')).toBeNull()
  })
})

describe('checkGoogleGrant — scopes', () => {
  it('accepts a grant that has both Gmail and Calendar', () => {
    expect(checkGoogleGrant({ scope: BOTH })).toEqual({ ok: true })
  })

  it('names which permission was unticked', () => {
    expect(checkGoogleGrant({ scope: `openid email ${CALENDAR_READ_SCOPE}` })).toEqual({ ok: false, problem: 'missing_gmail' })
    expect(checkGoogleGrant({ scope: `openid email ${GMAIL_READ_SCOPE}` })).toEqual({ ok: false, problem: 'missing_calendar' })
    expect(checkGoogleGrant({ scope: 'openid email' })).toEqual({ ok: false, problem: 'missing_both' })
    expect(checkGoogleGrant({ scope: undefined })).toEqual({ ok: false, problem: 'missing_both' })
  })

  it('does not look at the account when requirePersonal is off', () => {
    const work = idToken({ email: 'a@acme.com', email_verified: true, hd: 'acme.com' })
    expect(checkGoogleGrant({ scope: BOTH, idToken: work })).toEqual({ ok: true })
  })
})

describe('checkGoogleGrant — personal Gmail only', () => {
  const personal = idToken({ email: 'Sam@Gmail.com', email_verified: true })

  it('accepts a consumer Gmail account with both scopes', () => {
    expect(checkGoogleGrant({ scope: BOTH, idToken: personal, requirePersonal: true })).toEqual({ ok: true })
    expect(
      checkGoogleGrant({ scope: BOTH, idToken: idToken({ email: 'sam@googlemail.com' }), requirePersonal: true }),
    ).toEqual({ ok: true })
  })

  it('rejects Google Workspace accounts by the hd claim, even on a gmail-looking address', () => {
    const workspace = idToken({ email: 'sam@acme.com', email_verified: true, hd: 'acme.com' })
    expect(checkGoogleGrant({ scope: BOTH, idToken: workspace, requirePersonal: true })).toEqual({ ok: false, problem: 'work_account' })
    const odd = idToken({ email: 'sam@gmail.com', hd: 'acme.com' })
    expect(checkGoogleGrant({ scope: BOTH, idToken: odd, requirePersonal: true })).toEqual({ ok: false, problem: 'work_account' })
  })

  it('rejects a non-Gmail address that has no hd claim', () => {
    const other = idToken({ email: 'sam@yahoo.com', email_verified: true })
    expect(checkGoogleGrant({ scope: BOTH, idToken: other, requirePersonal: true })).toEqual({ ok: false, problem: 'not_gmail' })
  })

  it('fails closed when identity is missing or unverified', () => {
    expect(checkGoogleGrant({ scope: BOTH, requirePersonal: true })).toEqual({ ok: false, problem: 'no_identity' })
    expect(checkGoogleGrant({ scope: BOTH, idToken: 'junk', requirePersonal: true })).toEqual({ ok: false, problem: 'no_identity' })
    const unverified = idToken({ email: 'sam@gmail.com', email_verified: false })
    expect(checkGoogleGrant({ scope: BOTH, idToken: unverified, requirePersonal: true })).toEqual({ ok: false, problem: 'no_identity' })
  })

  it('checks the account before the scopes, so a work account is told that first', () => {
    const workspace = idToken({ email: 'sam@acme.com', hd: 'acme.com' })
    expect(checkGoogleGrant({ scope: 'openid email', idToken: workspace, requirePersonal: true })).toEqual({ ok: false, problem: 'work_account' })
  })
})
