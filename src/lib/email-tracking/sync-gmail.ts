import 'server-only'
import { prisma } from '@/lib/prisma'
import { classifyInboundEmail, classifyOutboundEmail } from './classify-email'
import { matchResumeShared, isLikelyBulkOrPromotional } from './ats-patterns'
import { matchRecruiterRoleMention, matchHiringManagerRoleMention, matchCoachRoleMention } from '@/lib/text/recruiter-role'
import { extractEmailAddress, extractDisplayName, extractDomain, normalizeMailboxIdentity } from './email-address'
import { ATS_AND_JOB_BOARD_DOMAINS, NEXTCHAPTER_SENDING_DOMAINS } from '@/lib/text/email-domain'
import { upsertContactFromSignal } from '@/lib/network/upsert-contact-from-signal'
import { syncJobPostingFromEmail } from './sync-job-postings'
import { autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { captureServerEvent } from '@/lib/posthog/server'
import { markInterimMarketplaceSignupCore } from '@/lib/interim-work/mark-signup'
import { getInterimListingDomainMap } from '@/lib/interim-work/listings'
import { trackPlatformEmail } from '@/lib/platforms/track'
import { GMAIL_API, ensureFreshAccessToken, isRetryable, fetchMessages, extractBodyPreview, type FetchedMessage } from './gmail-api'
import { platformsForSenderDomain } from '@/lib/platforms/directory'
import { getAttachmentFilenames, getHeader } from '@/lib/google/gmail-body'
import type { EmailConnection, EmailDirection, RelationshipTag } from '@prisma/client'

const THROTTLE_MS = 5 * 60 * 1000 // don't re-sync more than once per 5 minutes
// messages.list without a `q` filter returns each label's most recent N —
// so on an active inbox, an old message can get pushed out of that window
// by newer mail between syncs and never be fetched at all (this is how a
// real application confirmation went permanently unseen — not misclassified,
// never even reached the classifier). Fixed by bounding every fetch with
// `q=after:<date>` anchored to the last successful sync (or, for a brand
// new connection, a fixed backfill window) and paginating within that
// window instead of relying on a flat maxResults cap.
const MESSAGES_PAGE_SIZE = 500
// The sync walks forward from its bookmark one day at a time and only
// moves the bookmark past a day once every message in it was fetched and
// processed. It used to list the newest 1,000 messages per label and then
// set the bookmark to "now" — on a mailbox receiving ~130 messages a day,
// everything older than the newest 1,000 was skipped for good (63% of one
// real inbox since July, including most of its rejection emails).
const SLICE_MS = 24 * 60 * 60 * 1000
// Per run, so a page-visit sync stays well inside its time limit; a mailbox
// that's behind catches up over successive runs instead of timing out.
const MAX_MESSAGES_PER_SYNC = 400
const POINTS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const FIRST_SYNC_BACKFILL_MS = 90 * 24 * 60 * 60 * 1000 // 90 days
// Gmail's `after:` filter is date-granularity, not time-of-day — back off an
// extra day from the true cutoff so a message from earlier the same day as
// the last sync is never dropped by rounding. Reprocessing overlap is free:
// the per-message dedup (existingIds check below) skips anything already
// tracked.
const QUERY_OVERLAP_MS = 24 * 60 * 60 * 1000
async function listMessageIds(
  accessToken: string,
  labelId: 'INBOX' | 'SENT',
  afterUnixSeconds: number,
  beforeUnixSeconds: number,
): Promise<string[] | null> {
  const ids: string[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      labelIds: labelId,
      maxResults: String(MESSAGES_PAGE_SIZE),
      q: `after:${afterUnixSeconds} before:${beforeUnixSeconds}`,
    })
    if (pageToken) params.set('pageToken', pageToken)
    const url = `${GMAIL_API}/messages?${params.toString()}`
    let response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    for (let attempt = 1; attempt <= 4 && (await isRetryable(response)); attempt++) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt))
      response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
    }
    if (!response.ok) {
      // An incomplete list must not be mistaken for a complete one — the
      // caller keeps its bookmark where it was and tries this day again.
      console.error(`Gmail messages.list (${labelId}) failed: ${response.status} ${await response.text()}`)
      return null
    }
    const data = (await response.json()) as { messages?: { id: string }[]; nextPageToken?: string }
    ids.push(...(data.messages ?? []).map((m) => m.id))
    pageToken = data.nextPageToken
  } while (pageToken)
  return ids
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
  messageId: string,
  fetched: FetchedMessage,
  direction: EmailDirection,
  workHistoryCompanies: string[],
  registeredAt: Date | null,
  interimListingDomainMap: Map<string, { id: string; name: string }>
): Promise<ProcessResult> {
  const { message, insufficientScope } = fetched
  if (insufficientScope) return 'insufficient_scope'
  if (!message) return 'skipped'

  const threadId = message.threadId ?? null
  const subject = getHeader(message.payload?.headers, 'Subject')
  const from = getHeader(message.payload?.headers, 'From')
  const to = getHeader(message.payload?.headers, 'To')
  const bodyPreview = extractBodyPreview(message.payload)
  const attachmentFilenames = getAttachmentFilenames(message.payload)
  const dateHeader = getHeader(message.payload?.headers, 'Date')
  const parsedDate = dateHeader ? new Date(dateHeader) : null
  const emailDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : new Date()

  const listUnsubscribe = getHeader(message.payload?.headers, 'List-Unsubscribe')

  // Real activity from before this candidate had an account still belongs
  // in the tracker (see syncJobPostingFromEmail's own record-keeping below),
  // but never earns this week's Search Action points — see registeredAt's
  // definition in syncGmailConnection for why.
  // ...and never for mail more than a week old: the sync can reach mail
  // late (a reconnect after an expired token, a catch-up after a backlog),
  // and a month-old email arriving today must not count toward this week.
  const awardPoints = (!registeredAt || emailDate >= registeredAt) && Date.now() - emailDate.getTime() < POINTS_WINDOW_MS

  // The connected mailbox emailing itself — a personal daily-planner/digest
  // tool sending "from" the same account it was granted access to, a "+tag"
  // alias, etc. connectedEmail is only populated from the OAuth callback
  // going forward (see EmailConnection.connectedEmail), so this is a no-op
  // for connections that predate it rather than a false exclusion.
  const isSelfAddressed =
    direction === 'INBOUND' &&
    !!connection.connectedEmail &&
    normalizeMailboxIdentity(from) === normalizeMailboxIdentity(connection.connectedEmail)

  const classification =
    direction === 'INBOUND'
      ? classifyInboundEmail(subject, bodyPreview, from, !!listUnsubscribe, isSelfAddressed)
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
  // NextChapter's own transactional/admin mail (a recruiter digest, an
  // offer-bonus nudge, etc.) can land in a candidate's own connected inbox —
  // e.g. their Gmail is also a recruiter account's work email — and its
  // boilerplate copy routinely name-drops "recruiter" without one ever
  // actually contacting them. Never a real person, so this is skipped the
  // same way ATS/job-board bulk mail already is.
  const isFromNextChapterItself = direction === 'INBOUND' && !!senderRootDomain && NEXTCHAPTER_SENDING_DOMAINS.has(senderRootDomain)
  // Bulk/cold-outreach senders (deal-flow blasts, recruiting-adjacent
  // newsletters, lead-gen mail) route their own boilerplate through the same
  // "recruiting"/"talent"/"search firm" vocabulary a real recruiter uses,
  // which used to let them straight through: this check only ever gated the
  // RECRUITER_OUTREACH classification path (see classify-email.ts), not the
  // separate role-title-mention path below, so a mass "138 Social Impact
  // Jobs are Live" or "New Off-Market Businesses For Sale" blast could still
  // get flagged isRecruiterContact and land on the candidate's follow-up
  // list as if it were a real person.
  const isBulk = direction === 'INBOUND' && isLikelyBulkOrPromotional(subject, bodyPreview, from, !!listUnsubscribe)
  const skipRoleMatching = isFromAtsOrJobBoard || isFromNextChapterItself || isBulk || isSelfAddressed
  const roleText = `${subject} ${bodyPreview}`
  const isRecruiterRoleMention = !skipRoleMatching && matchRecruiterRoleMention(roleText)
  const isHiringManagerContact = !skipRoleMatching && matchHiringManagerRoleMention(roleText)
  const isCoachContact = !skipRoleMatching && matchCoachRoleMention(roleText)
  // !skipRoleMatching excludes ATS/job-board and NextChapter's own domains —
  // without it, an automated LinkedIn notification ("New message from X on
  // LinkedIn") classifies as RECRUITER_OUTREACH and gets treated as a real
  // recruiter contact. Gated to high confidence so a NEEDS_REVIEW guess
  // doesn't count toward the "Recruiter contact" stat either.
  const isRecruiterOutreach =
    direction === 'INBOUND' &&
    !skipRoleMatching &&
    classification.activityType === 'RECRUITER_OUTREACH' &&
    classification.confidence === 'high'
  // A message can be recognized as recruiter outreach by content (the
  // regex patterns above — "confidential search", "representing a client",
  // etc.) without ever mentioning a role title like "recruiter" in the
  // text, so isRecruiterRoleMention alone under-counts. Either signal
  // qualifies.
  const isRecruiterContact = isRecruiterRoleMention || isRecruiterOutreach

  await prisma.trackedEmailActivity.create({
    data: {
      candidateId: connection.candidateId,
      connectionId: connection.id,
      externalMessageId: messageId,
      threadId,
      direction,
      // When the email arrived, not when it was synced — a catch-up of
      // months-old mail must not look like this week's activity.
      detectedAt: emailDate,
      activityType: classification.activityType,
      confidence: classification.confidence,
      companyName: classification.companyName,
      subject,
      fromAddress: direction === 'INBOUND' ? from : to,
      hasResumeAttachment: resumeShared,
      isRecruiterContact,
      matchedRule: classification.rule?.slice(0, 300) ?? null,
    },
  })

  // Anyone the app already labels a recruiter, hiring manager, coach, or
  // networking contact belongs in the candidate's network list too, not
  // just visible as a tracked email row — same "don't guess" bar as the
  // points below: only high-confidence classifications, so a NEEDS_REVIEW
  // guess never creates a noise contact.
  if (classification.confidence === 'high') {
    const isNetworkingOutbound = direction === 'OUTBOUND' && NETWORKING_EMAIL_TYPES.has(classification.activityType)
    const autoTags: RelationshipTag[] = []
    if (isRecruiterContact) autoTags.push('RECRUITER')
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

  // "How did you reach out?" auto-fills to Emailed the moment the candidate
  // emails someone already on their Contact Directory — no separate "Log
  // email" click needed, same philosophy as JOB_APPLICATION_SUBMITTED etc.
  // being detected rather than self-reported. Independent of the
  // classification/confidence above: any outbound email to a tracked
  // contact counts, not just ones that happen to match a networking pattern.
  if (direction === 'OUTBOUND') {
    const recipientEmail = extractEmailAddress(to).toLowerCase()
    if (recipientEmail.includes('@')) {
      // Same OR-both-fields match as upsertContactFromSignal — a contact
      // known only by a 2nd/3rd address (see SupportNetworkContact.emails'
      // own schema comment) was matching neither the primary `email` column
      // nor being auto-logged here.
      const matchedContact = await prisma.supportNetworkContact.findFirst({
        where: { candidateId: connection.candidateId, OR: [{ email: recipientEmail }, { emails: { has: recipientEmail } }] },
      })
      if (matchedContact) {
        await prisma.outreachLog
          .create({ data: { candidateId: connection.candidateId, contactId: matchedContact.id, channel: 'EMAIL' } })
          .catch((error) => console.error('Failed to auto-log email outreach:', error))
      }
    }
  }

  // Fractional work platforms and learning providers (src/lib/platforms/):
  // mail from a directory platform's own domain moves the candidate to the
  // furthest stage it proves — signed up, accepted, working, enrolled,
  // completed — and awards that milestone's badge and points once.
  // Independent of the primary classification above.
  const senderDomain = direction === 'INBOUND' ? extractDomain(from)?.toLowerCase() ?? null : null
  if (senderDomain) {
    await trackPlatformEmail(
      connection.candidateId,
      { messageId, senderDomain, from, subject, body: bodyPreview, hasListUnsubscribe: !!listUnsubscribe, emailDate },
      {
        awardPoints,
        notify: awardPoints,
        interimListingDomainMap,
        ownDomain: connection.connectedEmail ? extractDomain(connection.connectedEmail)?.toLowerCase() ?? null : null,
      },
    ).catch((error) => console.error('Failed to track platform email:', error))

    // A listing an admin added whose domain isn't in the directory yet:
    // any mail from it still ticks "I created a profile".
    const matchedListing = senderRootDomain ? interimListingDomainMap.get(senderRootDomain) : undefined
    if (matchedListing && platformsForSenderDomain(senderDomain).length === 0) {
      await markInterimMarketplaceSignupCore(connection.candidateId, matchedListing.id, 'GMAIL_DETECTED', { awardPoints })
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
      bodyPreview,
      emailDate,
      awardPoints
    ).catch((error) => console.error('Failed to sync job posting from email:', error))
  }

  // Points only for high-confidence Sent-folder categories — never for
  // NEEDS_REVIEW (don't guess), never for Inbox categories (those aren't a
  // candidate action, so nothing to award) — and never for mail sent
  // before this candidate registered (see awardPoints above).
  if (direction === 'OUTBOUND' && classification.confidence === 'high' && awardPoints) {
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

export async function syncGmailConnection(
  connectionId: string,
  options: { maxMessages?: number; ignoreThrottle?: boolean; deadline?: number } = {},
): Promise<{ synced: number; caughtUp?: boolean } | null> {
  const connection = await prisma.emailConnection.findUnique({ where: { id: connectionId } })
  if (!connection || connection.disconnectedAt) return null

  if (!options.ignoreThrottle && connection.lastSyncAt && Date.now() - connection.lastSyncAt.getTime() < THROTTLE_MS) {
    return { synced: 0 }
  }

  const accessToken = await ensureFreshAccessToken(connection)
  if (!accessToken) return null

  // Fetched once per sync, not once per message — feeds the FORMER_COLLEAGUE
  // auto-tag when an auto-added contact's email domain matches a past
  // employer (same pattern as sync-google-calendar.ts). interimListingDomainMap
  // is the same "once per sync" treatment for Interim Work registration
  // detection below.
  const [workHistory, candidate, interimListingDomainMap] = await Promise.all([
    prisma.workHistoryEntry.findMany({
      where: { candidateId: connection.candidateId },
      select: { companyName: true },
    }),
    prisma.candidateProfile.findUnique({
      where: { id: connection.candidateId },
      select: { registrationCompletedAt: true },
    }),
    getInterimListingDomainMap(),
  ])
  const workHistoryCompanies = workHistory.map((w) => w.companyName)
  // A first-ever sync backfills up to FIRST_SYNC_BACKFILL_MS of history into
  // the tracker (real signal worth keeping), but that history predates the
  // candidate ever having a real account — Search Action points are a
  // WEEKLY, "did you do something this week" measure, so backfilled mail
  // from before registration should sync into My Applications/the outreach
  // log without also inflating whatever week it lands in. Falls back to
  // "no floor" only for the pathological case of a null registration date.
  const registeredAt = candidate?.registrationCompletedAt ?? null

  // lastSyncAt is the bookmark: every message before it has been fetched
  // and processed. Walk forward a day at a time; a day only counts as done
  // once its full list came back and every new message in it was fetched.
  let cursor = connection.lastSyncAt ?? new Date(Date.now() - FIRST_SYNC_BACKFILL_MS)
  let synced = 0
  let budget = options.maxMessages ?? MAX_MESSAGES_PER_SYNC
  let scopeInsufficient = false
  let daysDone = 0

  while (cursor.getTime() < Date.now() && !scopeInsufficient) {
    const sliceEnd = new Date(Math.min(cursor.getTime() + SLICE_MS, Date.now()))
    // Gmail's after:/before: are date-granular — overlap a day back so
    // nothing near a boundary is dropped; already-tracked ids are skipped.
    const after = Math.floor((cursor.getTime() - QUERY_OVERLAP_MS) / 1000)
    const before = Math.floor((sliceEnd.getTime() + QUERY_OVERLAP_MS) / 1000)
    const [inboxIds, sentIds] = await Promise.all([
      listMessageIds(accessToken, 'INBOX', after, before),
      listMessageIds(accessToken, 'SENT', after, before),
    ])
    if (!inboxIds || !sentIds) break

    const allIds = [...inboxIds, ...sentIds]
    const existing = await prisma.trackedEmailActivity.findMany({
      where: { connectionId: connection.id, externalMessageId: { in: allIds } },
      select: { externalMessageId: true },
    })
    const existingIds = new Set(existing.map((e) => e.externalMessageId))
    const newInboxIds = inboxIds.filter((id) => !existingIds.has(id))
    const newSentIds = sentIds.filter((id) => !existingIds.has(id))
    // Out of budget for this run: stop before the day, leave the bookmark,
    // and pick up here next time rather than half-processing it. The first
    // day of a run is always processed, however large, so one very busy
    // day can never stall the mailbox.
    const newCount = newInboxIds.length + newSentIds.length
    if (newCount > budget && daysDone > 0) break
    budget -= newCount

    // Fetching is bounded-concurrency (see fetchMessages) since it's pure
    // network I/O with no shared state. Persisting stays sequential (not
    // Promise.all) on purpose: autoCompleteEngagementAction does a
    // read-modify-write on the sprint's committedActions JSON blob, and
    // running two of those concurrently for different action types can
    // silently lose one's completion to the other's overwrite.
    const [inboxFetched, sentFetched] = await Promise.all([
      fetchMessages(accessToken, newInboxIds),
      fetchMessages(accessToken, newSentIds),
    ])

    let sliceComplete = true
    for (const [ids, fetchedMap, direction] of [
      [newInboxIds, inboxFetched, 'INBOUND'],
      [newSentIds, sentFetched, 'OUTBOUND'],
    ] as const) {
      for (const id of ids) {
        if (scopeInsufficient) break
        try {
          const fetched = fetchedMap.get(id)
          if (!fetched?.message) {
            if (fetched?.insufficientScope) scopeInsufficient = true
            else if (fetched?.temporary !== false) sliceComplete = false // still rate-limited — try this day again next run
            // a permanent failure (deleted message) is skipped, never allowed to stall the mailbox
            continue
          }
          const result = await processMessage(connection, id, fetched, direction, workHistoryCompanies, registeredAt, interimListingDomainMap)
          if (result === 'insufficient_scope') scopeInsufficient = true
          else if (result === 'synced') synced++
        } catch (error) {
          // One malformed message must not stall the whole mailbox forever;
          // it's logged and the day still completes.
          console.error(`Failed to process ${direction.toLowerCase()} message ${id}:`, error)
        }
      }
    }
    if (!sliceComplete || scopeInsufficient) break
    cursor = sliceEnd
    daysDone++
    await prisma.emailConnection.update({ where: { id: connection.id }, data: { lastSyncAt: cursor } })
    if (budget <= 0 || (options.deadline && Date.now() > options.deadline)) break
  }

  // A token issued under the old gmail.metadata scope 403s on the new
  // format=full fetch — that's a real reconnect, not a transient error, so
  // it gets the same candidate-facing prompt as an expired token rather
  // than silently retrying forever.
  if (scopeInsufficient) {
    await prisma.emailConnection.update({ where: { id: connection.id }, data: { needsReconnectAt: new Date() } })
  }
  return { synced, caughtUp: cursor.getTime() >= Date.now() - 60_000 }
}
