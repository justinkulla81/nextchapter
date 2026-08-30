import 'server-only'

// Reuses the same CANDIDATE_GOOGLE_OAUTH_CLIENT_ID/SECRET every other admin-
// facing Google integration in this codebase does (see webinars/admin-
// calendar-oauth.ts) — this used to look for its own separate
// GOOGLE_CLIENT_ID/SECRET, which was never actually configured as a real
// credential anywhere, so "Connect Gmail" here always failed with
// googleError=not_configured. If the redirect URI below
// (/api/google/oauth/callback) isn't already an authorized redirect URI on
// that shared OAuth client in Google Cloud Console, add it there — that's
// the one piece this fix can't verify from code alone.
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
// Read-only, minimum scope needed — this connects a company-owned inbox
// (research@...), not a candidate's personal account, so it doesn't carry
// the CASA/sensitive-scope compliance weight of Calendar Connect.
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${appUrl}/api/google/oauth/callback`
}

export function buildGoogleAuthUrl(state: string): string {
  const clientId = process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_ID
  if (!clientId) throw new Error('CANDIDATE_GOOGLE_OAUTH_CLIENT_ID is not set.')

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
