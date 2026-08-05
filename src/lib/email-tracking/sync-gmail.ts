import 'server-only'
import { prisma } from '@/lib/prisma'
import { refreshAccessToken } from './gmail-oauth'
import { classifyInboundEmail, classifyOutboundEmail } from './classify-email'
import { autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { captureServerEvent } from '@/lib/posthog/server'
import type { EmailConnection, EmailDirection } from '@prisma/client'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'
const THROTTLE_MS = 5 * 60 * 1000 // don't re-sync more than once per 5 minutes
// Per-label cap instead of a date-range query — the gmail.metadata scope
// this app requests (see gmail-oauth.ts) rejects the `q` search parameter
// entirely ("Metadata scope does not support 'q' parameter", 403), so
// newer_than:/after: filtering is not available. messages.list without `q`
// returns each label newest-first, so capping maxResults already gives "the
// most recent N per folder"; the existing per-message dedup below (skip if
// already tracked) keeps repeat syncs cheap without needing a time window.
const MAX_MESSAGES_PER_LABEL = 50

interface GmailHeader {
  name: string
  value: string
}
interface GmailMessage {
  id: string
  payload?: { headers?: GmailHeader[] }
}

function getHeader(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

// Testing-mode refresh tokens expire ~7 days after issue — a refresh
// failure here is expected, not a bug. Turns into a candidate-facing
// reconnect prompt (needsReconnectAt), never a silent failure.
async function ensureFreshAccessToken(connection: EmailConnection): Promise<string | null> {
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

async function listMessageIds(accessToken: string, labelId: 'INBOX' | 'SENT'): Promise<string[]> {
  const url = `${GMAIL_API}/messages?labelIds=${labelId}&maxResults=${MAX_MESSAGES_PER_LABEL}`
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok) {
    console.error(`Gmail messages.list (${labelId}) failed: ${response.status} ${await response.text()}`)
    return []
  }
  const data = (await response.json()) as { messages?: { id: string }[] }
  return (data.messages ?? []).map((m) => m.id)
}

async function getMessageMetadata(accessToken: string, id: string): Promise<GmailMessage | null> {
  const url =
    `${GMAIL_API}/messages/${id}?format=metadata` +
    `&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!response.ok) return null
  return response.json()
}

const SENT_ACTION_TYPE_BY_ACTIVITY: Partial<Record<string, string>> = {
  THANK_YOU: 'THANK_YOU_NOTE_SENT',
  FOLLOW_UP: 'FOLLOW_UP_NOTE_SENT',
  CHECK_IN: 'CHECK_IN_NOTE_SENT',
  INTRO_REQUEST: 'INTRO_CONNECTION_REQUEST_SENT',
}

async function processMessage(
  connection: EmailConnection,
  accessToken: string,
  messageId: string,
  direction: EmailDirection
): Promise<boolean> {
  const existing = await prisma.trackedEmailActivity.findUnique({
    where: { connectionId_externalMessageId: { connectionId: connection.id, externalMessageId: messageId } },
  })
  if (existing) return false

  const message = await getMessageMetadata(accessToken, messageId)
  if (!message) return false

  const subject = getHeader(message.payload?.headers, 'Subject')
  const from = getHeader(message.payload?.headers, 'From')
  const to = getHeader(message.payload?.headers, 'To')

  const classification =
    direction === 'INBOUND' ? classifyInboundEmail(subject, '', from) : classifyOutboundEmail(subject, '', to)

  await prisma.trackedEmailActivity.create({
    data: {
      candidateId: connection.candidateId,
      connectionId: connection.id,
      externalMessageId: messageId,
      direction,
      activityType: classification.activityType,
      confidence: classification.confidence,
      companyName: classification.companyName,
      subject,
      fromAddress: direction === 'INBOUND' ? from : to,
    },
  })

  // Points only for high-confidence Sent-folder categories — never for
  // NEEDS_REVIEW (don't guess), never for Inbox categories (those aren't a
  // candidate action, so nothing to award).
  if (direction === 'OUTBOUND' && classification.confidence === 'high') {
    const actionType = SENT_ACTION_TYPE_BY_ACTIVITY[classification.activityType]
    if (actionType) {
      const effort = estimateActionEffort({ actionType })
      await autoCompleteEngagementAction(connection.candidateId, {
        actionType,
        text: sentActionLabel(classification.activityType),
        points: effort.points,
        estimatedMinutes: effort.minutes,
      }).catch((error) => console.error('Failed to auto-complete sent-email action:', error))
    }
  }

  captureServerEvent(connection.candidateId, 'email_activity_detected', {
    direction,
    activityType: classification.activityType,
    confidence: classification.confidence,
  })

  return true
}

function sentActionLabel(activityType: string): string {
  switch (activityType) {
    case 'THANK_YOU':
      return 'Sent a thank-you note'
    case 'FOLLOW_UP':
      return 'Sent a follow-up note'
    case 'CHECK_IN':
      return 'Sent a check-in note'
    case 'INTRO_REQUEST':
      return 'Asked for an introduction'
    default:
      return 'Sent a networking email'
  }
}

export async function syncGmailConnection(connectionId: string): Promise<{ synced: number } | null> {
  const connection = await prisma.emailConnection.findUnique({ where: { id: connectionId } })
  if (!connection || connection.disconnectedAt) return null

  if (connection.lastSyncAt && Date.now() - connection.lastSyncAt.getTime() < THROTTLE_MS) {
    return { synced: 0 }
  }

  const accessToken = await ensureFreshAccessToken(connection)
  if (!accessToken) return null

  const [inboxIds, sentIds] = await Promise.all([
    listMessageIds(accessToken, 'INBOX'),
    listMessageIds(accessToken, 'SENT'),
  ])

  let synced = 0
  for (const id of inboxIds) {
    if (await processMessage(connection, accessToken, id, 'INBOUND')) synced++
  }
  for (const id of sentIds) {
    if (await processMessage(connection, accessToken, id, 'OUTBOUND')) synced++
  }

  await prisma.emailConnection.update({ where: { id: connection.id }, data: { lastSyncAt: new Date() } })
  return { synced }
}
