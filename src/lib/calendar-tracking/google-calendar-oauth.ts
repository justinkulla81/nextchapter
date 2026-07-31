import 'server-only'
import { isGmailTrackingTester } from '@/lib/email-tracking/gmail-oauth'

// Prompt 79 — candidate-facing Calendar Connect. Shares the
// CANDIDATE_GOOGLE_OAUTH_CLIENT_ID/SECRET OAuth client with Gmail (Prompt 76)
// — same client, different scope and redirect URI — since both were set up
// on it during the same walkthrough. Deliberately separate from
// src/lib/google/oauth.ts, the admin-only research-inbox OAuth client.
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
// calendar.events.readonly alone is enough to list/read events on the
// primary calendar — no separate calendar.readonly (calendar-list) scope
// needed. Unlike gmail.metadata, this scope is Sensitive, not Restricted
// (confirmed against Google's own restricted-scopes list) — no CASA review
// required, only standard OAuth verification. Still testing-mode gated below
// because the OAuth app itself isn't verified yet.
const SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly'

function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${appUrl}/api/auth/calendar/callback`
}

export function buildCandidateCalendarAuthUrl(state: string): string {
  const clientId = process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_ID
  if (!clientId) throw new Error('CANDIDATE_GOOGLE_OAUTH_CLIENT_ID is not set.')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    // Forces re-issue of a refresh_token on every connect — needed since a
    // disconnect-then-reconnect creates a fresh CalendarConnection row rather
    // than reusing a stale one.
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

// Testing-mode Google OAuth tokens expire fully after ~7 days — same
// expected-not-a-bug behavior as Gmail's refreshAccessToken; the caller
// (sync-google-calendar.ts) turns a refresh failure into a candidate-facing
// reconnect prompt.
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

// Deliberately the same allow-list as Gmail (GMAIL_TRACKING_TESTER_EMAILS) —
// one internal-testing cohort across both connect-account features, not a
// second env var to keep in sync.
export async function isCalendarTrackingTester(email: string): Promise<boolean> {
  return isGmailTrackingTester(email)
}
