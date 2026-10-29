import 'server-only'
import { prisma } from '@/lib/prisma'
import { LOOKBACK_DAYS } from './config'
import { classifyLead, type NurtureContext, type NurtureLeadKind, type NurtureTrack } from './tracks'

// Who might be in the sequence: the captures whose own email has gone out (or whose confirmation was clicked), in the last
// 30 days, grouped to one lead per capture with its day 0. Reads only; stops and ownership are decided in run.ts.
//
// Day 0, per capture:
//   journey          the first-week plan went out (planSentAt): no plan sent, no follow-up to a plan
//   deadline, layoff the confirmation link was clicked (confirmedAt): double opt-in, nothing before it
//   pay check        the result email went out (planSentAt)
//   guide            the guide email went out (the row is written, then the email sent)

const DAY_MS = 24 * 60 * 60 * 1000

export interface NurtureLead {
  email: string
  kind: NurtureLeadKind
  track: NurtureTrack
  context: NurtureContext
  /** Day 0. */
  anchor: Date
}

const clean = (email: string) => email.trim().toLowerCase()

export interface Gathered {
  leads: NurtureLead[]
  /** Addresses that unsubscribed from any website capture or the newsletter. */
  unsubscribed: Set<string>
}

export async function gatherNurtureLeads(now: Date): Promise<Gathered> {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS)
  const [journeys, deadlines, layoffs, payChecks, guides, unsubHome, unsubNews] = await Promise.all([
    prisma.homepageLead.findMany({
      where: { kind: 'journey', planSentAt: { gte: since }, unsubscribedAt: null },
      select: { email: true, situation: true, followup: true, source: true, planSentAt: true },
    }),
    prisma.homepageLead.findMany({
      where: { kind: 'deadline_reminders', confirmedAt: { gte: since }, unsubscribedAt: null },
      select: { email: true, searchLoc: true, source: true, confirmedAt: true },
    }),
    prisma.homepageLead.findMany({
      where: { kind: 'layoff_alert', confirmedAt: { gte: since }, unsubscribedAt: null },
      select: { email: true, searchQ: true, searchLoc: true, source: true, confirmedAt: true },
    }),
    prisma.homepageLead.findMany({
      where: { kind: 'pay_check', planSentAt: { gte: since }, unsubscribedAt: null },
      select: { email: true, searchQ: true, source: true, planSentAt: true },
    }),
    prisma.guideLead.findMany({ where: { createdAt: { gte: since } }, select: { email: true, firstName: true, guideSlug: true, source: true, createdAt: true } }),
    prisma.homepageLead.findMany({ where: { unsubscribedAt: { not: null } }, select: { email: true } }),
    prisma.newsletterSubscriber.findMany({ where: { unsubscribedAt: { not: null } }, select: { email: true } }),
  ])

  const leads: NurtureLead[] = []
  const add = (email: string, kind: NurtureLeadKind, anchor: Date | null, raw: Parameters<typeof classifyLead>[0]) => {
    const c = anchor ? classifyLead(raw) : null
    if (c && anchor) leads.push({ email: clean(email), kind, track: c.track, context: c.context, anchor })
  }

  for (const j of journeys) add(j.email, 'journey', j.planSentAt, { kind: 'journey', situation: j.situation, followup: j.followup, source: j.source })
  for (const d of deadlines) add(d.email, 'deadline', d.confirmedAt, { kind: 'deadline', searchLoc: d.searchLoc, source: d.source })
  for (const l of layoffs) add(l.email, 'layoff_alert', l.confirmedAt, { kind: 'layoff_alert', searchQ: l.searchQ, searchLoc: l.searchLoc, source: l.source })
  for (const p of payChecks) add(p.email, 'pay_check', p.planSentAt, { kind: 'pay_check', searchQ: p.searchQ, source: p.source })
  for (const g of guides) add(g.email, 'guide', g.createdAt, { kind: 'guide', guideSlug: g.guideSlug, firstName: g.firstName, source: g.source })

  const unsubscribed = new Set([...unsubHome, ...unsubNews].map((r) => clean(r.email)))
  return { leads, unsubscribed }
}
