import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  LAYOFF_RUN_MAX, LAYOFF_SKIP_SHARE, domainMaySend, domainOf, layoffBreakerTripped, layoffDailyCap,
} from './layoff-pacing-rules'

export interface LayoffPacing {
  /** Why nothing goes out this run (the breaker, or a run skipped on purpose); null when it may. */
  hold: string | null
  /** Most this run may send. */
  runMax: number
  /** Room left in today's cap. */
  room: number
  /** Layoff emails each domain got in the last 24 hours, how many bounced, and the latest send (grows as this run sends). */
  domainSent: Map<string, DomainDay>
  now: Date
}

export interface DomainDay { sent: number; bounced: number; lastSentAt: Date | null }

/**
 * The layoff outreach's own limits for one run of the sender (rules in layoff-pacing-rules.ts): a trickle of at most 2 a run with one run in
 * four skipped, a daily cap that ramps from 40, at most 2 a day to one recipient domain (30 minutes apart, none after a bounce there), and a stop for 24 hours if the last day's layoff
 * emails bounced at 3% or more, or any was marked spam. `dayStart` is the start of today, Eastern.
 */
export async function layoffPacing(now: Date, dayStart: Date, campaign: string): Promise<LayoffPacing> {
  const since = new Date(now.getTime() - 24 * 3_600_000)
  const [recent, before] = await Promise.all([
    prisma.mailingEditionRecipient.findMany({ where: { sentAt: { gte: since }, edition: { campaign } }, select: { email: true, sentAt: true, bouncedAt: true, complainedAt: true } }),
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(DISTINCT date(r."sentAt" AT TIME ZONE 'America/New_York')) AS n
      FROM "MailingEditionRecipient" r JOIN "MailingEdition" e ON e.id = r."editionId"
      WHERE e.campaign = ${campaign} AND r."sentAt" < ${dayStart}`,
  ])
  const sentToday = recent.filter((r) => r.sentAt && r.sentAt >= dayStart).length
  const room = Math.max(0, layoffDailyCap(Number(before[0]?.n ?? 0)) - sentToday)
  const domainSent = new Map<string, DomainDay>()
  for (const r of recent) {
    const d = domainSent.get(domainOf(r.email)) ?? { sent: 0, bounced: 0, lastSentAt: null }
    d.sent++
    if (r.bouncedAt) d.bounced++
    if (r.sentAt && (!d.lastSentAt || r.sentAt > d.lastSentAt)) d.lastSentAt = r.sentAt
    domainSent.set(domainOf(r.email), d)
  }
  const bounced = recent.filter((r) => r.bouncedAt).length
  const complained = recent.filter((r) => r.complainedAt).length
  if (layoffBreakerTripped(recent.length, bounced, complained)) {
    captureServerEvent('system', 'layoff_outreach_paused', { sent24h: recent.length, bounced, complained })
    return { hold: `bounces ${bounced}/${recent.length}, complaints ${complained}`, runMax: 0, room, domainSent, now }
  }
  if (room === 0) return { hold: 'daily cap reached', runMax: 0, room, domainSent, now }
  if (Math.random() < LAYOFF_SKIP_SHARE) return { hold: 'run skipped for pacing', runMax: 0, room, domainSent, now }
  return { hold: null, runMax: Math.min(LAYOFF_RUN_MAX, room), room, domainSent, now }
}

export const domainHasRoom = (p: LayoffPacing, email: string) => domainMaySend(p.domainSent.get(domainOf(email)), p.now)

/** The next pending recipient of a layoff edition (warm ones first, in the warm pass) whose domain still has room today, or null (the edition waits for tomorrow). Looks at 30 at most. */
export async function nextLayoffRecipient(editionId: string, p: LayoffPacing, warm: boolean) {
  const pending = await prisma.mailingEditionRecipient.findMany({
    where: { editionId, status: 'PENDING', excluded: false, warm }, orderBy: [{ attempts: 'asc' }, { email: 'asc' }], take: 30,
  })
  return pending.find((r) => domainHasRoom(p, r.email)) ?? null
}
