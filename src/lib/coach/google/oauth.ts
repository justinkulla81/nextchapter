import 'server-only'
import { COACH_GOOGLE_SCOPES, coachGoogleCredentials, coachGoogleRedirectUri } from '@/lib/coach/google/config'

// OAuth plumbing for the coach's own Google Calendar. Mirrors src/lib/google/oauth.ts but uses the SEPARATE coach
// client (COACH_GOOGLE_CLIENT_ID / COACH_GOOGLE_CLIENT_SECRET) and asks only for calendar.events, calendar.freebusy,
// openid and email. The secret is read from the environment on each call and never logged.
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'

export interface CoachTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

/** Why a refresh failed. `revoked` is the only one that means the coach must reconnect. */
export class CoachRefreshError extends Error {
  constructor(
    readonly kind: 'revoked' | 'transient',
    message: string
  ) {
    super(message)
    this.name = 'CoachRefreshError'
  }
}

function requireCredentials(): { clientId: string; clientSecret: string } {
  const creds = coachGoogleCredentials()
  if (!creds) throw new Error('Coach Google OAuth client is not configured.')
  return creds
}

export function buildCoachAuthUrl(state: string, loginHint?: string | null): string {
  const { clientId } = requireCredentials()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: coachGoogleRedirectUri(),
    response_type: 'code',
    scope: COACH_GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    // consent forces Google to issue a refresh token on every connect; select_account lets the coach pick the right calendar account.
    prompt: 'consent select_account',
    include_granted_scopes: 'false',
    state,
  })
  if (loginHint) params.set('login_hint', loginHint)
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function exchangeCoachCode(code: string): Promise<CoachTokenResponse> {
  const { clientId, clientSecret } = requireCredentials()
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: coachGoogleRedirectUri(), grant_type: 'authorization_code' }),
  })
  if (!response.ok) throw new Error(`Coach Google token exchange failed: ${response.status}`)
  return response.json()
}

export async function refreshCoachAccessToken(refreshToken: string): Promise<CoachTokenResponse> {
  const { clientId, clientSecret } = requireCredentials()
  let response: Response
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
    })
  } catch {
    throw new CoachRefreshError('transient', 'Could not reach Google to refresh the coach token.')
  }
  if (response.ok) return response.json()
  let code = ''
  try {
    code = String(((await response.json()) as { error?: unknown }).error ?? '')
  } catch {
    // Not JSON: treated as transient below.
  }
  // invalid_grant: the coach removed access, the password changed, or the token expired unused. Only this means reconnect.
  // invalid_client or a 5xx is our configuration or Google's outage: it must not disconnect every coach.
  if (code === 'invalid_grant') throw new CoachRefreshError('revoked', 'Google no longer accepts this coach token (invalid_grant).')
  throw new CoachRefreshError('transient', `Coach Google token refresh failed: ${response.status} ${code}`.trim())
}

/** Best effort: tells Google to drop the grant. A failure changes nothing for the coach. */
export async function revokeCoachToken(token: string): Promise<void> {
  if (!token) return
  try {
    await fetch(GOOGLE_REVOKE_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }) })
  } catch {
    // Disconnecting here still stops us using the token.
  }
}
