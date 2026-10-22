import { describe, it, expect } from 'vitest'
import { CALENDAR_READ_SCOPE, GMAIL_READ_SCOPE, checkGoogleGrant, parseGrantedScopes } from '@/lib/google/grant'
import { googleConnectErrorMessage } from '@/lib/google/connect-error-copy'

describe('parseGrantedScopes', () => {
  it("splits Google's space-separated scope string and ignores blanks", () => {
    expect([...parseGrantedScopes('openid  email\n' + GMAIL_READ_SCOPE)]).toEqual(['openid', 'email', GMAIL_READ_SCOPE])
    expect(parseGrantedScopes(undefined).size).toBe(0)
    expect(parseGrantedScopes('').size).toBe(0)
  })
})

describe('checkGoogleGrant', () => {
  it('accepts a grant that has both Gmail and Calendar', () => {
    expect(checkGoogleGrant({ scope: `openid email ${GMAIL_READ_SCOPE} ${CALENDAR_READ_SCOPE}` })).toEqual({ ok: true })
  })

  it('names which permission was unticked', () => {
    expect(checkGoogleGrant({ scope: `openid email ${CALENDAR_READ_SCOPE}` })).toEqual({ ok: false, problem: 'missing_gmail' })
    expect(checkGoogleGrant({ scope: `openid email ${GMAIL_READ_SCOPE}` })).toEqual({ ok: false, problem: 'missing_calendar' })
    expect(checkGoogleGrant({ scope: 'openid email' })).toEqual({ ok: false, problem: 'missing_both' })
  })

  it('treats a missing scope string as nothing granted', () => {
    expect(checkGoogleGrant({ scope: undefined })).toEqual({ ok: false, problem: 'missing_both' })
    expect(checkGoogleGrant({ scope: null })).toEqual({ ok: false, problem: 'missing_both' })
  })
})

describe('error copy for a partial grant', () => {
  it('says what was missing and what to do, for every problem the check can return', () => {
    for (const problem of ['missing_gmail', 'missing_calendar', 'missing_both'] as const) {
      const message = googleConnectErrorMessage(problem, 'gmail')
      expect(message, problem).toBeTruthy()
      expect(message).toContain('leave both boxes ticked')
    }
    expect(googleConnectErrorMessage('missing_gmail', 'gmail')).toContain('Gmail access')
    expect(googleConnectErrorMessage('missing_calendar', 'gmail')).toContain('Calendar access')
  })
})
