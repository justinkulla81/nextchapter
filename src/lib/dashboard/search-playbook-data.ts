import 'server-only'
import type { CandidateProfile } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ACTIVE_SEARCH_STAGES, effectiveJourney, effectiveStage } from '@/lib/journey/journey'
import { pickSearchStart, playbookPosition, type PlaybookPosition } from '@/lib/journey/search-playbook'
import { computeSearchEfficiency, WINDOW_DAYS, type EfficiencyCounts, type SearchEfficiency } from '@/lib/jobs/search-efficiency'

const MS_PER_DAY = 24 * 60 * 60 * 1000

type PlaybookProfile = Pick<
  CandidateProfile,
  'id' | 'journey' | 'journeyStage' | 'journeyChangedAt' | 'journeyStageChangedAt' | 'lastJobEndedAt' | 'currentJobStatus'
>

// Read-only. Nothing is written; the card renders from what the member has
// already done. No LLM or other metered call.
export async function loadSearchPlaybook(profile: PlaybookProfile, now = new Date()): Promise<PlaybookPosition | null> {
  const journey = effectiveJourney(profile)
  const stage = effectiveStage(profile)
  if (!journey || !stage || !ACTIVE_SEARCH_STAGES.includes(stage)) return null

  const [events, firstApplied] = await Promise.all([
    prisma.journeyEvent.findMany({
      where: { candidateId: profile.id, toStage: { in: ACTIVE_SEARCH_STAGES } },
      select: { toStage: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
    prisma.jobPosting.findFirst({
      where: { candidateId: profile.id, appliedAt: { not: null } },
      orderBy: { appliedAt: 'asc' },
      select: { appliedAt: true },
    }),
  ])

  const searchStartedAt = pickSearchStart({
    events,
    journeyChangedAt: profile.journeyChangedAt,
    journeyStageChangedAt: profile.journeyStageChangedAt,
    currentStageIsActive: true,
    firstAppliedAt: firstApplied?.appliedAt ?? null,
  })

  return playbookPosition({ journey, stage, lastJobEndedAt: profile.lastJobEndedAt, searchStartedAt, now })
}

async function countsBetween(candidateId: string, from: Date, to: Date): Promise<EfficiencyCounts> {
  const [applications, interviews, networkMeetings] = await Promise.all([
    prisma.jobPosting.count({ where: { candidateId, appliedAt: { gte: from, lt: to } } }),
    prisma.jobPosting.count({ where: { candidateId, interviewLandedAt: { gte: from, lt: to } } }),
    prisma.outreachLog.count({ where: { candidateId, channel: 'MEETING', loggedAt: { gte: from, lt: to } } }),
  ])
  return { applications, interviews, networkMeetings }
}

export async function loadSearchEfficiency(candidateId: string, now = new Date()): Promise<SearchEfficiency> {
  const windowMs = WINDOW_DAYS * MS_PER_DAY
  const currentFrom = new Date(now.getTime() - windowMs)
  const previousFrom = new Date(now.getTime() - 2 * windowMs)
  const [current, previous] = await Promise.all([
    countsBetween(candidateId, currentFrom, new Date(now.getTime() + 1)),
    countsBetween(candidateId, previousFrom, currentFrom),
  ])
  return computeSearchEfficiency(current, previous)
}
