import 'server-only'

// Prompt 76 — candidate-facing Gmail connection. Deliberately separate
// credentials and env vars from src/lib/google/oauth.ts, which is the
// admin-only research-inbox OAuth client (different scope, different
// consent screen, different Google Cloud OAuth client entirely) — reusing
// those would connect the wrong app.
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
// gmail.metadata only — headers (From/To/Subject/Date) and labels, never the
// message body. Classification is designed to work from this alone (see
// classify-email.ts); this scope is Restricted (confirmed in Google Cloud
// Console), which is exactly why this connection stays testing-mode-only
// until a CASA assessment is paid for — see the hard gate in start/route.ts.
const SCOPE = 'https://www.googleapis.com/auth/gmail.metadata'

function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${appUrl}/api/auth/gmail/callback`
}

export function buildCandidateGmailAuthUrl(state: string): string {
  const clientId = process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_ID
  if (!clientId) throw new Error('CANDIDATE_GOOGLE_OAUTH_CLIENT_ID is not set.')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    // Forces re-issue of a refresh_token on every connect — needed since a
    // disconnect-then-reconnect creates a fresh EmailConnection row rather
    // than reusing a stale one.
    prompt: 'consent',
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

// Combined Gmail + Calendar Connect — one consent screen, both scopes, one
// click. Both features share the same OAuth client (see
// google-calendar-oauth.ts's own comment on why), so there was never a
// technical need for two separate connect flows; this is the entry point
// /api/auth/google-connect/{start,callback} use so a candidate isn't asked
// to click "Connect" twice for what's functionally one grant.
export function buildCombinedGoogleAuthUrl(state: string): string {
  const clientId = process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_ID
  if (!clientId) throw new Error('CANDIDATE_GOOGLE_OAUTH_CLIENT_ID is not set.')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/google-connect/callback`,
    response_type: 'code',
    scope: `${SCOPE} https://www.googleapis.com/auth/calendar.events.readonly`,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

function requireCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('CANDIDATE_GOOGLE_OAUTH_CLIENT_ID/SECRET are not configured.')
  }
  return { clientId, clientSecret }
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = requireCredentials()
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    }),
  })
  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status} ${await response.text()}`)
  }
  return response.json()
}

// Testing-mode Google OAuth tokens expire fully after ~7 days (unlike a
// verified app's tokens, which last indefinitely) — a refresh call after
// that point fails with invalid_grant. That failure is expected, not a bug;
// the caller (sync-gmail.ts) turns it into a candidate-facing reconnect
// prompt rather than a silent failure.
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = requireCredentials()
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status} ${await response.text()}`)
  }
  return response.json()
}

// Hard gate, checked before the OAuth redirect even starts — defense in
// depth alongside Google's own test-user allow-list on the consent screen
// itself. No candidate outside this list can connect Gmail while it remains
// in unverified/testing mode, full stop — this must not quietly expand.
export function isGmailTrackingTester(email: string): boolean {
  const allowlist = (process.env.GMAIL_TRACKING_TESTER_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowlist.includes(email.trim().toLowerCase())
}
