import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { getLifetimeEffortMinutes } from '@/lib/scoring/effort-minutes'
import { computeCurrentSprintStreak } from '@/lib/scoring/market-reality/effort'
import type { TraitSignals } from './evidence-traits'

// Reads the counts behind each trait. Cheap counts only; cached per request.
export const loadTraitSignals = cache(async (candidateId: string): Promise<TraitSignals> => {
  const [effortMinutes, profile, tailored, workSamples, streak, helpfulPosts, outreach, refs, operating, personality] = await Promise.all([
    getLifetimeEffortMinutes(candidateId),
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        skillsAssessmentCompletedAt: true,
        profileConfirmedAt: true, industryConfirmedAt: true, functionConfirmedAt: true,
        salaryConfirmedAt: true, workAuthConfirmedAt: true, linkedInConfirmedAt: true,
      },
    }),
    prisma.jobPosting.count({ where: { candidateId, appliedAt: { not: null }, AND: [{ coverLetter: { not: null } }, { coverLetter: { not: '' } }] } }),
    prisma.workSample.count({ where: { candidateId } }),
    computeCurrentSprintStreak(candidateId, 4),
    prisma.communityPost.count({ where: { candidateId } }),
    prisma.outreachLog.count({ where: { candidateId } }),
    prisma.reference.count({ where: { candidateId, status: 'COMPLETED' } }),
    prisma.candidateAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }),
    prisma.performanceAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }),
  ])
  const sections = [profile.profileConfirmedAt, profile.industryConfirmedAt, profile.functionConfirmedAt, profile.salaryConfirmedAt, profile.workAuthConfirmedAt, profile.linkedInConfirmedAt].filter((v) => v !== null).length
  return {
    effortMinutes,
    profileSections: sections,
    tailoredApplications: tailored,
    workSamples,
    goalStreakWeeks: streak,
    helpfulPosts,
    outreachCount: outreach,
    completedReferences: refs,
    behavioralAssessments: (operating ? 1 : 0) + (personality ? 1 : 0),
    skillsAssessmentDone: profile.skillsAssessmentCompletedAt !== null,
  }
})
