import 'server-only'
import { prisma } from '@/lib/prisma'
import { ACTIVE_SEARCH_STAGES, effectiveStage } from '@/lib/journey/journey'
import { isPivotingProfile } from '@/lib/journey/pivot-target'
import { readSearchExpansion } from '@/lib/profile/search-expansion'
import { loadMarketSize, type MarketMember } from '@/lib/market/market-size-server'
import { coachOfferQuiet, pickCoachOffer, type CoachOfferFacts, type CoachOfferReason, type CoachOfferState } from './offer'
import { seniorMember } from './seniority'

const DAY = 86_400_000

type OfferProfile = MarketMember & {
  id: string
  coachId: string | null
  blockers: string[]
  highestLevelReached: string | null
  targetFunction: string | null
  searchExpansion: unknown
  journeyDetails: unknown
  journey: Parameters<typeof effectiveStage>[0]['journey']
  journeyStage: Parameters<typeof effectiveStage>[0]['journeyStage']
  currentJobStatus: Parameters<typeof effectiveStage>[0]['currentJobStatus']
  registrationCompletedAt: Date | null
  createdAt: Date
}

export function coachOfferState(journeyDetails: unknown): CoachOfferState {
  const o = (journeyDetails as { coachOffer?: { snoozedUntil?: unknown } } | null)?.coachOffer
  return { snoozedUntil: typeof o?.snoozedUntil === 'string' ? o.snoozedUntil : null }
}

/** When the member entered their current stretch of active searching (applying, interviewing, offer). Null when they are not in one. */
async function searchStartedAt(candidateId: string, stageNow: ReturnType<typeof effectiveStage>, fallback: Date): Promise<Date | null> {
  if (!stageNow || !ACTIVE_SEARCH_STAGES.includes(stageNow)) return null
  const entered = await prisma.journeyEvent.findFirst({
    where: { candidateId, toStage: { in: ACTIVE_SEARCH_STAGES }, NOT: { fromStage: { in: ACTIVE_SEARCH_STAGES } } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  return entered?.createdAt ?? fallback
}

/** The facts the coach offer rules read (offer.ts), from the member's profile and what they have logged. */
export async function loadCoachOfferFacts(p: OfferProfile): Promise<CoachOfferFacts> {
  const now = Date.now()
  const stage = effectiveStage(p)
  const started = await searchStartedAt(p.id, stage, p.registrationCompletedAt ?? p.createdAt)
  const searching = started !== null
  const since = (days: number) => new Date(now - days * DAY)
  const [applications14, outreach14, outreach30, market] = await Promise.all([
    searching ? prisma.jobPosting.count({ where: { candidateId: p.id, appliedAt: { gte: since(14) } } }) : Promise.resolve(0),
    searching ? prisma.outreachLog.count({ where: { candidateId: p.id, loggedAt: { gte: since(14) } } }) : Promise.resolve(0),
    searching ? prisma.outreachLog.count({ where: { candidateId: p.id, loggedAt: { gte: since(30) } } }) : Promise.resolve(0),
    loadMarketSize(p).catch(() => null),
  ])
  const expansion = readSearchExpansion(p.searchExpansion)
  return {
    hasCoach: !!p.coachId,
    stage,
    senior: seniorMember(p),
    // Looking outside home: a target function that differs from theirs, or a search they widened to other roles, industries or states.
    pivoting: isPivotingProfile(p) || expansion.roles.length > 0 || expansion.industries.length > 0 || expansion.states.length > 0,
    smallPool: market?.prompt === 'too_few',
    networkingBlocker: p.blockers.includes('networking_discomfort'),
    daysSearching: started ? Math.floor((now - started.getTime()) / DAY) : null,
    applicationsLast14: applications14,
    outreachLast14: outreach14,
    outreachLast30: outreach30,
  }
}

/** The reason to offer a coach on Home today, or null. Read-only. */
export async function loadCoachOffer(p: OfferProfile): Promise<{ reason: CoachOfferReason; facts: CoachOfferFacts } | null> {
  const state = coachOfferState(p.journeyDetails)
  // Cheap exits first: a member with a coach, or inside a snooze, costs no queries.
  if (p.coachId || coachOfferQuiet(state)) return null
  const facts = await loadCoachOfferFacts(p)
  const reason = pickCoachOffer(facts, state)
  return reason ? { reason, facts } : null
}
