import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { isGmailConnected } from '@/lib/dashboard/access-gate'
import { isLinkedInConnected } from '@/lib/dashboard/linkedin-connection'
import { DOSSIER_REFERENCE_TARGET, isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { isCasuallySearching } from '@/lib/scoring/search-intensity'
import { effectiveJourney, effectiveStage, returnDateOf } from './journey'
import { parseCultureFit } from '@/lib/culture/culture-fit'
import { spineGaps, type ProfileLike } from '@/lib/personalization/spine'
import { workingNowOf } from './intensity'
import { engagementLead, engagementPlanItems, type EngagementSignals } from './engagement'

const WEEK = 7 * 86_400_000

function detailString(details: unknown, key: string): string | null {
  const v = (details as Record<string, unknown> | null)?.[key]
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null
}
function detailNumber(details: unknown, key: string): number | null {
  const v = (details as Record<string, unknown> | null)?.[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
function detailDate(details: unknown, key: string): Date | null {
  const v = detailString(details, key)
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const d = new Date(`${v}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

// The real signals, read from what the member has connected and done. Results
// (applications, interviews, offers, outreach) are counted since they entered
// their current stage, so a new stage starts a fresh read.
export const loadEngagementSignals = cache(async (candidateId: string, now = new Date()): Promise<EngagementSignals> => {
  // The whole profile: the personalization spine reads many fields.
  const p = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: { linkedInConnection: { select: { disconnectedAt: true } } },
  })
  const journey = effectiveJourney(p)
  const stage = effectiveStage(p)
  const since = p.journeyStageChangedAt ?? p.createdAt
  const [currentEngagement, conversations, gmail, calendar, completedReferences, requestedReferences, openResumeIssues, personality, unlock, outreach, applications, interviews, offers] = await Promise.all([
    // A current fractional or interim engagement with an expected end date, from work history.
    prisma.workHistoryEntry.findFirst({ where: { candidateId, isCurrent: true, engagementType: { in: ['FRACTIONAL', 'INTERIM'] }, expectedEndDate: { not: null } }, orderBy: { expectedEndDate: 'asc' }, select: { expectedEndDate: true } }),
    prisma.careerConversation.findMany({ where: { candidateId, outcome: 'PENDING', scheduledFor: { not: null } }, select: { kind: true, scheduledFor: true, outcome: true }, take: 10 }),
    isGmailConnected(candidateId),
    prisma.calendarConnection.findFirst({ where: { candidateId, disconnectedAt: null }, select: { id: true } }),
    prisma.reference.count({ where: { candidateId, status: 'COMPLETED' } }),
    prisma.reference.count({ where: { candidateId } }),
    prisma.resumeIssue.count({ where: { candidateId, resolvedAt: null } }),
    prisma.performanceAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }),
    isDossierUnlocked(candidateId),
    prisma.outreachLog.count({ where: { candidateId, loggedAt: { gte: since } } }),
    prisma.jobPosting.count({ where: { candidateId, appliedAt: { gte: since } } }),
    prisma.jobPosting.count({ where: { candidateId, interviewLandedAt: { gte: since } } }),
    prisma.jobPosting.count({ where: { candidateId, offerReceivedAt: { gte: since } } }),
  ])
  return {
    journey,
    stage,
    tone: p.coachingStylePreference,
    casual: isCasuallySearching(p.jobSearchDifficultyLevel, p.searchIntensity),
    workingNow: workingNowOf(p.journeyDetails),
    conversations,
    aiDisplaced: p.aiDisplacementReason === 'yes' || p.aiDisplacementReason === 'partly',
    culture: parseCultureFit(p.cultureFit),
    details: {
      returnDate: returnDateOf(p.journeyDetails),
      offering: detailString(p.journeyDetails, 'offering'),
      openDays: detailNumber(p.journeyDetails, 'openDays'),
      engagementEnds: detailDate(p.journeyDetails, 'engagementEnds') ?? currentEngagement?.expectedEndDate ?? null,
    },
    spineGaps: spineGaps(journey, stage, p as unknown as ProfileLike),
    redFlags: {
      restrictiveCovenant: p.hasRestrictiveCovenant === true,
      firedForCause: p.firedForCause === true,
      noDrugTest: p.willingToTakeDrugTest === false,
      noBackgroundCheck: p.willingToTakeBackgroundCheck === false,
    },
    weeksInStage: Math.max(0, Math.floor((now.getTime() - since.getTime()) / WEEK)),
    gmail,
    calendar: !!calendar,
    linkedin: isLinkedInConnected(p),
    completedReferences,
    requestedReferences,
    referencesTarget: DOSSIER_REFERENCE_TARGET,
    openResumeIssues,
    hasPersonalityProfile: !!personality,
    skillsAssessmentDone: p.skillsAssessmentCompletedAt !== null,
    dossierUnlocked: unlock.unlocked,
    outreach,
    applications,
    interviews,
    offers,
  }
})

export async function getEngagementLead(candidateId: string) {
  return engagementLead(await loadEngagementSignals(candidateId))
}

export async function getEngagementPlanItems(candidateId: string) {
  return engagementPlanItems(await loadEngagementSignals(candidateId))
}
