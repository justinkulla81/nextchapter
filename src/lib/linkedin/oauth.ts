import 'server-only'
import { callbackOriginForAppPath } from '@/lib/portal-hosts'

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
// Posting as a company page needs LinkedIn's Community Management API product on the app, and the member to be an admin of the page:
// w_organization_social posts as the page, r_organization_admin lists the pages the member administers.
const SCOPE_PAGE = 'openid profile w_member_social w_organization_social r_organization_admin'

export function isLinkedInPostingConfigured(): boolean {
  return !!process.env.LINKEDIN_CLIENT_ID && !!process.env.LINKEDIN_CLIENT_SECRET
}

function getRedirectUri(opts: { admin?: boolean } = {}): string {
  // The admin's "Connect LinkedIn" has no candidate session, so it uses the URL the LinkedIn app has registered: the main site's
  // callback (LINKEDIN_ADMIN_REDIRECT_URI overrides it if the registered URL is different).
  if (opts.admin) return process.env.LINKEDIN_ADMIN_REDIRECT_URI || `${new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com').origin}/api/auth/linkedin/callback`
  // The candidate app's host (candidate.<site> once it's switched on), where the session cookie is.
  const appUrl = callbackOriginForAppPath('/dashboard')
  return `${appUrl}/api/auth/linkedin/callback`
}

export function buildLinkedInAuthUrl(state: string, opts: { admin?: boolean; page?: boolean } = {}): string {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  if (!clientId) throw new Error('LINKEDIN_CLIENT_ID is not set.')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getRedirectUri(opts),
    scope: opts.page ? SCOPE_PAGE : SCOPE,
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

export async function exchangeCodeForTokens(code: string, opts: { admin?: boolean } = {}): Promise<LinkedInTokenResponse> {
  const { clientId, clientSecret } = requireCredentials()
  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(opts),
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

// ---- Admin queue posting: text, one image, then the link as a first comment ----

export type LinkedInVisibility = 'PUBLIC' | 'CONNECTIONS'

export async function fetchLinkedInProfile(accessToken: string): Promise<{ personUrn: string; name: string | null }> {
  const response = await fetch(LINKEDIN_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok) throw new Error('Failed to fetch LinkedIn user info.')
  const data = (await response.json()) as { sub: string; name?: string }
  return { personUrn: `urn:li:person:${data.sub}`, name: data.name ?? null }
}

const liHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  'X-Restli-Protocol-Version': '2.0.0',
})

/** Uploads a PNG and returns its asset URN, ready to attach to a post. */
async function uploadLinkedInImage(accessToken: string, ownerUrn: string, png: Buffer): Promise<string> {
  const reg = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: liHeaders(accessToken),
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: ownerUrn,
        serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
      },
    }),
  })
  if (!reg.ok) throw new Error(`LinkedIn image registration failed: ${reg.status} ${await reg.text()}`)
  const data = (await reg.json()) as {
    value: { asset: string; uploadMechanism: Record<string, { uploadUrl: string }> }
  }
  const uploadUrl = data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl
  if (!uploadUrl) throw new Error('LinkedIn gave no image upload address.')
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'image/png' }, body: new Uint8Array(png) })
  if (!put.ok) throw new Error(`LinkedIn image upload failed: ${put.status}`)
  return data.value.asset
}

/** Publishes text with up to nine images (a swipeable set) as the member. Returns the post URN. */
export async function publishLinkedInShare(o: {
  accessToken: string; authorUrn: string; text: string; images?: Buffer[]; visibility: LinkedInVisibility
}): Promise<string> {
  const assets: string[] = []
  for (const png of (o.images ?? []).slice(0, 9)) assets.push(await uploadLinkedInImage(o.accessToken, o.authorUrn, png)) // one at a time: LinkedIn rate-limits uploads
  const response = await fetch(LINKEDIN_UGC_POSTS_URL, {
    method: 'POST',
    headers: liHeaders(o.accessToken),
    body: JSON.stringify({
      author: o.authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: o.text },
          shareMediaCategory: assets.length ? 'IMAGE' : 'NONE',
          ...(assets.length ? { media: assets.map((media) => ({ status: 'READY', media })) } : {}),
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': o.visibility },
    }),
  })
  if (!response.ok) throw new Error(`LinkedIn post publish failed: ${response.status} ${await response.text()}`)
  const urn = response.headers.get('x-restli-id') ?? ((await response.json().catch(() => ({}))) as { id?: string }).id
  if (!urn) throw new Error('LinkedIn published the post but gave no id.')
  return urn
}

/** Adds a comment to a post as the member (used for the first comment with the link). */
export async function commentOnLinkedInPost(accessToken: string, actorUrn: string, postUrn: string, text: string): Promise<void> {
  const response = await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/comments`, {
    method: 'POST',
    headers: liHeaders(accessToken),
    body: JSON.stringify({ actor: actorUrn, message: { text } }),
  })
  if (!response.ok) throw new Error(`LinkedIn comment failed: ${response.status} ${await response.text()}`)
}

export const linkedInPostUrl = (postUrn: string) => `https://www.linkedin.com/feed/update/${postUrn}/`

/** The company pages this member administers, as { urn, name }. Needs r_organization_admin; throws when LinkedIn refuses. */
export async function fetchAdministeredPages(accessToken: string): Promise<{ urn: string; name: string | null }[]> {
  const res = await fetch('https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED', { headers: liHeaders(accessToken) })
  if (!res.ok) throw new Error(`LinkedIn page list failed: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { elements?: { organization?: string }[] }
  const urns = [...new Set((data.elements ?? []).flatMap((e) => (e.organization ? [e.organization] : [])))]
  return Promise.all(urns.map(async (urn) => {
    const id = urn.split(':').pop()
    const r = await fetch(`https://api.linkedin.com/v2/organizations/${id}?projection=(localizedName)`, { headers: liHeaders(accessToken) }).catch(() => null)
    const name = r?.ok ? ((await r.json().catch(() => ({}))) as { localizedName?: string }).localizedName ?? null : null
    return { urn, name }
  }))
}

/** Which of the administered pages is NextChapter's: the one named for it, or the only one. Null when it cannot tell. */
export function pickNextChapterPage(pages: { urn: string; name: string | null }[]): { urn: string; name: string | null } | null {
  return pages.find((p) => /next\s*chapter/i.test(p.name ?? '')) ?? (pages.length === 1 ? pages[0] : null)
}
