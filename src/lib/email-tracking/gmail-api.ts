import 'server-only'
import { prisma } from '@/lib/prisma'
import { refreshAccessToken } from './gmail-oauth'
import { extractEmailBody, type GmailMessage } from '@/lib/google/gmail-body'
import type { EmailConnection } from '@prisma/client'

// Gmail API plumbing shared by the candidate inbox sync (sync-gmail.ts) and
// the platform-tracking history scan (lib/platforms/backfill.ts): token
// refresh, rate-limit-aware retries, and bounded-concurrency fetching.

export const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'

// Body text is only used for regex keyword matching, never stored — cap it
// well past any realistic phrase-matching need so a huge email can't blow
// up regex evaluation time.
const BODY_PREVIEW_MAX_CHARS = 4000

// MIME-walking helpers (findPartByMimeType, stripHtml, extractEmailBody,
// getAttachmentFilenames, getHeader, and the Gmail*  types) live in
// @/lib/google/gmail-body — shared with the admin-side sweep, which reads
// the same API shape under a different OAuth connection.
export function extractBodyPreview(part: Parameters<typeof extractEmailBody>[0]): string {
  return extractEmailBody(part, BODY_PREVIEW_MAX_CHARS)
}

// Testing-mode refresh tokens expire ~7 days after issue — a refresh
// failure here is expected, not a bug. Turns into a candidate-facing
// reconnect prompt (needsReconnectAt), never a silent failure.
export async function ensureFreshAccessToken(connection: EmailConnection): Promise<string | null> {
  const bufferMs = 2 * 60 * 1000
  if (connection.expiresAt.getTime() - bufferMs > Date.now()) {
    return connection.accessToken
  }
  try {
    const tokens = await refreshAccessToken(connection.refreshToken)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
    await prisma.emailConnection.update({
      where: { id: connection.id },
      data: { accessToken: tokens.access_token, expiresAt, needsReconnectAt: null },
    })
    return tokens.access_token
  } catch (error) {
    console.error('Gmail token refresh failed — flagging for reconnect:', error)
    await prisma.emailConnection.update({
      where: { id: connection.id },
      data: { needsReconnectAt: new Date() },
    })
    return null
  }
}

// Gmail returns 403 for several unrelated reasons — a genuinely
// insufficient-scope token (`PERMISSION_DENIED` with no rate-limit
// reason), but also `rateLimitExceeded`/`userRateLimitExceeded`/
// `dailyLimitExceeded` for an ordinary per-user quota hit, most likely on
// exactly the sync that's most likely to trip it: a brand-new
// connection's first pass over a real inbox, fetching many messages at
// MESSAGE_FETCH_CONCURRENCY. Real bug, not hypothetical — a fresh
// connection was being flagged needsReconnectAt (see the scopeInsufficient
// block below) within minutes of connecting, on a token that was never
// actually missing any scope. Only the reasons that genuinely mean "this
// token can't do format=full" count as insufficientScope; anything else
// is a transient failure, same treatment as any other non-403 error.
const RATE_LIMIT_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded', 'quotaExceeded'])

export async function isRetryable(response: Response): Promise<boolean> {
  if (response.status === 429 || response.status >= 500) return true
  if (response.status !== 403) return false
  try {
    const body = (await response.clone().json()) as { error?: { errors?: { reason?: string }[] } }
    const reason = body.error?.errors?.[0]?.reason
    return !!reason && RATE_LIMIT_REASONS.has(reason)
  } catch {
    return false
  }
}

async function isInsufficientScopeError(response: Response): Promise<boolean> {
  try {
    const body = (await response.clone().json()) as { error?: { errors?: { reason?: string }[] } }
    const reason = body.error?.errors?.[0]?.reason
    if (reason && RATE_LIMIT_REASONS.has(reason)) return false
  } catch {
    // Non-JSON or unparseable body — fall through to treating this 403 as
    // a real scope failure, the safer of the two wrong guesses (a false
    // reconnect prompt is recoverable; silently never reconnecting a truly
    // dead token isn't).
  }
  return true
}

// format=full (not metadata) so classification can read the body and check
// for attachments — see gmail-oauth.ts for the gmail.readonly scope this
// requires. insufficientScope distinguishes "this token predates the scope
// upgrade" (needs a real reconnect) from an ordinary transient failure.
export async function getFullMessage(
  accessToken: string,
  id: string
): Promise<FetchedMessage> {
  const url = `${GMAIL_API}/messages/${id}?format=full`
  // Gmail rate-limits bursts (429) and has transient 5xx — a message that
  // failed once was previously dropped for good. Retry with backoff.
  // Gmail's per-user quota comes back as a 403 (not a 429) — it used to be
  // treated as a permanent failure, dropping every message fetched during a
  // burst. Waits are long enough to let the per-minute window roll over.
  let response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  for (let attempt = 1; attempt <= 4 && (await isRetryable(response)); attempt++) {
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt))
    response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  }
  // Still rate-limited or erroring after the retries: worth another try next
  // run. Anything else (a message deleted since it was listed) never will be.
  if (await isRetryable(response)) return { message: null, insufficientScope: false, temporary: true }
  if (response.status === 403) return { message: null, insufficientScope: await isInsufficientScopeError(response), temporary: false }
  if (!response.ok) return { message: null, insufficientScope: false, temporary: false }
  return { message: await response.json(), insufficientScope: false, temporary: false }
}

export type FetchedMessage = { message: GmailMessage | null; insufficientScope: boolean; temporary?: boolean }

// Fetching each message is a standalone network round trip with no shared
// state — unlike the classify+persist step below (kept sequential because it
// writes the sprint's committedActions JSON), there's no correctness reason
// to fetch one at a time. A candidate returning after several days away
// could have 50-100+ new messages, and doing those fetches strictly
// sequentially was most of what made a sync feel "slow" — this bounds
// concurrency instead of firing them all at once, which would risk Gmail's
// per-user rate limit.
const MESSAGE_FETCH_CONCURRENCY = 4

export async function fetchMessages(accessToken: string, ids: string[]): Promise<Map<string, FetchedMessage>> {
  const results = new Map<string, FetchedMessage>()
  let nextIndex = 0
  async function worker() {
    while (nextIndex < ids.length) {
      const id = ids[nextIndex++]
      results.set(id, await getFullMessage(accessToken, id))
    }
  }
  await Promise.all(Array.from({ length: Math.min(MESSAGE_FETCH_CONCURRENCY, ids.length) }, worker))
  return results
}

