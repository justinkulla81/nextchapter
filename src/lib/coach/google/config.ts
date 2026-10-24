// Per-coach Google Calendar: configuration and the pure pieces that need no network.
// The whole feature is off unless both env vars are set, so merging it changes nothing until the
// owner creates the OAuth client (docs/owner-checklist-google-and-counsel.md, "Coach Google Calendar").

/** Calendar events (create, move, delete the sessions booked here) and free/busy (busy or free only, no titles or guests). */
export const COACH_GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'openid',
  'email',
] as const

/** The two scopes Google must actually grant; the consent screen lets people untick them. */
export const COACH_GOOGLE_REQUIRED_SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.freebusy'] as const

export const COACH_GOOGLE_CALLBACK_PATH = '/support/coach/google/callback'

export function coachGoogleCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.COACH_GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.COACH_GOOGLE_CLIENT_SECRET?.trim()
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

/** True only when both env vars are set. Every coach-Google code path checks this first. */
export function coachGoogleEnabled(): boolean {
  return coachGoogleCredentials() !== null
}

export function coachGoogleRedirectUri(): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  return `${appUrl}${COACH_GOOGLE_CALLBACK_PATH}`
}

/** True when Google granted every scope we need. */
export function hasRequiredScopes(granted: string | undefined): boolean {
  const set = new Set((granted ?? '').split(/\s+/))
  return COACH_GOOGLE_REQUIRED_SCOPES.every((s) => set.has(s))
}

/** A calendar id Google accepts: "primary" or an email-shaped id (including group calendar ids). */
export function isValidCalendarId(id: string): boolean {
  const v = id.trim()
  return v === 'primary' || (v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
}

/** What a failed coach connect came back with (?googleError=). Plain language, says what to do next. */
export function coachGoogleErrorMessage(code: string): string | null {
  switch (code) {
    case 'not_available':
      return 'Google Calendar connection is not available yet. Your bookings keep working as they do today.'
    case 'denied':
      return 'The connection was not completed. Press Connect Google Calendar to try again.'
    case 'missing_scopes':
      return 'Google did not give us both calendar permissions. Try again and leave every box ticked. We only read when you are busy or free, never event titles or guests.'
    case 'no_refresh_token':
    case 'exchange_failed':
      return 'Something went wrong connecting your calendar. Try again in a minute.'
    case 'invalid_state':
      return 'That connection link expired. Press Connect Google Calendar to start again.'
    default:
      return null
  }
}
