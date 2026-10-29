import 'server-only'
import { createHmac, randomBytes } from 'node:crypto'

const TIMEOUT_MS = 30_000

// Bluesky needs BLUESKY_HANDLE and an app password (never the login password) in BLUESKY_APP_PASSWORD, both set in Vercel production.
export function blueskyConfigured(): boolean {
  return !!process.env.BLUESKY_HANDLE && !!process.env.BLUESKY_APP_PASSWORD
}

export function xConfigured(): boolean {
  return !!process.env.X_API_KEY && !!process.env.X_API_SECRET && !!process.env.X_ACCESS_TOKEN && !!process.env.X_ACCESS_SECRET
}

/** The byte range of the first URL in `text`, as Bluesky link facets want it (UTF-8 offsets). */
export function linkFacets(text: string): { index: { byteStart: number; byteEnd: number }; features: { $type: string; uri: string }[] }[] {
  const m = /https?:\/\/\S+/.exec(text)
  if (!m) return []
  const byteStart = Buffer.byteLength(text.slice(0, m.index))
  return [{ index: { byteStart, byteEnd: byteStart + Buffer.byteLength(m[0]) }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }] }]
}

/** Posts to Bluesky (free AT Protocol API; an app password, never the account password). Returns the post's at:// URI. */
export async function postBluesky(text: string): Promise<string> {
  const base = process.env.BLUESKY_SERVICE ?? 'https://bsky.social'
  const session = await fetch(`${base}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: process.env.BLUESKY_HANDLE, password: process.env.BLUESKY_APP_PASSWORD }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!session.ok) throw new Error(`bluesky session: ${session.status}`)
  const { accessJwt, did } = (await session.json()) as { accessJwt: string; did: string }
  const res = await fetch(`${base}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessJwt}` },
    body: JSON.stringify({
      repo: did,
      collection: 'app.bsky.feed.post',
      record: { $type: 'app.bsky.feed.post', text, facets: linkFacets(text), createdAt: new Date().toISOString(), langs: ['en'] },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`bluesky post: ${res.status} ${await res.text()}`)
  return ((await res.json()) as { uri: string }).uri
}

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

/** OAuth 1.0a (HMAC-SHA1) Authorization header for a JSON-body request: only the oauth_* params are signed. */
export function oauth1Header(method: string, url: string, creds: { key: string; secret: string; token: string; tokenSecret: string }, nonce = randomBytes(16).toString('hex'), timestamp = String(Math.floor(Date.now() / 1000))): string {
  const params: Record<string, string> = {
    oauth_consumer_key: creds.key,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: creds.token,
    oauth_version: '1.0',
  }
  const paramString = Object.keys(params).sort().map((k) => `${enc(k)}=${enc(params[k])}`).join('&')
  const base = [method.toUpperCase(), enc(url), enc(paramString)].join('&')
  const signature = createHmac('sha1', `${enc(creds.secret)}&${enc(creds.tokenSecret)}`).update(base).digest('base64')
  const all = { ...params, oauth_signature: signature }
  return 'OAuth ' + Object.keys(all).sort().map((k) => `${enc(k)}="${enc(all[k as keyof typeof all])}"`).join(', ')
}

/** Posts to X (API v2, user-context). Returns the post id. X bills API usage, so callers gate this behind X_POSTING_ENABLED. */
export async function postX(text: string): Promise<string> {
  const url = 'https://api.x.com/2/tweets'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: oauth1Header('POST', url, {
        key: process.env.X_API_KEY!,
        secret: process.env.X_API_SECRET!,
        token: process.env.X_ACCESS_TOKEN!,
        tokenSecret: process.env.X_ACCESS_SECRET!,
      }),
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`x post: ${res.status} ${await res.text()}`)
  return ((await res.json()) as { data: { id: string } }).data.id
}
