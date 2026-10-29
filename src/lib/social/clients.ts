import 'server-only'
import { createHmac, randomBytes } from 'node:crypto'

const TIMEOUT_MS = 30_000

// Bluesky needs BLUESKY_HANDLE and an app password (never the login password) in BLUESKY_APP_PASSWORD, both set in Vercel production.
export function blueskyConfigured(): boolean {
  return !!process.env.BLUESKY_HANDLE && !!process.env.BLUESKY_APP_PASSWORD
}

// X needs X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN and X_ACCESS_SECRET (app set to Read and write), plus X_POSTING_ENABLED=1 to post.
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

const clean = (v: string | undefined) => (v ?? '').trim().replace(/\/+$/, '')

// Mastodon needs MASTODON_INSTANCE (e.g. https://mastodon.social) and MASTODON_ACCESS_TOKEN (an app with write:statuses). Free API.
export function mastodonConfigured(): boolean {
  return /^https:\/\//.test(clean(process.env.MASTODON_INSTANCE)) && !!process.env.MASTODON_ACCESS_TOKEN
}

/** Posts a public status to Mastodon. The idempotency key stops a retried request from posting twice. Returns the status URL. */
export async function postMastodon(text: string, idempotencyKey?: string): Promise<string> {
  const res = await fetch(`${clean(process.env.MASTODON_INSTANCE)}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.MASTODON_ACCESS_TOKEN}`,
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    },
    body: JSON.stringify({ status: text, visibility: 'public', language: 'en' }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`mastodon post: ${res.status} ${await res.text()}`)
  return ((await res.json()) as { url: string }).url
}

// Telegram needs TELEGRAM_BOT_TOKEN (from @BotFather) and TELEGRAM_CHANNEL_ID (@channelname or the numeric id); the bot must be a channel admin.
export function telegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHANNEL_ID
}

export async function postTelegram(text: string): Promise<string> {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHANNEL_ID, text }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`telegram post: ${res.status}`)
  return String(((await res.json()) as { result: { message_id: number } }).result.message_id)
}

// Discord needs DISCORD_WEBHOOK_URL (channel settings > Integrations > Webhooks).
export function discordConfigured(): boolean {
  return /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(process.env.DISCORD_WEBHOOK_URL ?? '')
}

export async function postDiscord(text: string): Promise<string> {
  const res = await fetch(`${process.env.DISCORD_WEBHOOK_URL}?wait=true`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content: text }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`discord post: ${res.status}`)
  return ((await res.json()) as { id: string }).id
}

// Slack needs SLACK_WEBHOOK_URL (an incoming webhook for the channel).
export function slackConfigured(): boolean {
  return /^https:\/\/hooks\.slack\.com\/services\//.test(process.env.SLACK_WEBHOOK_URL ?? '')
}

export async function postSlack(text: string): Promise<string> {
  const res = await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`slack post: ${res.status}`)
  return 'ok'
}

// Threads needs THREADS_USER_ID and THREADS_ACCESS_TOKEN (long-lived, threads_content_publish; the Meta app must pass review).
export function threadsConfigured(): boolean {
  return !!process.env.THREADS_USER_ID && !!process.env.THREADS_ACCESS_TOKEN
}

/** Two steps: create a text container, then publish it. Returns the thread id. */
export async function postThreads(text: string): Promise<string> {
  const base = `https://graph.threads.net/v1.0/${process.env.THREADS_USER_ID}`
  const token = process.env.THREADS_ACCESS_TOKEN!
  const created = await fetch(`${base}/threads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ media_type: 'TEXT', text }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!created.ok) throw new Error(`threads create: ${created.status} ${await created.text()}`)
  const { id } = (await created.json()) as { id: string }
  const published = await fetch(`${base}/threads_publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ creation_id: id }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!published.ok) throw new Error(`threads publish: ${published.status} ${await published.text()}`)
  return ((await published.json()) as { id: string }).id
}

// Facebook Page needs FACEBOOK_PAGE_ID and FACEBOOK_PAGE_TOKEN (a Page access token with pages_manage_posts; the Meta app must pass review).
export function facebookConfigured(): boolean {
  return !!process.env.FACEBOOK_PAGE_ID && !!process.env.FACEBOOK_PAGE_TOKEN
}

/** Posts to the Page feed; the first link in the text goes in the `link` field so Facebook shows a link card. */
export async function postFacebook(text: string): Promise<string> {
  const link = /https?:\/\/\S+/.exec(text)?.[0]
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.FACEBOOK_PAGE_ID}/feed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.FACEBOOK_PAGE_TOKEN}` },
    body: JSON.stringify({ message: link ? text.replace(link, '').replace(/\s+$/, '') : text, ...(link ? { link } : {}) }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`facebook post: ${res.status} ${await res.text()}`)
  return ((await res.json()) as { id: string }).id
}
