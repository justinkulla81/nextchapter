import 'server-only'
import { prisma } from '@/lib/prisma'
import { getEmailReminders, getStaleContacts } from '@/lib/network/reminders'
import { getNeedsFollowUpList } from '@/lib/network/needs-follow-up'
import { formatDisplayName } from '@/lib/format-name'

// Prompt 87 point 3 — ONE view over the four "this needs your attention"
// signals that used to each live in their own place: starred contacts
// (Prompt 83), the Contact Book's general stale-contact detection
// (Prompt 84's getStaleContacts), unanswered applications, and post-
// interview thank-you/reply reminders (needs-follow-up.ts, already built).
// The Home dashboard's reminder card now reads from this, not from
// getEmailReminders alone — see NetworkRemindersCard's caller.

const UNANSWERED_APPLICATION_MIN_DAYS = 14
const DEFAULT_MAX_ITEMS = 20

export interface UnifiedFollowUpItem {
  kind: 'starred-contact' | 'needs-follow-up' | 'unanswered-application' | 'stale-contact'
  id: string
  title: string
  subtitle: string
  href: string
  // When the underlying signal happened — an inbound email/meeting date, the
  // last time you reached out, or the date you applied. Not every kind has
  // one (a never-contacted starred pick has no outreach date yet).
  date: Date | null
}

// `limit` defaults high (effectively "all") — the dashboard card is the one
// caller that wants a short preview and passes its own small cap; a "view
// all" page wants the full list.
export async function getUnifiedFollowUps(
  candidateId: string,
  limit: number = DEFAULT_MAX_ITEMS
): Promise<UnifiedFollowUpItem[]> {
  const unansweredCutoff = new Date(Date.now() - UNANSWERED_APPLICATION_MIN_DAYS * 24 * 60 * 60 * 1000)

  const [starred, needsFollowUp, unansweredApplications, staleContacts] = await Promise.all([
    getEmailReminders(candidateId),
    getNeedsFollowUpList(candidateId),
    prisma.jobPosting.findMany({
      where: {
        candidateId,
        appliedAt: { not: null, lte: unansweredCutoff },
        declinedAt: null,
        interviewCompleteAt: null,
      },
      orderBy: { appliedAt: 'asc' },
      select: { id: true, title: true, companyName: true, appliedAt: true },
      take: 5,
    }),
    getStaleContacts(candidateId),
  ])

  const starredIds = new Set(starred.map((r) => r.contactId))

  // Most time-sensitive first: a real "you owe someone something" signal
  // (interview thank-you, unanswered recruiter email) beats a general
  // staleness nudge.
  const items: UnifiedFollowUpItem[] = [
    ...needsFollowUp.map((f) => ({
      kind: 'needs-follow-up' as const,
      id: f.sourceId,
      title: f.contactName,
      subtitle: f.kind === 'meeting' ? `Follow up after ${f.subject}` : `Reply to ${f.subject}`,
      href: f.gmailHref,
      date: f.date,
    })),
    ...starred.map((r) => ({
      kind: 'starred-contact' as const,
      id: r.contactId,
      title: formatDisplayName(r.name),
      subtitle: r.company ? `Starred — ${r.company}` : 'Starred contact',
      href: `/dashboard/network?contact=${r.contactId}#reach-out-cards`,
      date: r.lastOutreachAt,
    })),
    ...unansweredApplications.map((j) => ({
      kind: 'unanswered-application' as const,
      id: j.id,
      title: j.title ?? 'Application',
      subtitle: `${j.companyName ?? 'that company'} — applied ${j.appliedAt!.toLocaleDateString()}, no word yet`,
      href: '/dashboard/find-my-job',
      date: j.appliedAt,
    })),
    ...staleContacts
      .filter((c) => !starredIds.has(c.contactId))
      .map((c) => ({
        kind: 'stale-contact' as const,
        id: c.contactId,
        title: formatDisplayName(c.name),
        subtitle: c.company ? `Haven't connected in a while — ${c.company}` : "Haven't connected in a while",
        href: `/dashboard/network/contacts`,
        date: c.lastOutreachAt,
      })),
  ]

  return items.slice(0, limit)
}
