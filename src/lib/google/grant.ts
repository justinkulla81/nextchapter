// What Google actually granted after a consent screen, and whether the account
// is one we accept. Pure and client-safe, so the callback routes and the tests
// share one definition.
//
// Google's consent screen lets a member untick individual permissions
// (granular consent), so a successful token exchange does not mean Gmail and
// Calendar were both granted: the token response's `scope` is the only truth.

export const GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
export const CALENDAR_READ_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly'

export type GrantProblem =
  | 'missing_gmail'
  | 'missing_calendar'
  | 'missing_both'
  // Only reported when requirePersonal is on.
  | 'work_account'
  | 'not_gmail'
  | 'no_identity'

export type GrantCheck = { ok: true } | { ok: false; problem: GrantProblem }

export interface IdTokenClaims {
  email?: string
  email_verified?: boolean
  // Present only for Google Workspace (work or school) accounts, never for
  // consumer Gmail. More reliable than guessing from the email domain.
  hd?: string
  name?: string
  given_name?: string
  family_name?: string
}

const PERSONAL_GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com'])

export function parseGrantedScopes(scope: string | null | undefined): Set<string> {
  return new Set((scope ?? '').split(/\s+/).filter(Boolean))
}

// Reads the payload of the ID token Google returns from the token endpoint.
// It is not signature-verified: the token arrives straight from Google's token
// endpoint over TLS in exchange for our one-time code, which is the case
// Google's docs say needs no extra verification. Never use this on a token that
// came from the browser. Returns null when the token is missing or malformed.
export function decodeIdTokenClaims(idToken: string | null | undefined): IdTokenClaims | null {
  if (!idToken) return null
  const payload = idToken.split('.')[1]
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as IdTokenClaims
    return claims && typeof claims === 'object' ? claims : null
  } catch {
    return null
  }
}

// requirePersonal turns on the personal-Gmail-only rule used by the sign-up
// flow. It stays off for the existing Connect Gmail buttons so a member who
// connected another kind of account before keeps working.
//
// requires says which permissions must have been granted: 'connect' (default)
// is Gmail and Calendar, 'identity' is sign-in only, used while the app's
// Gmail access is not yet open to everyone.
export function checkGoogleGrant(input: {
  scope: string | null | undefined
  idToken?: string | null
  requirePersonal?: boolean
  requires?: 'connect' | 'identity'
}): GrantCheck {
  const granted = parseGrantedScopes(input.scope)
  const hasGmail = granted.has(GMAIL_READ_SCOPE)
  const hasCalendar = granted.has(CALENDAR_READ_SCOPE)

  if (input.requirePersonal) {
    const claims = decodeIdTokenClaims(input.idToken)
    const email = claims?.email?.trim().toLowerCase()
    if (!claims || !email || claims.email_verified === false) return { ok: false, problem: 'no_identity' }
    if (claims.hd) return { ok: false, problem: 'work_account' }
    const domain = email.split('@')[1] ?? ''
    if (!PERSONAL_GMAIL_DOMAINS.has(domain)) return { ok: false, problem: 'not_gmail' }
  }

  if (input.requires === 'identity') return { ok: true }
  if (!hasGmail && !hasCalendar) return { ok: false, problem: 'missing_both' }
  if (!hasGmail) return { ok: false, problem: 'missing_gmail' }
  if (!hasCalendar) return { ok: false, problem: 'missing_calendar' }
  return { ok: true }
}
