import 'server-only'
import { prisma } from '@/lib/prisma'
import { getBackchannelMatches } from '@/lib/network/backchannel'
import { getEmailReminders } from '@/lib/network/reminders'
import { formatDisplayName } from '@/lib/format-name'
import type { AskSize, HookKind, PlaybookPurpose } from '@/lib/network/playbook'

export interface WeeklyOutreachItem {
  contactId: string
  name: string
  company: string | null
  reason: string
  purpose: PlaybookPurpose
  askSize: AskSize
  hook: HookKind
  roleTitle?: string
}

const MAX_ITEMS = 5
const RECENT_OUTREACH_DAYS = 14
const STALE_WARM_DAYS = 60

// "Who should I write to this week, and what for": a short, ordered list of
// the highest-leverage people, each with a reason and a ready-made starting
// point for the outreach coach. Order is leverage, not recency: someone at a
// company you've applied to beats a starred contact, which beats a warm
// relationship that has gone quiet. Anyone written to in the last two weeks is
// skipped so the list never nags about a conversation already in motion.
export async function getWeeklyOutreachPlan(candidateId: string): Promise<WeeklyOutreachItem[]> {
  const now = Date.now()
  const recentCutoff = new Date(now - RECENT_OUTREACH_DAYS * 86_400_000)
  const staleCutoff = new Date(now - STALE_WARM_DAYS * 86_400_000)

  const [backchannel, starred, quietWarm, recentlyContacted] = await Promise.all([
    getBackchannelMatches(candidateId, new Date(0)),
    getEmailReminders(candidateId),
    prisma.supportNetworkContact.findMany({
      where: {
        candidateId,
        removedAt: null,
        warmth: { in: ['HOT', 'WARM'] },
        outreachLogs: { none: { loggedAt: { gte: staleCutoff } } },
      },
      orderBy: [{ warmth: 'asc' }, { connectedAt: 'desc' }],
      take: 10,
      select: { id: true, name: true, company: true },
    }),
    prisma.outreachLog.findMany({
      where: { candidateId, contactId: { not: null }, loggedAt: { gte: recentCutoff } },
      select: { contactId: true },
    }),
  ])

  const skip = new Set(recentlyContacted.map((r) => r.contactId))
  const seen = new Set<string>()
  const items: WeeklyOutreachItem[] = []
  const add = (item: WeeklyOutreachItem) => {
    if (items.length >= MAX_ITEMS || skip.has(item.contactId) || seen.has(item.contactId)) return
    seen.add(item.contactId)
    items.push(item)
  }

  for (const match of backchannel) {
    for (const c of match.contacts.slice(0, 2)) {
      add({
        contactId: c.id,
        name: formatDisplayName(c.name),
        company: match.job.companyName,
        reason: `You applied to ${match.job.companyName}${match.job.title ? ` (${match.job.title})` : ''} and know them there.`,
        purpose: 'ASK_REFERRAL',
        askSize: 'BIG',
        hook: 'COMPANY_NEWS',
        roleTitle: match.job.title ?? undefined,
      })
    }
  }
  for (const r of starred) {
    add({
      contactId: r.contactId,
      name: formatDisplayName(r.name),
      company: r.company,
      reason: r.daysSinceLastOutreach === null ? 'You starred them and have not written yet.' : `You starred them. It has been ${r.daysSinceLastOutreach} days.`,
      purpose: r.daysSinceLastOutreach === null ? 'REACH_OUT' : 'INFO_CHAT',
      askSize: 'MEDIUM',
      hook: 'SHARED_HISTORY',
    })
  }
  for (const c of quietWarm) {
    add({
      contactId: c.id,
      name: formatDisplayName(c.name),
      company: c.company,
      reason: 'A warm relationship that has gone quiet. Reconnect before you need anything.',
      purpose: 'REACH_OUT',
      askSize: 'SMALL',
      hook: 'SHARED_HISTORY',
    })
  }
  return items
}
