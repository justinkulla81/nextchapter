import 'server-only'
import { prisma } from '@/lib/prisma'
import { inferOrgFromEmailDomain } from '@/lib/text/email-domain'
import { formatDisplayName } from '@/lib/format-name'

export interface SuggestedContact {
  // sourceId + sourceKind together are what dismissEmailActivity/
  // dismissCalendarEvent need to permanently hide a false positive — same
  // dismissedAt columns the Needs Follow-up card already writes to.
  sourceId: string
  sourceKind: 'meeting' | 'inbound-email'
  name: string
  email: string
  connectedAt: Date
  inferredCompany: string | null
}

// Safety net alongside the silent auto-add in upsertContactFromSignal
// (called from sync-gmail.ts/sync-google-calendar.ts for high-confidence
// recruiter/hiring-manager/coach/networking signals): that path only fires
// going forward from a real-time sync, so anyone it missed — a meeting
// synced before their invite carried a real display name, a contact that
// was soft-deleted and never re-added, a recruiter email that landed just
// under the confidence bar — never resurfaces on its own. This surfaces the
// same two signal types (high-confidence recruiter-flagged inbound email,
// high-confidence networking-call/interview counterpart) for anyone NOT
// already on the candidate's contact list, so the candidate gets one more
// explicit chance to add them via addSuggestedContact instead of losing the
// connection silently.
export async function getSuggestedContactsToAdd(candidateId: string): Promise<SuggestedContact[]> {
  const [meetings, emailActivities, contacts] = await Promise.all([
    prisma.trackedCalendarEvent.findMany({
      where: {
        candidateId,
        eventType: { in: ['NETWORKING_CALL', 'INTERVIEW'] },
        confidence: 'high',
        counterpartEmail: { not: null },
        dismissedAt: null,
      },
      orderBy: { startTime: 'desc' },
    }),
    prisma.trackedEmailActivity.findMany({
      where: {
        candidateId,
        direction: 'INBOUND',
        isRecruiterContact: true,
        confidence: 'high',
        dismissedAt: null,
      },
      orderBy: { detectedAt: 'desc' },
    }),
    prisma.supportNetworkContact.findMany({
      where: { candidateId, email: { not: null } },
      select: { email: true },
    }),
  ])

  const existingEmails = new Set(contacts.filter((c) => c.email).map((c) => c.email!.toLowerCase()))

  const byEmail = new Map<string, SuggestedContact>()

  for (const meeting of meetings) {
    const email = meeting.counterpartEmail!.toLowerCase()
    if (existingEmails.has(email) || byEmail.has(email)) continue
    const rawName = meeting.counterpartName?.trim() || email.split('@')[0]
    byEmail.set(email, {
      sourceId: meeting.id,
      sourceKind: 'meeting',
      name: formatDisplayName(rawName),
      email,
      connectedAt: meeting.startTime,
      inferredCompany: inferOrgFromEmailDomain(email).inferredCompany,
    })
  }

  for (const activity of emailActivities) {
    if (!activity.fromAddress) continue
    const match = activity.fromAddress.match(/^"?([^"<]*)"?\s*<([^>]+)>\s*$/)
    const email = (match ? match[2] : activity.fromAddress).trim().toLowerCase()
    if (existingEmails.has(email) || byEmail.has(email)) continue
    const rawName = (match ? match[1].trim().replace(/^['"]|['"]$/g, '') : '') || email.split('@')[0]
    byEmail.set(email, {
      sourceId: activity.id,
      sourceKind: 'inbound-email',
      name: formatDisplayName(rawName),
      email,
      connectedAt: activity.detectedAt,
      inferredCompany: inferOrgFromEmailDomain(email).inferredCompany,
    })
  }

  return Array.from(byEmail.values()).sort((a, b) => b.connectedAt.getTime() - a.connectedAt.getTime())
}
