import 'server-only'
import { prisma } from '@/lib/prisma'
import { GMAIL_API, ensureFreshAccessToken, fetchMessages, isRetryable, extractBodyPreview } from '@/lib/email-tracking/gmail-api'
import { extractDomain } from '@/lib/email-tracking/email-address'
import { getInterimListingDomainMap } from '@/lib/interim-work/listings'
import { getHeader } from '@/lib/google/gmail-body'
import { PLATFORM_DIRECTORY } from './directory'
import { trackPlatformEmail } from './track'
import { captureServerEvent } from '@/lib/posthog/server'

const POINTS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
// Shared domains (linkedin.com, a university) send far more unrelated mail
// than platform mail — search them only for learning/work wording.
const GATED_SUBJECT_TERMS = ['course', 'certificate', 'certification', 'certified', 'enrolled', 'enrollment', 'registration', 'exam', 'training', 'program', 'badge', 'completed', 'learning', 'welcome', 'interim', 'project', 'advance', 'workforce', 'apprenticeship']

/** Gmail search queries covering every directory domain, in chunks. */
export function buildPlatformSearchQueries(days: number): string[] {
  const dedicated = new Set<string>()
  const gated = new Set<string>()
  for (const p of PLATFORM_DIRECTORY) {
    for (const d of p.domains) (p.gate ? gated : dedicated).add(d)
  }
  for (const d of dedicated) gated.delete(d)
  const window = `newer_than:${days}d`
  const queries: string[] = []
  const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))
  for (const group of chunk([...dedicated], 40)) queries.push(`from:(${group.join(' OR ')}) ${window}`)
  const subjects = `{${GATED_SUBJECT_TERMS.map((t) => `subject:${t}`).join(' ')}}`
  for (const group of chunk([...gated], 20)) queries.push(`from:(${group.join(' OR ')}) ${subjects} ${window}`)
  return queries
}

async function searchIds(accessToken: string, q: string, cap: number): Promise<string[] | null> {
  const ids: string[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({ q, maxResults: '500' })
    if (pageToken) params.set('pageToken', pageToken)
    const url = `${GMAIL_API}/messages?${params}`
    let res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    for (let attempt = 1; attempt <= 4 && (await isRetryable(res)); attempt++) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt))
      res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    }
    if (!res.ok) {
      console.error(`Gmail search failed (${res.status}): ${await res.text()}`)
      return null
    }
    const data = (await res.json()) as { messages?: { id: string }[]; nextPageToken?: string }
    ids.push(...(data.messages ?? []).map((m) => m.id))
    pageToken = data.nextPageToken
  } while (pageToken && ids.length < cap)
  return ids
}

/**
 * Re-reads a connected inbox's platform mail (only mail from directory
 * domains) so a candidate who connected Gmail before platform tracking
 * existed gets their history. The hourly sync covers everything after.
 * Idempotent — events are keyed by message id. Old mail earns badges
 * silently and no points; mail from the last week is treated like the
 * live sync treats it.
 */
export async function backfillPlatformsForConnection(
  connectionId: string,
  { days = 365, maxMessages = 600 }: { days?: number; maxMessages?: number } = {},
): Promise<{ scanned: number; tracked: number } | null> {
  const connection = await prisma.emailConnection.findUnique({ where: { id: connectionId } })
  if (!connection || connection.disconnectedAt) return null
  const accessToken = await ensureFreshAccessToken(connection)
  if (!accessToken) return null

  const [candidate, interimListingDomainMap, seen] = await Promise.all([
    prisma.candidateProfile.findUnique({ where: { id: connection.candidateId }, select: { registrationCompletedAt: true } }),
    getInterimListingDomainMap(),
    prisma.candidatePlatformEvent.findMany({ where: { candidateId: connection.candidateId }, select: { externalMessageId: true } }),
  ])
  const seenIds = new Set(seen.map((s) => s.externalMessageId))

  const ids = new Set<string>()
  for (const q of buildPlatformSearchQueries(days)) {
    const found = await searchIds(accessToken, q, maxMessages)
    if (!found) continue
    for (const id of found) if (!seenIds.has(id)) ids.add(id)
    if (ids.size >= maxMessages) break
  }

  const fetched = await fetchMessages(accessToken, [...ids].slice(0, maxMessages))
  const messages = [...fetched.entries()]
    .flatMap(([id, f]) => (f.message ? [{ id, message: f.message }] : []))
    .map(({ id, message }) => {
      const dateHeader = getHeader(message.payload?.headers, 'Date')
      const parsed = dateHeader ? new Date(dateHeader) : null
      const emailDate = parsed && !isNaN(parsed.getTime()) ? parsed : new Date(Number(message.internalDate ?? Date.now()))
      return { id, message, emailDate }
    })
    .sort((a, b) => a.emailDate.getTime() - b.emailDate.getTime())

  const ownDomain = connection.connectedEmail ? extractDomain(connection.connectedEmail)?.toLowerCase() ?? null : null
  const registeredAt = candidate?.registrationCompletedAt ?? null
  let tracked = 0
  for (const { id, message, emailDate } of messages) {
    const from = getHeader(message.payload?.headers, 'From')
    const senderDomain = extractDomain(from)?.toLowerCase()
    if (!senderDomain) continue
    const recent = (!registeredAt || emailDate >= registeredAt) && Date.now() - emailDate.getTime() < POINTS_WINDOW_MS
    try {
      const result = await trackPlatformEmail(
        connection.candidateId,
        {
          messageId: id,
          senderDomain,
          from,
          subject: getHeader(message.payload?.headers, 'Subject'),
          body: extractBodyPreview(message.payload),
          hasListUnsubscribe: !!getHeader(message.payload?.headers, 'List-Unsubscribe'),
          emailDate,
        },
        { awardPoints: recent, notify: recent, interimListingDomainMap, ownDomain },
      )
      if (result) tracked++
    } catch (error) {
      console.error(`Platform backfill failed on message ${id}:`, error)
    }
  }
  return { scanned: messages.length, tracked }
}

/** Runs after a Gmail connect/reconnect. Never throws. */
export async function scanPlatformHistory(candidateId: string, connectionId: string): Promise<void> {
  const started = Date.now()
  try {
    // Sized to finish inside the connect route's 300s limit alongside the
    // first inbox sync; the hourly sync handles everything newer.
    const result = await backfillPlatformsForConnection(connectionId, { days: 365, maxMessages: 600 })
    if (result) {
      const platforms = await prisma.candidatePlatformActivity.count({ where: { candidateId } })
      captureServerEvent(candidateId, 'platform_history_scanned', { ...result, platforms, ms: Date.now() - started })
    }
  } catch (error) {
    console.error('Platform history scan failed:', error)
  }
}
