import 'server-only'
import { prisma } from '@/lib/prisma'
import { refreshAccessToken } from './gmail-oauth'
import { classifyInboundEmail, classifyOutboundEmail } from './classify-email'
import { matchResumeShared, matchCourseCompletion, matchCourseEnrollment, isLikelyBulkOrPromotional } from './ats-patterns'
import { matchRecruiterRoleMention, matchHiringManagerRoleMention, matchCoachRoleMention } from '@/lib/text/recruiter-role'
import { extractEmailAddress, extractDisplayName, extractDomain } from './email-address'
import { ATS_AND_JOB_BOARD_DOMAINS, NEXTCHAPTER_SENDING_DOMAINS } from '@/lib/text/email-domain'
import { upsertContactFromSignal } from '@/lib/network/upsert-contact-from-signal'
import { syncJobPostingFromEmail } from './sync-job-postings'
import { autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { captureServerEvent } from '@/lib/posthog/server'
import { applyLearningClosesBarrierRewrite } from '@/lib/scoring/rewrite-actions'
import { getAllCourseTitles } from '@/lib/learning/courses'
import { markInterimMarketplaceSignupCore } from '@/lib/interim-work/mark-signup'
import { getInterimListingDomainMap } from '@/lib/interim-work/listings'
import type { EmailConnection, EmailDirection, RelationshipTag } from '@prisma/client'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'
const THROTTLE_MS = 5 * 60 * 1000 // don't re-sync more than once per 5 minutes
// messages.list without a `q` filter returns each label's most recent N —
// so on an active inbox, an old message can get pushed out of that window
// by newer mail between syncs and never be fetched at all (this is how a
// real application confirmation went permanently unseen — not misclassified,
// never even reached the classifier). Fixed by bounding every fetch with
// `q=after:<date>` anchored to the last successful sync (or, for a brand
// new connection, a fixed backfill window) and paginating within that
// window instead of relying on a flat maxResults cap.
const MESSAGES_PAGE_SIZE = 100
const MAX_PAGES_PER_LABEL = 10 // sanity bound: up to 1,000 messages/label/sync
const FIRST_SYNC_BACKFILL_MS = 90 * 24 * 60 * 60 * 1000 // 90 days
// Gmail's `after:` filter is date-granularity, not time-of-day — back off an
// extra day from the true cutoff so a message from earlier the same day as
// the last sync is never dropped by rounding. Reprocessing overlap is free:
// the per-message dedup (existingIds check below) skips anything already
// tracked.
const QUERY_OVERLAP_MS = 24 * 60 * 60 * 1000
// Body text is only used for regex keyword matching, never stored — cap it
// well past any realistic phrase-matching need so a huge email can't blow
// up regex evaluation time.
const BODY_PREVIEW_MAX_CHARS = 4000

// Course platforms whose own "congratulations, you completed X" emails are
// safe to trust — deliberately narrow (just the two platforms this app's
// catalog actually links out to) rather than reusing the broader
// ATS_AND_JOB_BOARD_DOMAINS set, which serves a different purpose.
const LEARNING_PLATFORM_DOMAINS = new Set(['coursera.org', 'edx.org'])

// Course titles are admin-editable now (the Course table), so this always
// re-fetches rather than caching across the module's lifetime — this only
// runs for the rare inbound email that already matched course-completion
// or course-enrollment phrasing from a known learning-platform domain, so
// the extra query is cheap relative to how infrequently it's called.
async function findCatalogTitleInText(text: string): Promise<string | null> {
  const catalogTitles = await getAllCourseTitles()
  const lower = text.toLowerCase()
  return catalogTitles.find((title) => lower.includes(title.toLowerCase())) ?? null
}

// The Learning page reads this to show a card's "Enrolled"/"Course
// Complete" status pill — separate from LearningBadge below, which only
// ever represents a finished achievement, never an in-progress one.
// Upserted (not created) so a later completion email can move an existing
// ENROLLED row to COMPLETED instead of leaving two conflicting rows.
async function upsertCourseActivityFromEmail(
  candidateId: string,
  title: string,
  provider: string,
  status: 'ENROLLED' | 'COMPLETED'
): Promise<void> {
  await prisma.candidateCourseActivity.upsert({
    where: { candidateId_courseTitle: { candidateId, courseTitle: title } },
    create: { candidateId, courseTitle: title, provider, status },
    // Never downgrade an already-COMPLETED row back to ENROLLED — a
    // completion email for a course also implies its enrollment email (if
    // any) is now stale information.
    update: status === 'COMPLETED' ? { status: 'COMPLETED', provider, detectedAt: new Date() } : {},
  })
}

// Creates the same LearningBadge shape a candidate's own "Mark done" click
// used to (that button is gone now — this email detection is the only path
// left), including the downstream rewrite call. Guards against duplicate
// badges since nothing upstream de-dupes.
async function markCourseCompletedFromEmail(candidateId: string, title: string, provider: string): Promise<void> {
  await upsertCourseActivityFromEmail(candidateId, title, provider, 'COMPLETED')

  const existing = await prisma.learningBadge.findFirst({
    where: { candidateId, title, badgeType: 'course_completed' },
  })
  if (existing) return

  await prisma.learningBadge.create({
    data: { candidateId, title, provider, badgeType: 'course_completed', completedAt: new Date() },
  })
  captureServerEvent(candidateId, 'learning_recommendation_completed', { title, provider, source: 'email' })
  try {
    await applyLearningClosesBarrierRewrite(candidateId)
  } catch (error) {
    console.error('Failed to apply learning-closes-barrier baseline rewrite:', error)
  }
}

// No LearningBadge/points here — enrolling isn't an achievement, just a
// status the card surfaces so a candidate can see which recommendations
// they've already started.
async function markCourseEnrolledFromEmail(candidateId: string, title: string, provider: string): Promise<void> {
  await upsertCourseActivityFromEmail(candidateId, title, provider, 'ENROLLED')
  captureServerEvent(candidateId, 'learning_course_enrolled', { title, provider, source: 'email' })
}

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
  threadId?: string
  payload?: { headers?: GmailHeader[] } & GmailPart
}

function findPartByMimeType(part: GmailPart | undefined, mimeType: string, depth = 0): string | null {
  if (!part || depth > 8) return null
  if (part.mimeType === mimeType && part.body?.data) {
    try {
      return Buffer.from(part.body.data, 'base64url').toString('utf-8')
    } catch {
      return null
    }
  }
  for (const sub of part.parts ?? []) {
    const found = findPartByMimeType(sub, mimeType, depth + 1)
    if (found) return found
  }
  return null
}

// Crude but sufficient for regex keyword matching (never stored/rendered) —
// strip tags, decode the handful of entities real ATS templates actually
// use, collapse whitespace.
function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&(lt|gt|#39|quot);/gi, (m) => ({ '&lt;': '<', '&gt;': '>', '&#39;': "'", '&quot;': '"' })[m.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

// Gmail nests the actual text/plain part arbitrarily deep inside
// multipart/alternative and multipart/mixed containers — walk until one is
// found, and always append the text/html part (stripped) too rather than
// treating it as a last resort. Some ATS confirmation templates (e.g.
// Indeed Apply's "Indeed Application: <Job Title>") put only a bare
// "application submitted, good luck!" line in text/plain and leave every
// real detail — including the company name — solely in the HTML part;
// text/plain alone silently starved every downstream regex of the one
// signal they actually needed. Depth-capped defensively; real messages
// never nest this deep.
function extractBodyPreview(part: GmailPart | undefined): string {
  const plain = findPartByMimeType(part, 'text/plain') ?? ''
  const html = findPartByMimeType(part, 'text/html')
  const combined = html ? `${plain} ${stripHtml(html)}` : plain
  return combined.slice(0, BODY_PREVIEW_MAX_CHARS)
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

async function listMessageIds(accessToken: string, labelId: 'INBOX' | 'SENT', afterUnixSeconds: number): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined
  let page = 0
  do {
    const params = new URLSearchParams({
      labelIds: labelId,
      maxResults: String(MESSAGES_PAGE_SIZE),
      q: `after:${afterUnixSeconds}`,
    })
    if (pageToken) params.set('pageToken', pageToken)
    const response = await fetch(`${GMAIL_API}/messages?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      console.error(`Gmail messages.list (${labelId}) failed: ${response.status} ${await response.text()}`)
      break
    }
    const data = (await response.json()) as { messages?: { id: string }[]; nextPageToken?: string }
    ids.push(...(data.messages ?? []).map((m) => m.id))
    pageToken = data.nextPageToken
    page++
  } while (pageToken && page < MAX_PAGES_PER_LABEL)
  return ids
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

type FetchedMessage = { message: GmailMessage | null; insufficientScope: boolean }

// Fetching each message is a standalone network round trip with no shared
// state — unlike the classify+persist step below (kept sequential because it
// writes the sprint's committedActions JSON), there's no correctness reason
// to fetch one at a time. A candidate returning after several days away
// could have 50-100+ new messages, and doing those fetches strictly
// sequentially was most of what made a sync feel "slow" — this bounds
// concurrency instead of firing them all at once, which would risk Gmail's
// per-user rate limit.
const MESSAGE_FETCH_CONCURRENCY = 8

async function fetchMessages(accessToken: string, ids: string[]): Promise<Map<string, FetchedMessage>> {
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
  const awardPoints = !registeredAt || emailDate >= registeredAt

  const classification =
    direction === 'INBOUND'
      ? classifyInboundEmail(subject, bodyPreview, from, !!listUnsubscribe)
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
  const skipRoleMatching = isFromAtsOrJobBoard || isFromNextChapterItself || isBulk
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

  // Course-completion/enrollment detection — independent of the primary
  // classification above (neither fits any of those categories). Gated to
  // mail from the platforms' own domains so "congratulations, you
  // completed X" / "you're enrolled" phrasing is never guessed from an
  // arbitrary sender. Completion checked first: a completion email that
  // happens to also mention "enrolled" somewhere should never be read as a
  // fresh enrollment.
  const senderPlatformDomain = direction === 'INBOUND' ? senderRootDomain : null
  if (senderPlatformDomain && LEARNING_PLATFORM_DOMAINS.has(senderPlatformDomain)) {
    if (matchCourseCompletion(subject, bodyPreview)) {
      const completedTitle = await findCatalogTitleInText(`${subject} ${bodyPreview}`)
      if (completedTitle) {
        await markCourseCompletedFromEmail(connection.candidateId, completedTitle, senderPlatformDomain)
      }
    } else if (matchCourseEnrollment(subject, bodyPreview)) {
      const enrolledTitle = await findCatalogTitleInText(`${subject} ${bodyPreview}`)
      if (enrolledTitle) {
        await markCourseEnrolledFromEmail(connection.candidateId, enrolledTitle, senderPlatformDomain)
      }
    }
  }

  // Interim Work marketplace registration detection — any inbound mail from
  // a listing's own domain (a welcome email, a "confirm your account" link,
  // a workforce-invite notification) is real evidence the candidate signed
  // up there, no subject/body keyword matching needed since receiving mail
  // from the domain at all is already the signal. Same
  // markInterimMarketplaceSignupCore the manual "I created a profile"
  // button calls, tagged GMAIL_DETECTED so the UI can show how it was
  // found. Only ever runs for candidates who completed the (currently
  // testing-mode-only) Gmail connection — everyone else keeps using the
  // manual button, which this never replaces.
  if (senderPlatformDomain) {
    const matchedListing = interimListingDomainMap.get(senderPlatformDomain)
    if (matchedListing) {
      await markInterimMarketplaceSignupCore(connection.candidateId, matchedListing.id, 'GMAIL_DETECTED')
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

export async function syncGmailConnection(connectionId: string): Promise<{ synced: number } | null> {
  const connection = await prisma.emailConnection.findUnique({ where: { id: connectionId } })
  if (!connection || connection.disconnectedAt) return null

  if (connection.lastSyncAt && Date.now() - connection.lastSyncAt.getTime() < THROTTLE_MS) {
    return { synced: 0 }
  }

  const accessToken = await ensureFreshAccessToken(connection)
  if (!accessToken) return null

  const sinceDate = connection.lastSyncAt ?? new Date(Date.now() - FIRST_SYNC_BACKFILL_MS)
  const afterUnixSeconds = Math.floor((sinceDate.getTime() - QUERY_OVERLAP_MS) / 1000)
  const [inboxIds, sentIds] = await Promise.all([
    listMessageIds(accessToken, 'INBOX', afterUnixSeconds),
    listMessageIds(accessToken, 'SENT', afterUnixSeconds),
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

  let synced = 0
  let scopeInsufficient = false
  // Each message is its own try/catch — previously one message throwing
  // (malformed payload, a transient fetch error) aborted the whole loop,
  // silently dropping every message after it in that batch AND, since
  // lastSyncAt only gets written after the loop finishes clean, permanently
  // stalling this connection's sync on that same message on every future
  // visit until someone noticed and dug through logs.
  for (const id of newInboxIds) {
    if (scopeInsufficient) break
    try {
      const fetched = inboxFetched.get(id)
      if (!fetched) continue
      const result = await processMessage(connection, id, fetched, 'INBOUND', workHistoryCompanies, registeredAt, interimListingDomainMap)
      if (result === 'insufficient_scope') scopeInsufficient = true
      else if (result === 'synced') synced++
    } catch (error) {
      console.error(`Failed to process inbound message ${id}:`, error)
    }
  }
  for (const id of newSentIds) {
    if (scopeInsufficient) break
    try {
      const fetched = sentFetched.get(id)
      if (!fetched) continue
      const result = await processMessage(connection, id, fetched, 'OUTBOUND', workHistoryCompanies, registeredAt, interimListingDomainMap)
      if (result === 'insufficient_scope') scopeInsufficient = true
      else if (result === 'synced') synced++
    } catch (error) {
      console.error(`Failed to process outbound message ${id}:`, error)
    }
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
