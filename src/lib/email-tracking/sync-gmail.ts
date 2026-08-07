import 'server-only'
import { prisma } from '@/lib/prisma'
import { refreshAccessToken } from './gmail-oauth'
import { classifyInboundEmail, classifyOutboundEmail } from './classify-email'
import { matchResumeShared } from './ats-patterns'
import { matchRecruiterRoleMention, matchHiringManagerRoleMention, matchCoachRoleMention } from '@/lib/text/recruiter-role'
import { extractEmailAddress, extractDisplayName, extractDomain } from './email-address'
import { ATS_AND_JOB_BOARD_DOMAINS } from '@/lib/text/email-domain'
import { upsertContactFromSignal } from '@/lib/network/upsert-contact-from-signal'
import { syncJobPostingFromEmail } from './sync-job-postings'
import { autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { captureServerEvent } from '@/lib/posthog/server'
import type { EmailConnection, EmailDirection, RelationshipTag } from '@prisma/client'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'
const THROTTLE_MS = 5 * 60 * 1000 // don't re-sync more than once per 5 minutes
// Per-label cap instead of a date-range query — kept simple even though
// gmail.readonly (unlike the old gmail.metadata scope) does support the `q`
// search parameter now. messages.list without `q` returns each label
// newest-first, so capping maxResults already gives "the most recent N per
// folder"; the existing per-message dedup below (skip if already tracked)
// keeps repeat syncs cheap without needing a time window.
const MAX_MESSAGES_PER_LABEL = 50
// Body text is only used for regex keyword matching, never stored — cap it
// well past any realistic phrase-matching need so a huge email can't blow
// up regex evaluation time.
const BODY_PREVIEW_MAX_CHARS = 4000

interface GmailHeader {
  name: string
  value: string
}
interface GmailPart {
  mimeType?: string
  filename?: string
  body?: { data?: string }
  parts?: GmailPart[]
}
interface GmailMessage {
  id: string
  payload?: { headers?: GmailHeader[] } & GmailPart
}

// Gmail nests the actual text/plain part arbitrarily deep inside
// multipart/alternative and multipart/mixed containers — walk until one is
// found. Depth-capped defensively; real messages never nest this deep.
function extractBodyPreview(part: GmailPart | undefined, depth = 0): string {
  if (!part || depth > 8) return ''
  if (part.mimeType === 'text/plain' && part.body?.data) {
    try {
      return Buffer.from(part.body.data, 'base64url').toString('utf-8').slice(0, BODY_PREVIEW_MAX_CHARS)
    } catch {
      return ''
    }
  }
  for (const sub of part.parts ?? []) {
    const found = extractBodyPreview(sub, depth + 1)
    if (found) return found
  }
  return ''
}

// A part with a non-empty filename is an attachment (Gmail's convention —
// the inline body parts never carry one). Collects filenames (not content)
// so callers can pattern-match on how the file itself is named, e.g.
// "Jane_Doe_Resume.pdf", not just whether something was attached.
function getAttachmentFilenames(part: GmailPart | undefined, depth = 0): string[] {
  if (!part || depth > 8) return []
  const own = part.filename ? [part.filename] : []
  return own.concat((part.parts ?? []).flatMap((sub) => getAttachmentFilenames(sub, depth + 1)))
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

// format=full (not metadata) so classification can read the body and check
// for attachments — see gmail-oauth.ts for the gmail.readonly scope this
// requires. insufficientScope distinguishes "this token predates the scope
// upgrade" (needs a real reconnect) from an ordinary transient failure.
async function getFullMessage(
  accessToken: string,
  id: string
): Promise<{ message: GmailMessage | null; insufficientScope: boolean }> {
  const url = `${GMAIL_API}/messages/${id}?format=full`
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (response.status === 403) return { message: null, insufficientScope: true }
  if (!response.ok) return { message: null, insufficientScope: false }
  return { message: await response.json(), insufficientScope: false }
}

const SENT_ACTION_TYPE_BY_ACTIVITY: Partial<Record<string, string>> = {
  THANK_YOU: 'THANK_YOU_NOTE_SENT',
  FOLLOW_UP: 'FOLLOW_UP_NOTE_SENT',
  CHECK_IN: 'CHECK_IN_NOTE_SENT',
  INTRO_REQUEST: 'INTRO_CONNECTION_REQUEST_SENT',
  // Maps to the same OUTREACH_MESSAGE type the "Reach out to one more
  // person" Sprint item uses, so a detected cold outreach completes that
  // exact row instead of only ever showing up as a separate tracked email.
  NETWORKING_OUTREACH: 'OUTREACH_MESSAGE',
}

// Outbound categories that mean "I'm networking with this specific person" —
// mirrors the set network/page.tsx uses for its own networking-email stat.
const NETWORKING_EMAIL_TYPES = new Set(['THANK_YOU', 'FOLLOW_UP', 'CHECK_IN', 'INTRO_REQUEST', 'NETWORKING_OUTREACH'])

type ProcessResult = 'synced' | 'skipped' | 'insufficient_scope'

async function processMessage(
  connection: EmailConnection,
  accessToken: string,
  messageId: string,
  direction: EmailDirection,
  workHistoryCompanies: string[]
): Promise<ProcessResult> {
  const { message, insufficientScope } = await getFullMessage(accessToken, messageId)
  if (insufficientScope) return 'insufficient_scope'
  if (!message) return 'skipped'

  const subject = getHeader(message.payload?.headers, 'Subject')
  const from = getHeader(message.payload?.headers, 'From')
  const to = getHeader(message.payload?.headers, 'To')
  const bodyPreview = extractBodyPreview(message.payload)
  const attachmentFilenames = getAttachmentFilenames(message.payload)
  const dateHeader = getHeader(message.payload?.headers, 'Date')
  const parsedDate = dateHeader ? new Date(dateHeader) : null
  const emailDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : new Date()

  const classification =
    direction === 'INBOUND'
      ? classifyInboundEmail(subject, bodyPreview, from)
      : classifyOutboundEmail(subject, bodyPreview, to)

  // Resume-sharing is tracked independently of the primary category — a
  // "sending you my resume" email might otherwise classify as a follow-up,
  // thank-you, or nothing at all, but should still count toward the stat.
  const resumeShared = direction === 'OUTBOUND' && matchResumeShared(subject, bodyPreview, attachmentFilenames)

  // Same independence for recruiter/hiring-manager/coach contact — a
  // role-title mention ("Senior Technical Recruiter", "Hiring Manager",
  // "Career Coach") is a real signal regardless of which direction the
  // email went or how the primary category above classified the message.
  // Skipped entirely for inbound mail from an ATS/job-board's own domain —
  // those are bulk automated notifications (job-posting tips, listing
  // expiration reminders), not a real person, and their boilerplate copy
  // routinely name-drops "recruiter" without one ever being on the email.
  const senderRootDomain = extractDomain(from)?.split('.').slice(-2).join('.') ?? null
  const isFromAtsOrJobBoard = direction === 'INBOUND' && !!senderRootDomain && ATS_AND_JOB_BOARD_DOMAINS.has(senderRootDomain)
  const roleText = `${subject} ${bodyPreview}`
  const isRecruiterContact = !isFromAtsOrJobBoard && matchRecruiterRoleMention(roleText)
  const isHiringManagerContact = !isFromAtsOrJobBoard && matchHiringManagerRoleMention(roleText)
  const isCoachContact = !isFromAtsOrJobBoard && matchCoachRoleMention(roleText)

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
      hasResumeAttachment: resumeShared,
      isRecruiterContact,
    },
  })

  // Anyone the app already labels a recruiter, hiring manager, coach, or
  // networking contact belongs in the candidate's network list too, not
  // just visible as a tracked email row — same "don't guess" bar as the
  // points below: only high-confidence classifications, so a NEEDS_REVIEW
  // guess never creates a noise contact.
  if (classification.confidence === 'high') {
    const isRecruiterOutreach = direction === 'INBOUND' && classification.activityType === 'RECRUITER_OUTREACH'
    const isNetworkingOutbound = direction === 'OUTBOUND' && NETWORKING_EMAIL_TYPES.has(classification.activityType)
    const autoTags: RelationshipTag[] = []
    if (isRecruiterOutreach || isRecruiterContact) autoTags.push('RECRUITER')
    if (isHiringManagerContact) autoTags.push('HIRING_MANAGER')
    if (isCoachContact) autoTags.push('COACH')
    if (autoTags.length > 0 || isNetworkingOutbound) {
      const counterpartHeader = direction === 'INBOUND' ? from : to
      const email = extractEmailAddress(counterpartHeader)
      if (email.includes('@')) {
        await upsertContactFromSignal(connection.candidateId, {
          email,
          name: extractDisplayName(counterpartHeader),
          source: 'EMAIL_DETECTED',
          autoTags,
          workHistoryCompanies,
        }).catch((error) => console.error('Failed to auto-add email contact to network list:', error))
      }
    }
  }

  // Mirrors application confirmations/interview invites/rejections into the
  // candidate's My Applications list — see sync-job-postings.ts. Only for
  // high-confidence inbound mail, same bar as point-awarding below.
  if (direction === 'INBOUND' && classification.confidence === 'high') {
    await syncJobPostingFromEmail(
      connection.candidateId,
      classification.activityType,
      classification.companyName,
      subject,
      emailDate
    ).catch((error) => console.error('Failed to sync job posting from email:', error))
  }

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
    hasResumeAttachment: resumeShared,
    isRecruiterContact,
  })

  return 'synced'
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
    case 'NETWORKING_OUTREACH':
      return 'Sent a networking outreach message'
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

  // A single batched existence check replaces up to 100 sequential
  // findUnique round trips — most syncs (this runs on every page visit)
  // see zero or a handful of genuinely new messages out of the ~100 most
  // recent IDs fetched per label, so this collapses the common case from
  // ~100 DB round trips to 1, which is what made a real send take multiple
  // refreshes to show up (the sync was slow enough that it got deferred
  // off the request path, so the first refresh after sending still saw
  // last-sync's data).
  const allIds = [...inboxIds, ...sentIds]
  const existing = await prisma.trackedEmailActivity.findMany({
    where: { connectionId: connection.id, externalMessageId: { in: allIds } },
    select: { externalMessageId: true },
  })
  const existingIds = new Set(existing.map((e) => e.externalMessageId))
  const newInboxIds = inboxIds.filter((id) => !existingIds.has(id))
  const newSentIds = sentIds.filter((id) => !existingIds.has(id))

  // Fetched once per sync, not once per message — feeds the FORMER_COLLEAGUE
  // auto-tag when an auto-added contact's email domain matches a past
  // employer (same pattern as sync-google-calendar.ts).
  const workHistory = await prisma.workHistoryEntry.findMany({
    where: { candidateId: connection.candidateId },
    select: { companyName: true },
  })
  const workHistoryCompanies = workHistory.map((w) => w.companyName)

  // Only genuinely new messages ever reach the Gmail API now. Kept
  // sequential (not Promise.all) on purpose: autoCompleteEngagementAction
  // does a read-modify-write on the sprint's committedActions JSON blob,
  // and running two of these concurrently for different action types can
  // silently lose one's completion to the other's overwrite.
  let synced = 0
  let scopeInsufficient = false
  for (const id of newInboxIds) {
    if (scopeInsufficient) break
    const result = await processMessage(connection, accessToken, id, 'INBOUND', workHistoryCompanies)
    if (result === 'insufficient_scope') scopeInsufficient = true
    else if (result === 'synced') synced++
  }
  for (const id of newSentIds) {
    if (scopeInsufficient) break
    const result = await processMessage(connection, accessToken, id, 'OUTBOUND', workHistoryCompanies)
    if (result === 'insufficient_scope') scopeInsufficient = true
    else if (result === 'synced') synced++
  }

  // A token issued under the old gmail.metadata scope 403s on the new
  // format=full fetch — that's a real reconnect, not a transient error, so
  // it gets the same candidate-facing prompt as an expired token rather
  // than silently retrying forever.
  if (scopeInsufficient) {
    await prisma.emailConnection.update({ where: { id: connection.id }, data: { needsReconnectAt: new Date() } })
    return { synced }
  }

  await prisma.emailConnection.update({ where: { id: connection.id }, data: { lastSyncAt: new Date() } })
  return { synced }
}
