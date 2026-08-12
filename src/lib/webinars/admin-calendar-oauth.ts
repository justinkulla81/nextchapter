import 'server-only'

// Prompt 86 — admin-side write-scope Google Calendar connection, used only
// to create webinar events with an auto-generated Meet link. Shares the
// CANDIDATE_GOOGLE_OAUTH_CLIENT_ID/SECRET OAuth client with the candidate-
// facing read-only Calendar Connect (Prompt 79) and Gmail (Prompt 76) — same
// client, different scope and redirect URI. This satisfies the previously-
// pending "Google Meet OAuth for coaches/recruiters" work by making it a
// single NextChapter-owned connection (see AdminGoogleCalendarConnection)
// rather than a per-coach OAuth flow, which would be a much larger lift.
//
// IMPORTANT — this OAuth client is still in Google's "Testing" publishing
// status (see google-calendar-oauth.ts's comment), which caps consent to
// explicitly-added test users. Whoever clicks "Connect Google Calendar" on
// the admin Webinars page must be added as a test user on this OAuth
// client's consent screen in Google Cloud Console first, or the consent
// screen will reject them with "access blocked."
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
// Write scope — broader than Prompt 79's calendar.events.readonly, needed to
// create events with conferenceData (the auto-generated Meet link).
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'

function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${appUrl}/api/admin/google-calendar/callback`
}

export function buildAdminCalendarAuthUrl(state: string): string {
  const clientId = process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_ID
  if (!clientId) throw new Error('CANDIDATE_GOOGLE_OAUTH_CLIENT_ID is not set.')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPE,
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

export async function exchangeCodeForAdminTokens(code: string): Promise<GoogleTokenResponse> {
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

async function refreshAdminAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
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

// Returns a valid access token for the singleton admin connection, refreshing
// it first if it's expired. Throws if no connection exists — callers should
// catch this and point the admin at the connect flow.
export async function getValidAdminAccessToken(): Promise<string> {
  const { prisma } = await import('@/lib/prisma')
  const connection = await prisma.adminGoogleCalendarConnection.findFirst()
  if (!connection) throw new Error('Google Calendar is not connected yet.')

  if (connection.expiresAt.getTime() > Date.now() + 60_000) {
    return connection.accessToken
  }

  const refreshed = await refreshAdminAccessToken(connection.refreshToken)
  await prisma.adminGoogleCalendarConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: refreshed.access_token,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    },
  })
  return refreshed.access_token
}
