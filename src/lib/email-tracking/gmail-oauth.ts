import 'server-only'
import { prisma } from '@/lib/prisma'
import { getAccountActivityAdminEmail } from '@/lib/admin/auth'
import { sendAdminGmailAccessNeededEmail } from '@/lib/email/send-admin-gmail-access-needed'

// Prompt 76 — candidate-facing Gmail connection. Deliberately separate
// credentials and env vars from src/lib/google/oauth.ts, which is the
// admin-only research-inbox OAuth client (different scope, different
// consent screen, different Google Cloud OAuth client entirely) — reusing
// those would connect the wrong app.
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
// gmail.readonly — headers, labels, AND message body/attachment metadata.
// Upgraded from gmail.metadata because subject-only classification missed
// real thank-you/follow-up/check-in notes and can't detect resume
// attachments at all. Both scopes are Restricted (confirmed in Google Cloud
// Console) — this is not a bigger compliance lift than before, since
// gmail.metadata already required the same CASA assessment prior to
// leaving testing-mode; see the hard gate in start/route.ts. Existing
// connections authorized under the old metadata-only scope will 403 on
// their next full-format fetch and get flagged needsReconnectAt, same as
// any other token failure (see sync-gmail.ts).
//
// `openid email` added for §4.6 — the connection flow previously carried no
// identity claim at all (no way to know WHICH Google account got
// connected), so a corporate-domain hard block for Confidential Search Mode
// candidates had nothing to check. This is the minimal addition that
// returns an ID token/userinfo without asking for anything beyond email
// identity — no new Restricted-scope surface, no extra CASA burden.
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly openid email'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${appUrl}/api/auth/gmail/callback`
}

// Exported so the combined callback route can pass the exact redirect_uri
// it authorized with — Google's token endpoint 400s (redirect_uri_mismatch)
// if the exchange doesn't repeat the same value used to obtain the code.
export function getCombinedRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${appUrl}/api/auth/google-connect/callback`
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

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getCombinedRedirectUri(),
    response_type: 'code',
    scope: `${SCOPE} https://www.googleapis.com/auth/calendar.events.readonly`,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

// §4.6 — fetches the connected Google account's own email address. Returns
// null on any failure (network error, missing email in the response) so a
// callback route can fail open toward "couldn't verify, allow it" rather
// than silently blocking every connection if this endpoint has a bad day;
// the corporate-domain check downstream is the safety net specifically for
// Confidential Search Mode, not a general connectivity gate.
export async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!response.ok) return null
    const data = (await response.json()) as { email?: string }
    return data.email ?? null
  } catch (error) {
    console.error('Failed to fetch connected Google account email:', error)
    return null
  }
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

// redirectUri must exactly match whichever authorize URL produced `code` —
// Google's token endpoint 400s otherwise. Defaults to the Gmail-only
// callback since that's the original (only) caller; the combined callback
// passes getCombinedRedirectUri() explicitly.
export async function exchangeCodeForTokens(code: string, redirectUri: string = getRedirectUri()): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = requireCredentials()
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
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
//
// Three sources, any one of which grants access: the legacy env var (kept
// as a deploy-time override that always works even if the DB is
// unreachable), a candidate's own gmailTrackingTesterEnabled toggle (set
// from /support/admin/tracking-testers), and the manual
// TrackingTesterAllowlistEntry table (for emails not tied to any candidate,
// e.g. an admin's own test inbox).
export async function isGmailTrackingTester(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase()

  const envAllowlist = (process.env.GMAIL_TRACKING_TESTER_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (envAllowlist.includes(normalized)) return true

  const [candidate, manualEntry] = await Promise.all([
    prisma.candidateProfile.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
      select: { gmailTrackingTesterEnabled: true },
    }),
    prisma.trackingTesterAllowlistEntry.findUnique({ where: { email: normalized } }),
  ])
  return !!candidate?.gmailTrackingTesterEnabled || !!manualEntry
}

// The OAuth consent screen's test-user list has no API — Google requires
// adding each email by hand in Cloud Console. This turns "a candidate hit
// the hard gate" into an immediate admin email carrying both links the
// admin needs (add as Google test user, approve on our own allow-list)
// instead of relying on the admin to notice unmet demand. Fired from all
// three OAuth start routes (gmail, calendar, google-connect) that share
// this gate. Best-effort and fire-and-forget — a failed send must never
// block the candidate's redirect back to the app.
export async function notifyAdminGmailAccessNeeded(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase()
  const candidate = await prisma.candidateProfile.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    select: { id: true, firstName: true, lastName: true, email: true, gmailAccessRequestedAt: true },
  })
  // No matching profile, or we've already notified for this candidate once
  // — never re-sent on every retry.
  if (!candidate || candidate.gmailAccessRequestedAt) return

  await prisma.candidateProfile.update({
    where: { id: candidate.id },
    data: { gmailAccessRequestedAt: new Date() },
  })

  const adminEmail = getAccountActivityAdminEmail()
  if (!adminEmail) return

  const candidateName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'Unnamed'
  const clientId = process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_ID || ''
  const projectNumber = clientId.split('-')[0]
  const googleConsoleUrl = projectNumber
    ? `https://console.cloud.google.com/apis/credentials/consent?project=${projectNumber}`
    : 'https://console.cloud.google.com/apis/credentials/consent'

  sendAdminGmailAccessNeededEmail(
    adminEmail,
    candidate.id,
    candidateName,
    candidate.email ?? normalized,
    googleConsoleUrl
  ).catch((error) => {
    console.error('Failed to send admin gmail-access-needed email:', error)
  })
}
