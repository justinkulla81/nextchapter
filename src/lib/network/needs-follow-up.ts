import 'server-only'
import { prisma } from '@/lib/prisma'
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import { formatDisplayName } from '@/lib/format-name'

// How far back a meeting/inbound email still counts as "needs a follow-up"
// — older than this and surfacing it would read as nagging about something
// too stale to act on naturally.
const MEETING_LOOKBACK_DAYS = 21
const INBOUND_LOOKBACK_DAYS = 14

// trackedEmailActivity.fromAddress stores the raw RFC 5322 header value
// (sync-gmail.ts writes `from`/`to` straight from the parsed message), which
// is frequently `"Justin Kulla" <justin@example.com>`, not a bare email —
// left unparsed, that string became both an ugly list-row title AND a dead
// lookup key (contactNameByEmail is keyed on plain emails from
// SupportNetworkContact, so it could never match). Extracting the address
// here fixes both: real contact-name matches start working, and anything
// still unmatched falls back to a clean parsed name instead of raw header
// soup.
function parseAddress(raw: string): { name: string | null; email: string } {
  const match = raw.match(/^"?([^"<]*)"?\s*<([^>]+)>\s*$/)
  if (match) {
    const name = match[1].trim().replace(/^['"]|['"]$/g, '')
    return { name: name || null, email: match[2].trim().toLowerCase() }
  }
  return { name: null, email: raw.trim().toLowerCase() }
}

export interface NeedsFollowUpItem {
  kind: 'meeting' | 'inbound-email'
  sourceId: string
  contactName: string
  contactEmail: string
  date: Date
  subject: string
  gmailHref: string
}

// Two real, verifiable "you owe someone something" signals, joined without
// a new attendee table: a tracked calendar meeting (NETWORKING_CALL/
// INTERVIEW) whose counterpart hasn't received a detected thank-you/
// follow-up email since, and an inbound recruiter email that hasn't been
// replied to. Deliberately read-only/informational — this list never
// awards points itself; the points still only come from Gmail/Calendar
// actually detecting the real thank-you/follow-up/reply (see
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
      select: { name: true, email: true },
    }),
  ])

  const contactNameByEmail = new Map(contacts.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c.name]))

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
        date: meeting.startTime,
        subject,
        gmailHref: gmailComposeHref(address, `Re: Thank you — ${subject}`),
      }
    })

  const inboundItems: NeedsFollowUpItem[] = emailActivities
    .filter(
      (activity) =>
        activity.direction === 'INBOUND' &&
        activity.isRecruiterContact &&
        activity.fromAddress &&
        activity.detectedAt >= inboundCutoff
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
        date: activity.detectedAt,
        subject,
        gmailHref: gmailComposeHref(parsed.email, subject.startsWith('Re:') ? subject : `Re: ${subject}`),
      }
    })

  // One row per person — someone who both met with you AND emailed you
  // should only show once, keyed to whichever signal is more recent.
  const seen = new Set<string>()
  const deduped: NeedsFollowUpItem[] = []
  for (const item of [...meetingItems, ...inboundItems].sort((a, b) => b.date.getTime() - a.date.getTime())) {
    if (seen.has(item.contactEmail)) continue
    seen.add(item.contactEmail)
    deduped.push(item)
  }
  return deduped.slice(0, 10)
}
