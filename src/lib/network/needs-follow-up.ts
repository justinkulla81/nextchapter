import 'server-only'
import { prisma } from '@/lib/prisma'
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import { formatDisplayName } from '@/lib/format-name'
import { isKnownBulkSenderAddress } from '@/lib/email-tracking/ats-patterns'

// How far back a meeting/inbound email still counts as "needs a follow-up"
// — older than this and surfacing it would read as nagging about something
// too stale to act on naturally.
const MEETING_LOOKBACK_DAYS = 21
const INBOUND_LOOKBACK_DAYS = 14
// A message you sent to a known contact that's gone unanswered this long
// earns its own nudge — long enough that silence is a real signal, not just
// someone being slow to check email.
const OUTBOUND_LOOKBACK_DAYS = 7

// trackedEmailActivity.fromAddress stores the raw RFC 5322 header value
// (sync-gmail.ts writes `from`/`to` straight from the parsed message), which
// is frequently `"Justin Kulla" <justin@example.com>`, not a bare email —
// left unparsed, that string became both an ugly list-row title AND a dead
// lookup key (contactNameByEmail is keyed on plain emails from
// SupportNetworkContact, so it could never match). Extracting the address
// here fixes both: real contact-name matches start working, and anything
// still unmatched falls back to a clean parsed name instead of raw header
// soup.
export function parseAddress(raw: string): { name: string | null; email: string } {
  const match = raw.match(/^"?([^"<]*)"?\s*<([^>]+)>\s*$/)
  if (match) {
    const name = match[1].trim().replace(/^['"]|['"]$/g, '')
    return { name: name || null, email: match[2].trim().toLowerCase() }
  }
  return { name: null, email: raw.trim().toLowerCase() }
}

export interface NeedsFollowUpItem {
  kind: 'meeting' | 'inbound-email' | 'unanswered-outbound'
  sourceId: string
  contactName: string
  contactEmail: string
  // Set only when this signal matches a real SupportNetworkContact row (by
  // email) — links to their profile page. Null for a cold/unmatched sender
  // (e.g. a recruiter who's emailed but was never added to the network).
  contactId: string | null
  date: Date
  subject: string
  gmailHref: string
}

// Three real, verifiable "you owe someone something" signals, joined
// without a new attendee table: a tracked calendar meeting (NETWORKING_CALL/
// INTERVIEW) whose counterpart hasn't received a detected thank-you/
// follow-up email since; an inbound email — from a recruiter/hiring-manager/
// coach signal OR from anyone already in the candidate's own contact list —
// that hasn't been replied to; and an outbound email to a known contact that
// has gone unanswered for a week (silence after reaching out is its own real
// signal, not just someone being slow to check email). This is what a
// starred priority contact falls into once the candidate actually reaches
// out to them — see toggleContactPriority, which stops surfacing them as
// "priority" the moment an outreach is logged, since from then on this list
// is where they belong instead. Deliberately read-only/informational — this
// list never awards points itself; the points still only come from Gmail/
// Calendar actually detecting the real thank-you/follow-up/reply (see
// AUTO_DETECTED_ACTION_TYPES) once the candidate acts on it.
export async function getNeedsFollowUpList(candidateId: string): Promise<NeedsFollowUpItem[]> {
  const [calendarConnection, emailConnection] = await Promise.all([
    prisma.calendarConnection.findUnique({ where: { candidateId } }),
    prisma.emailConnection.findUnique({ where: { candidateId } }),
  ])
  if (!calendarConnection && !emailConnection) return []

  const now = Date.now()
  const meetingCutoff = new Date(now - MEETING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const inboundCutoff = new Date(now - INBOUND_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const outboundCutoff = new Date(now - OUTBOUND_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

  const [meetings, emailActivities, contacts] = await Promise.all([
    calendarConnection && !calendarConnection.disconnectedAt
      ? prisma.trackedCalendarEvent.findMany({
          where: {
            candidateId,
            eventType: { in: ['NETWORKING_CALL', 'INTERVIEW'] },
            confidence: 'high',
            counterpartEmail: { not: null },
            startTime: { gte: meetingCutoff },
            dismissedAt: null,
          },
          orderBy: { startTime: 'desc' },
        })
      : Promise.resolve([]),
    emailConnection && !emailConnection.disconnectedAt
      ? prisma.trackedEmailActivity.findMany({
          where: { candidateId, dismissedAt: null },
          orderBy: { detectedAt: 'desc' },
        })
      : Promise.resolve([]),
    prisma.supportNetworkContact.findMany({
      where: { candidateId, email: { not: null } },
      select: { id: true, name: true, email: true },
    }),
  ])

  const contactNameByEmail = new Map(contacts.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c.name]))
  const contactIdByEmail = new Map(contacts.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c.id]))

  // fromAddress is the counterpart's address for BOTH directions — see
  // sync-gmail.ts, which deliberately stores `to` there for OUTBOUND rows.
  // Parsed through parseAddress so this keys on the bare email regardless of
  // whether the stored value is a raw "Name <email>" header or already
  // clean — the inbound side below does the same parse, so both sides of
  // the "already replied?" check land on the same key space.
  const latestOutboundByAddress = new Map<string, Date>()
  for (const activity of emailActivities) {
    if (activity.direction !== 'OUTBOUND' || !activity.fromAddress) continue
    const address = parseAddress(activity.fromAddress).email
    const existing = latestOutboundByAddress.get(address)
    if (!existing || activity.detectedAt > existing) latestOutboundByAddress.set(address, activity.detectedAt)
  }

  // Mirror of the map above for the other direction — "did they reply after
  // I sent?" for the unanswered-outbound branch below.
  const latestInboundByAddress = new Map<string, Date>()
  for (const activity of emailActivities) {
    if (activity.direction !== 'INBOUND' || !activity.fromAddress) continue
    const address = parseAddress(activity.fromAddress).email
    const existing = latestInboundByAddress.get(address)
    if (!existing || activity.detectedAt > existing) latestInboundByAddress.set(address, activity.detectedAt)
  }

  const meetingItems: NeedsFollowUpItem[] = meetings
    .filter((meeting) => {
      const address = meeting.counterpartEmail!.toLowerCase()
      const lastFollowUp = latestOutboundByAddress.get(address)
      return !lastFollowUp || lastFollowUp < meeting.startTime
    })
    .map((meeting) => {
      const address = meeting.counterpartEmail!.toLowerCase()
      const subject = meeting.title || (meeting.eventType === 'INTERVIEW' ? 'Interview' : 'Networking call')
      const rawName = contactNameByEmail.get(address) ?? meeting.counterpartName ?? address
      return {
        kind: 'meeting' as const,
        sourceId: meeting.id,
        contactName: formatDisplayName(rawName),
        contactEmail: address,
        contactId: contactIdByEmail.get(address) ?? null,
        date: meeting.startTime,
        subject,
        gmailHref: gmailComposeHref(address, `Re: Thank you — ${subject}`),
      }
    })

  // Recruiter/hiring-manager/coach-flagged senders OR anyone already on the
  // candidate's own contact list — broadened beyond just recruiters so a
  // reply from a regular networking contact (including one the candidate
  // just reached out to) surfaces here too, not only cold recruiter outreach.
  // Excludes known bulk/automated senders (e.g. LinkedIn Job Alerts) even
  // when they happen to match the contact-list OR-condition — a stale
  // contact row from before bulk-sender detection existed shouldn't keep
  // making every future digest from that address read as a real person
  // waiting on a reply.
  const inboundItems: NeedsFollowUpItem[] = emailActivities
    .filter(
      (activity) =>
        activity.direction === 'INBOUND' &&
        activity.fromAddress &&
        activity.detectedAt >= inboundCutoff &&
        !isKnownBulkSenderAddress(activity.fromAddress) &&
        (activity.isRecruiterContact || contactNameByEmail.has(parseAddress(activity.fromAddress).email))
    )
    .filter((activity) => {
      const address = parseAddress(activity.fromAddress!).email
      const lastReply = latestOutboundByAddress.get(address)
      return !lastReply || lastReply < activity.detectedAt
    })
    .map((activity) => {
      const parsed = parseAddress(activity.fromAddress!)
      const subject = activity.subject || 'their email'
      const rawName = contactNameByEmail.get(parsed.email) ?? parsed.name ?? parsed.email
      return {
        kind: 'inbound-email' as const,
        sourceId: activity.id,
        contactName: formatDisplayName(rawName),
        contactEmail: parsed.email,
        contactId: contactIdByEmail.get(parsed.email) ?? null,
        date: activity.detectedAt,
        subject,
        gmailHref: gmailComposeHref(parsed.email, subject.startsWith('Re:') ? subject : `Re: ${subject}`),
      }
    })

  // A message sent to a known contact that's gone unanswered for a week —
  // scoped to contacts already on the candidate's list (never a cold-outreach
  // or transactional address) so this only ever nudges about real people.
  // This is the other half of the "starred priority contact, once reached
  // out to, belongs here instead" flow described on toggleContactPriority.
  const unansweredOutboundItems: NeedsFollowUpItem[] = emailActivities
    .filter(
      (activity) => activity.direction === 'OUTBOUND' && activity.fromAddress && activity.detectedAt <= outboundCutoff
    )
    .filter((activity) => {
      const address = parseAddress(activity.fromAddress!).email
      if (!contactNameByEmail.has(address)) return false
      const reply = latestInboundByAddress.get(address)
      return !reply || reply < activity.detectedAt
    })
    .map((activity) => {
      const address = parseAddress(activity.fromAddress!).email
      const subject = activity.subject || 'your message'
      const rawName = contactNameByEmail.get(address) ?? address
      return {
        kind: 'unanswered-outbound' as const,
        sourceId: activity.id,
        contactName: formatDisplayName(rawName),
        contactEmail: address,
        contactId: contactIdByEmail.get(address) ?? null,
        date: activity.detectedAt,
        subject,
        gmailHref: gmailComposeHref(address, subject.startsWith('Re:') ? subject : `Re: ${subject}`),
      }
    })

  // One row per person — someone who both met with you AND emailed you
  // should only show once, keyed to whichever signal is more recent.
  const seen = new Set<string>()
  const deduped: NeedsFollowUpItem[] = []
  for (const item of [...meetingItems, ...inboundItems, ...unansweredOutboundItems].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  )) {
    if (seen.has(item.contactEmail)) continue
    seen.add(item.contactEmail)
    deduped.push(item)
  }
  return deduped.slice(0, 10)
}
