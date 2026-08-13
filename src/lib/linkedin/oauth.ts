import 'server-only'

// My Marketing Plan redesign — optional direct "Post to LinkedIn" button.
// No LinkedIn OAuth app has been created for this codebase yet — confirmed
// via grep, no LINKEDIN_CLIENT_ID/SECRET exists anywhere. This module is
// real, working OAuth + posting logic, but every entry point is gated
// behind isLinkedInPostingConfigured() so nothing here is reachable until
// those two env vars are actually set (see CandidateProfile deferred
// follow-ups in memory). Structurally mirrors
// src/lib/calendar-tracking/google-calendar-oauth.ts (the other
// per-candidate, candidate-facing OAuth connection in this codebase).
const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo'
const LINKEDIN_UGC_POSTS_URL = 'https://api.linkedin.com/v2/ugcPosts'

// openid+profile (OpenID Connect "Sign In with LinkedIn") is how the member
// URN required for posting is obtained (/v2/userinfo's `sub` claim);
// w_member_social is LinkedIn's "Share on LinkedIn" product scope, the
// actual posting permission.
const SCOPE = 'openid profile w_member_social'

export function isLinkedInPostingConfigured(): boolean {
  return !!process.env.LINKEDIN_CLIENT_ID && !!process.env.LINKEDIN_CLIENT_SECRET
}

function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${appUrl}/api/auth/linkedin/callback`
}

export function buildLinkedInAuthUrl(state: string): string {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  if (!clientId) throw new Error('LINKEDIN_CLIENT_ID is not set.')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    scope: SCOPE,
    state,
  })
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`
}

interface LinkedInTokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
}

function requireCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('LINKEDIN_CLIENT_ID/LINKEDIN_CLIENT_SECRET are not configured.')
  }
  return { clientId, clientSecret }
}

export async function exchangeCodeForTokens(code: string): Promise<LinkedInTokenResponse> {
  const { clientId, clientSecret } = requireCredentials()
  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!response.ok) {
    throw new Error(`LinkedIn token exchange failed: ${response.status} ${await response.text()}`)
  }
  return response.json()
}

export async function fetchLinkedInPersonUrn(accessToken: string): Promise<string> {
  const response = await fetch(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('Failed to fetch LinkedIn user info.')
  const data = (await response.json()) as { sub: string }
  return `urn:li:person:${data.sub}`
}

// Publishes a plain-text share via the UGC Posts API (the standard
// "Share on LinkedIn" endpoint). No image/article attachment support —
// the candidate-facing feature only ever posts the text they approved.
export async function publishLinkedInPost(accessToken: string, personUrn: string, text: string): Promise<void> {
  const response = await fetch(LINKEDIN_UGC_POSTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    }),
  })
  if (!response.ok) {
    throw new Error(`LinkedIn post publish failed: ${response.status} ${await response.text()}`)
  }
}
