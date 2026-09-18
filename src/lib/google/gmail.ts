import 'server-only'
import * as cheerio from 'cheerio'
import { extractEmailBody, type GmailMessage as GmailFullMessage } from './gmail-body'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

// Google Alerts always come from this address — scoping the sweep to it
// keeps the inbox usable for anything else that might land there and
// avoids ingesting unrelated mail.
const ALERT_SENDER_QUERY = 'is:unread from:googlealerts-noreply@google.com'

export interface GmailMessageSummary {
  id: string
}

export async function listAlertMessages(accessToken: string): Promise<GmailMessageSummary[]> {
  const params = new URLSearchParams({ q: ALERT_SENDER_QUERY, maxResults: '25' })
  const response = await fetch(`${GMAIL_API_BASE}/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(`Gmail message list failed: ${response.status} ${await response.text()}`)
  }
  const data = (await response.json()) as { messages?: { id: string }[] }
  return data.messages ?? []
}

interface GmailPart {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPart[]
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

function findHtmlPart(part: GmailPart | undefined): string | null {
  if (!part) return null
  if (part.mimeType === 'text/html' && part.body?.data) {
    return decodeBase64Url(part.body.data)
  }
  if (part.parts) {
    for (const child of part.parts) {
      const found = findHtmlPart(child)
      if (found) return found
    }
  }
  return null
}

export async function getMessageHtml(accessToken: string, id: string): Promise<string | null> {
  const response = await fetch(`${GMAIL_API_BASE}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(`Gmail message get failed: ${response.status} ${await response.text()}`)
  }
  const data = (await response.json()) as { payload?: GmailPart }
  return findHtmlPart(data.payload)
}

export async function markMessageRead(accessToken: string, id: string): Promise<void> {
  await fetch(`${GMAIL_API_BASE}/messages/${id}/modify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
  })
}

// Google Alerts wrap every real destination in a redirect link
// (google.com/url?q=<encoded destination>&...) — this unwraps those and
// filters out Google's own housekeeping links (unsubscribe, manage alerts,
// account/policy pages) so only real article URLs come out.
const GOOGLE_HOUSEKEEPING_HOSTS = ['google.com', 'accounts.google.com', 'myaccount.google.com', 'policies.google.com']

export function extractAlertUrls(html: string): string[] {
  const $ = cheerio.load(html)
  const urls = new Set<string>()

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return

    try {
      const parsed = new URL(href)
      if (parsed.hostname.endsWith('google.com')) {
        // Google Alerts redirect links use `url=`; plain Google search
        // result redirects use `q=` — support both since Alerts formatting
        // has changed before and either could show up.
        const wrapped = parsed.searchParams.get('url') ?? parsed.searchParams.get('q')
        if (wrapped) {
          const wrappedUrl = new URL(wrapped)
          if (!GOOGLE_HOUSEKEEPING_HOSTS.some((h) => wrappedUrl.hostname.endsWith(h))) {
            urls.add(wrappedUrl.toString())
          }
        }
        return
      }
      if (!GOOGLE_HOUSEKEEPING_HOSTS.some((h) => parsed.hostname.endsWith(h))) {
        urls.add(parsed.toString())
      }
    } catch {
      // Not a well-formed URL — skip it.
    }
  })

  return Array.from(urls)
}

// ── CRM sweep helpers (Phase 7) ──────────────────────────────────────────────

export interface GmailHeaderMessage {
  id: string
  threadId: string
  internalDate: Date
  from: string | null
  to: string[]
  cc: string[]
  subject: string | null
  snippet: string | null
}

/**
 * Excluded from every CRM query.
 *
 * Drafts were not, and a draft with a recipient looks exactly like a sent
 * message to the sweep — an empty autosaved compose to a contact was logged
 * as an email to them, doubling their touch count and marking them as
 * owing a reply to something never sent.
 */
const NOT_MAIL = '-in:spam -in:trash -in:drafts'

/** Message ids in a rolling window, newest first. */
export async function listMessagesSince(
  accessToken: string,
  since: Date,
  max = 400
): Promise<string[]> {
  return listMessagesByQuery(accessToken, `after:${Math.floor(since.getTime() / 1000)} ${NOT_MAIL}`, max)
}

/**
 * Every message exchanged with one address since `since`, for the
 * one-person, on-demand backfill triggered from the "do you have their
 * email?" prompt.
 *
 * `since` used to be absent — a real relationship can be years deep and
 * that was the point of asking. It is now required by every caller and set
 * to the CRM cutoff, for two reasons: a decade of personal mail with
 * someone who later became an advisor is not CRM activity, and fetching it
 * is what made this call time out. Each message costs two further API
 * round trips (headers, then body), so an unbounded history could not
 * finish inside a serverless request — it wrote a partial history and died
 * before recomputing the person's touch fields, leaving a record that had
 * mail logged against it and still read "never contacted".
 */
export async function listMessagesForAddress(
  accessToken: string,
  email: string,
  since: Date,
  max = 250
): Promise<string[]> {
  const after = `after:${Math.floor(since.getTime() / 1000)}`
  return listMessagesByQuery(accessToken, `${addressClause(email)} ${after} ${NOT_MAIL}`, max)
}

/**
 * Any header the address appears in.
 *
 * Was from/to only, which missed every thread where they were copied — a
 * real relationship often runs through an assistant with the person cc'd,
 * and those threads are exactly the ones that show the relationship is real.
 */
function addressClause(email: string): string {
  const a = JSON.stringify(email) // quoted so Gmail treats it as one token, not two search terms
  return `{from:${a} to:${a} cc:${a} bcc:${a}}`
}

/**
 * How much correspondence with an address predates `before`, and when the
 * newest of it was — without fetching it.
 *
 * The CRM deliberately ignores mail before its cutoff, but "no past emails"
 * about someone you corresponded with for four years reads as a bug. This
 * lets the caller say what is actually true: nothing recent, plenty older.
 */
export async function olderCorrespondence(
  accessToken: string,
  email: string,
  before: Date,
): Promise<{ count: number; newestAt: Date | null }> {
  const q = `${addressClause(email)} before:${Math.floor(before.getTime() / 1000)} ${NOT_MAIL}`
  const ids = await listMessagesByQuery(accessToken, q, 100)
  if (ids.length === 0) return { count: 0, newestAt: null }
  const newest = await getMessageHeaders(accessToken, ids[0])
  return { count: ids.length, newestAt: newest?.internalDate ?? null }
}

async function listMessagesByQuery(accessToken: string, q: string, max: number): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined

  while (ids.length < max) {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
    url.searchParams.set('q', q)
    url.searchParams.set('maxResults', String(Math.min(100, max - ids.length)))
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const res = await fetchWithRetry(url, accessToken)
    if (!res.ok) throw new Error(`Gmail list failed: ${res.status}`)
    const data = (await res.json()) as { messages?: { id: string }[]; nextPageToken?: string }
    for (const m of data.messages ?? []) ids.push(m.id)
    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }
  return ids
}

/**
 * Headers and Gmail's own snippet for one message.
 *
 * Requests format=metadata with an explicit header allow-list, so the message
 * BODY is never fetched — the snippet Gmail returns alongside metadata is the
 * only content that crosses the wire, and it is the ~200 characters the CRM
 * stores. Asking for `full` and then discarding the body would put whole
 * message bodies in memory and in transit for no benefit.
 */
/**
 * A thousands-of-messages backfill runs long enough to hit real transient
 * 429/5xx responses from Gmail — a single failed fetch silently vanishing an
 * otherwise-real message from the sweep (confirmed: refetching one by hand
 * afterward succeeded on the first try). Retries those with backoff; a 4xx
 * that isn't a rate limit (404, permission) means the message itself is
 * gone or unreachable, so that still fails fast with no retry.
 */
export class GmailFetchError extends Error {
  constructor(public status: number, public messageId: string) {
    super(`Gmail fetch failed (${status}) for message ${messageId}`)
  }
}

/**
 * Gmail says "slow down" with a 403, not only a 429.
 *
 * Its per-user quota errors arrive as 403 with reason rateLimitExceeded or
 * userRateLimitExceeded. This used to retry only 429 and 5xx, so a throttled
 * fetch came straight back as a failure — and every caller treats a failed
 * header fetch as "no such message" and moves on. Under load, real emails
 * were silently dropped from the sync with nothing recorded anywhere.
 */
async function isRateLimited(res: Response): Promise<boolean> {
  if (res.status === 429) return true
  if (res.status !== 403) return false
  const body = await res.clone().text().catch(() => '')
  return /rateLimitExceeded|userRateLimitExceeded|quotaExceeded/i.test(body)
}

async function fetchWithRetry(url: URL, accessToken: string, attempts = 6): Promise<Response> {
  let res: Response | null = null
  for (let i = 0; i < attempts; i++) {
    res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (res.ok) return res
    const retryable = res.status >= 500 || (await isRateLimited(res))
    if (!retryable) return res
    if (i < attempts - 1) {
      // Honour Retry-After when Gmail sends one; otherwise back off
      // exponentially with jitter, so eight workers don't retry in lockstep.
      const after = Number(res.headers.get('retry-after'))
      const wait = Number.isFinite(after) && after > 0 ? after * 1000 : 1000 * 2 ** i + Math.random() * 500
      await new Promise((r) => setTimeout(r, Math.min(wait, 20_000)))
    }
  }
  return res!
}

export async function getMessageHeaders(
  accessToken: string,
  id: string
): Promise<GmailHeaderMessage | null> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`)
  url.searchParams.set('format', 'metadata')
  for (const h of ['From', 'To', 'Cc', 'Subject', 'Date']) url.searchParams.append('metadataHeaders', h)

  const res = await fetchWithRetry(url, accessToken)
  // A deleted message is genuinely absent. Anything else is a failure the
  // caller needs to know about rather than read as "nothing here".
  if (res.status === 404) return null
  if (!res.ok) throw new GmailFetchError(res.status, id)
  const data = (await res.json()) as {
    id: string
    threadId: string
    internalDate?: string
    snippet?: string
    payload?: { headers?: { name: string; value: string }[] }
  }

  const header = (name: string) =>
    data.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null
  const split = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])

  return {
    id: data.id,
    threadId: data.threadId,
    internalDate: new Date(Number(data.internalDate ?? Date.now())),
    from: header('From'),
    to: split(header('To')),
    cc: split(header('Cc')),
    subject: header('Subject'),
    snippet: data.snippet ?? null,
  }
}

// Only ever called for a message already classified as a real CRM contact
// (see sweepGmail) — format=full is a heavier fetch than the metadata call
// every other message gets, so this stays opt-in per message rather than
// the default.
export async function getMessageBody(accessToken: string, id: string, maxChars = 20_000): Promise<string | null> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`)
  url.searchParams.set('format', 'full')
  const res = await fetchWithRetry(url, accessToken)
  if (!res.ok) return null
  const data = (await res.json()) as GmailFullMessage
  const body = extractEmailBody(data.payload, maxChars)
  return body || null
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** RFC 2822-escapes a header value that could otherwise break the raw MIME message. */
function encodeHeaderValue(value: string): string {
  return /[^\x20-\x7e]/.test(value) ? `=?UTF-8?B?${Buffer.from(value, 'utf-8').toString('base64')}?=` : value
}

/**
 * Sends an HTML email via the connected Gmail account's own Send As identity
 * — requires the `gmail.send` scope, which existing connections authorized
 * before this feature don't have; sendGmailMessage will 403 for those until
 * reconnected (see the "Send" scope note on the Google connect page).
 */
export async function sendGmailMessage(
  accessToken: string,
  { to, subject, html }: { to: string; subject: string; html: string }
): Promise<{ id: string; threadId: string }> {
  const raw = toBase64Url(
    [
      `To: ${to}`,
      `Subject: ${encodeHeaderValue(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset="UTF-8"',
      '',
      html,
    ].join('\r\n')
  )

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
  if (!res.ok) throw new Error(`Gmail send failed: ${res.status} ${await res.text()}`)
  return res.json()
}

/** The connected mailbox's own address, for deciding direction. */
export async function getProfileEmail(accessToken: string): Promise<string | null> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { emailAddress?: string }
  return data.emailAddress?.toLowerCase() ?? null
}
