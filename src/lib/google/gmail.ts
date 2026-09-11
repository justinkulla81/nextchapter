import 'server-only'
import * as cheerio from 'cheerio'

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

/** Message ids in a rolling window, newest first. */
export async function listMessagesSince(
  accessToken: string,
  since: Date,
  max = 400
): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined
  // Gmail's `after:` takes a unix second.
  const q = `after:${Math.floor(since.getTime() / 1000)} -in:spam -in:trash`

  while (ids.length < max) {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
    url.searchParams.set('q', q)
    url.searchParams.set('maxResults', String(Math.min(100, max - ids.length)))
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
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
export async function getMessageHeaders(
  accessToken: string,
  id: string
): Promise<GmailHeaderMessage | null> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`)
  url.searchParams.set('format', 'metadata')
  for (const h of ['From', 'To', 'Cc', 'Subject', 'Date']) url.searchParams.append('metadataHeaders', h)

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) return null
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

/** The connected mailbox's own address, for deciding direction. */
export async function getProfileEmail(accessToken: string): Promise<string | null> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { emailAddress?: string }
  return data.emailAddress?.toLowerCase() ?? null
}
