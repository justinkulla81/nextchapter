import 'server-only'
import { prisma } from '@/lib/prisma'

// How far back a meeting/inbound email still counts as "needs a follow-up"
// — older than this and surfacing it would read as nagging about something
// too stale to act on naturally.
const MEETING_LOOKBACK_DAYS = 21
const INBOUND_LOOKBACK_DAYS = 14

export interface NeedsFollowUpItem {
  kind: 'meeting' | 'inbound-email'
  sourceId: string
  contactName: string
  contactEmail: string
  date: Date
  subject: string
  gmailHref: string
}

// Opens Gmail's own web compose (not a bare mailto:, which hands off to
// whatever mail client the OS has set as default — often not Gmail even
// though the connected inbox this list is built from always is) prefilled
// with the recipient and a subject line referencing what prompted the
// follow-up.
function gmailComposeHref(to: string, subject: string): string {
  const params = new URLSearchParams({ view: 'cm', fs: '1', to, su: `Re: ${subject}` })
  return `https://mail.google.com/mail/?${params.toString()}`
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
  const latestOutboundByAddress = new Map<string, Date>()
  for (const activity of emailActivities) {
    if (activity.direction !== 'OUTBOUND' || !activity.fromAddress) continue
    const address = activity.fromAddress.toLowerCase()
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
      return {
        kind: 'meeting' as const,
        sourceId: meeting.id,
        contactName: contactNameByEmail.get(address) ?? meeting.counterpartName ?? address,
        contactEmail: address,
        date: meeting.startTime,
        subject,
        gmailHref: gmailComposeHref(address, `Thank you — ${subject}`),
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
      const address = activity.fromAddress!.toLowerCase()
      const lastReply = latestOutboundByAddress.get(address)
      return !lastReply || lastReply < activity.detectedAt
    })
    .map((activity) => {
      const address = activity.fromAddress!.toLowerCase()
      const subject = activity.subject || 'their email'
      return {
        kind: 'inbound-email' as const,
        sourceId: activity.id,
        contactName: contactNameByEmail.get(address) ?? address,
        contactEmail: address,
        date: activity.detectedAt,
        subject,
        gmailHref: gmailComposeHref(address, subject),
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
