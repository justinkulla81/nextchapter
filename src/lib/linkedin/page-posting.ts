import 'server-only'

/**
 * Posting as the NextChapter company page. LinkedIn only grants the page scopes
 * (w_organization_social, r_organization_admin) to an app whose one product is
 * the Community Management API, so this uses its own app ("NextChapter Publishing"),
 * separate from the app the site's sign-in and candidate sharing use. It talks to
 * LinkedIn's versioned Posts, Images and Social Actions APIs, which that product covers.
 */
const AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const API = 'https://api.linkedin.com/rest'
/** LinkedIn's monthly API version; set LINKEDIN_API_VERSION to move it. */
const version = () => process.env.LINKEDIN_API_VERSION || '202610'
const SCOPE = 'r_organization_admin w_organization_social'

export const isPagePostingConfigured = (): boolean => !!process.env.LINKEDIN_PUBLISHING_CLIENT_ID && !!process.env.LINKEDIN_PUBLISHING_CLIENT_SECRET

function creds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.LINKEDIN_PUBLISHING_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_PUBLISHING_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('LINKEDIN_PUBLISHING_CLIENT_ID/LINKEDIN_PUBLISHING_CLIENT_SECRET are not configured.')
  return { clientId, clientSecret }
}

/** The callback registered on the LinkedIn app: the main site's, so no candidate session is needed. */
export function pageRedirectUri(): string {
  return process.env.LINKEDIN_PUBLISHING_REDIRECT_URI || `${new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com').origin}/api/auth/linkedin/callback`
}

export function buildPageAuthUrl(state: string): string {
  const { clientId } = creds()
  return `${AUTH_URL}?${new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: pageRedirectUri(), scope: SCOPE, state })}`
}

export async function exchangePageCode(code: string): Promise<{ access_token: string; expires_in: number; scope?: string }> {
  const { clientId, clientSecret } = creds()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: pageRedirectUri(), client_id: clientId, client_secret: clientSecret }),
  })
  if (!res.ok) throw new Error(`LinkedIn token exchange failed: ${res.status} ${await res.text()}`)
  return res.json()
}

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  'X-Restli-Protocol-Version': '2.0.0',
  'LinkedIn-Version': version(),
})

/** The company pages this member administers, as { urn, name }. Throws when LinkedIn refuses. */
export async function fetchAdministeredPages(token: string): Promise<{ urn: string; name: string | null }[]> {
  const res = await fetch(`${API}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED`, { headers: headers(token) })
  if (!res.ok) throw new Error(`LinkedIn page list failed: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as { elements?: { organization?: string }[] }
  const urns = [...new Set((data.elements ?? []).flatMap((e) => (e.organization ? [e.organization] : [])))]
  return Promise.all(urns.map(async (urn) => {
    const r = await fetch(`${API}/organizations/${urn.split(':').pop()}`, { headers: headers(token) }).catch(() => null)
    const name = r?.ok ? ((await r.json().catch(() => ({}))) as { localizedName?: string }).localizedName ?? null : null
    return { urn, name }
  }))
}

/** Which of the administered pages is NextChapter's: the one named for it, or the only one. Null when it cannot tell. */
export function pickNextChapterPage(pages: { urn: string; name: string | null }[]): { urn: string; name: string | null } | null {
  return pages.find((p) => /next\s*chapter/i.test(p.name ?? '')) ?? (pages.length === 1 ? pages[0] : null)
}

/**
 * Post text for the Posts API's "little text format", where | { } @ [ ] ( ) < > # \ * _ ~ are markup.
 * Left alone they cut the post off at the first "(", so each is escaped, and a #word becomes a real hashtag.
 */
export function toCommentary(text: string): string {
  return text
    .replace(/#(\w+)/g, '\u0001$1\u0002')
    .replace(/[|{}@\[\]()<>#\\*_~]/g, (c) => `\\${c}`)
    .replace(/\u0001(\w+)\u0002/g, '{hashtag|\\#|$1}')
}

/** Uploads a PNG for the page and returns its image URN. */
async function uploadImage(token: string, orgUrn: string, png: Buffer): Promise<string> {
  const init = await fetch(`${API}/images?action=initializeUpload`, { method: 'POST', headers: headers(token), body: JSON.stringify({ initializeUploadRequest: { owner: orgUrn } }) })
  if (!init.ok) throw new Error(`LinkedIn image upload start failed: ${init.status} ${await init.text()}`)
  const { value } = (await init.json()) as { value: { uploadUrl: string; image: string } }
  const put = await fetch(value.uploadUrl, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' }, body: new Uint8Array(png) })
  if (!put.ok) throw new Error(`LinkedIn image upload failed: ${put.status}`)
  return value.image
}

/** Publishes a public post as the page: text, and up to nine images as a swipeable set. Returns the post URN. */
export async function publishPagePost(o: { token: string; orgUrn: string; text: string; images?: Buffer[]; altText?: string }): Promise<string> {
  const urns: string[] = []
  for (const png of (o.images ?? []).slice(0, 9)) urns.push(await uploadImage(o.token, o.orgUrn, png)) // one at a time: LinkedIn rate-limits uploads
  const alt = o.altText ?? 'NextChapter'
  const content = urns.length > 1
    ? { multiImage: { images: urns.map((id) => ({ id, altText: alt })) } }
    : urns.length === 1 ? { media: { id: urns[0], altText: alt } } : undefined
  const res = await fetch(`${API}/posts`, {
    method: 'POST',
    headers: headers(o.token),
    body: JSON.stringify({
      author: o.orgUrn,
      commentary: toCommentary(o.text),
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      ...(content ? { content } : {}),
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  })
  if (!res.ok) throw new Error(`LinkedIn post failed: ${res.status} ${await res.text()}`)
  const urn = res.headers.get('x-restli-id')
  if (!urn) throw new Error('LinkedIn published the post but gave no id.')
  return urn
}

/** Comments on a post as the page (the first comment, with the link). */
export async function commentAsPage(token: string, orgUrn: string, postUrn: string, text: string): Promise<void> {
  const res = await fetch(`${API}/socialActions/${encodeURIComponent(postUrn)}/comments`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ actor: orgUrn, object: postUrn, message: { text } }),
  })
  if (!res.ok) throw new Error(`LinkedIn comment failed: ${res.status} ${await res.text()}`)
}

export const postUrl = (postUrn: string) => `https://www.linkedin.com/feed/update/${postUrn}/`
