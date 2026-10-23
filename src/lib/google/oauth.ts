import 'server-only'
import { adminGoogleClient } from '@/lib/google/admin-client'

// Uses the admin Google OAuth client (see admin-client.ts — falls back to the
// candidate client until ADMIN_GOOGLE_OAUTH_CLIENT_ID/SECRET are set). The
// redirect URI below (/api/google/oauth/callback) must be an authorized
// redirect URI on whichever client is active, in Google Cloud Console.
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
// Gmail read-only, Calendar write, plus openid+email — one consent grant
// covers both GoogleInboxConnection (Market Pulse's inbox sweep, CRM's
// email-activity sweep) and AdminGoogleCalendarConnection (CRM's meeting
// sweep, Webinar scheduling). openid+email is not optional: fetchGoogleUserEmail
// below calls the userinfo endpoint to record which account connected, and
// that endpoint returns no email field without this scope — its absence is
// almost certainly why this flow silently failed every previous attempt
// (GoogleInboxConnection was empty before this fix). The candidate-facing
// Gmail flow (email-tracking/gmail-oauth.ts) already includes it for the
// same reason.
// gmail.send added for the CRM's compose-and-send outreach flow — a
// connection authorized before this feature shipped won't have it and
// sendGmailMessage will 403 until the admin reconnects (prompt=consent below
// forces a fresh grant covering the new scope rather than silently reusing
// the old one).
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/documents.readonly openid email'

function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${appUrl}/api/google/oauth/callback`
}

export function buildGoogleAuthUrl(state: string): string {
  const { clientId } = adminGoogleClient()
  if (!clientId) throw new Error('ADMIN_GOOGLE_OAUTH_CLIENT_ID (or CANDIDATE_GOOGLE_OAUTH_CLIENT_ID) is not set.')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    // Forces the consent screen every time, which is what makes Google
    // re-issue a refresh_token on every connect (otherwise only issued once
    // per user, ever) — needed since we don't support account linking, only
    // create-a-fresh-connection-row.
    // select_account: always show the chooser, so a second address can be added
    // instead of Google silently reusing whichever one is signed in.
    prompt: 'consent select_account',
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
  const { clientId, clientSecret } = adminGoogleClient()
  if (!clientId || !clientSecret) {
    throw new Error('Admin Google OAuth client ID/secret are not configured.')
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

export async function fetchGoogleUserEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Failed to fetch Google user info.')
  const data = (await response.json()) as { email: string }
  return data.email
}
