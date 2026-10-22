// What Google actually granted after a consent screen. Pure and client-safe, so
// the callback route and the tests share one definition.
//
// Google's consent screen lets a member untick individual permissions
// (granular consent), so a successful token exchange does not mean Gmail and
// Calendar were both granted: the token response's `scope` is the only truth.

export const GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
export const CALENDAR_READ_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly'

export type GrantProblem = 'missing_gmail' | 'missing_calendar' | 'missing_both'

export type GrantCheck = { ok: true } | { ok: false; problem: GrantProblem }

export function parseGrantedScopes(scope: string | null | undefined): Set<string> {
  return new Set((scope ?? '').split(/\s+/).filter(Boolean))
}

// Both permissions are required by the combined Connect Gmail and Calendar flow.
export function checkGoogleGrant(input: { scope: string | null | undefined }): GrantCheck {
  const granted = parseGrantedScopes(input.scope)
  const hasGmail = granted.has(GMAIL_READ_SCOPE)
  const hasCalendar = granted.has(CALENDAR_READ_SCOPE)

  if (!hasGmail && !hasCalendar) return { ok: false, problem: 'missing_both' }
  if (!hasGmail) return { ok: false, problem: 'missing_gmail' }
  if (!hasCalendar) return { ok: false, problem: 'missing_calendar' }
  return { ok: true }
}
