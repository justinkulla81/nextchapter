import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { isGmailConnected } from '@/lib/dashboard/access-gate'
import { isLinkedInConnected } from '@/lib/dashboard/linkedin-connection'
import { DOSSIER_REFERENCE_TARGET, isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { isCasuallySearching } from '@/lib/scoring/search-intensity'
import { effectiveJourney, effectiveStage } from './journey'
import { workingNowOf } from './intensity'
import { engagementLead, engagementPlanItems, type EngagementSignals } from './engagement'

const WEEK = 7 * 86_400_000

// The real signals, read from what the member has connected and done. Results
// (applications, interviews, offers, outreach) are counted since they entered
// their current stage, so a new stage starts a fresh read.
export const loadEngagementSignals = cache(async (candidateId: string, now = new Date()): Promise<EngagementSignals> => {
  const p = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: {
      journey: true,
      journeyStage: true,
      currentJobStatus: true,
      journeyStageChangedAt: true,
      createdAt: true,
      coachingStylePreference: true,
      searchIntensity: true,
      hasRestrictiveCovenant: true,
      firedForCause: true,
      willingToTakeDrugTest: true,
      willingToTakeBackgroundCheck: true,
      jobSearchDifficultyLevel: true,
      journeyDetails: true,
      skillsAssessmentCompletedAt: true,
      linkedinConnectionsImportedAt: true,
      linkedInConnection: { select: { disconnectedAt: true } },
    },
  })
  const since = p.journeyStageChangedAt ?? p.createdAt
  const [conversations, gmail, calendar, completedReferences, requestedReferences, openResumeIssues, personality, unlock, outreach, applications, interviews, offers] = await Promise.all([
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
    journey: effectiveJourney(p),
    stage: effectiveStage(p),
    tone: p.coachingStylePreference,
    casual: isCasuallySearching(p.jobSearchDifficultyLevel, p.searchIntensity),
    workingNow: workingNowOf(p.journeyDetails),
    conversations,
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
