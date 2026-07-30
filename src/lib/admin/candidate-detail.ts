import 'server-only'
import { prisma } from '@/lib/prisma'
import { getFullClientView, type FullClientView } from '@/lib/coach/full-client-view'
import { getSentimentAlert, getMoodHistory, type SentimentAlert } from '@/lib/daily/mood'
import { getAuthEmail, type AuthUserSummary } from '@/lib/admin/auth-users'
import { computeSurfacedJobFitBucket } from '@/lib/jobs/job-fit-bucket'
import type { Mood } from '@prisma/client'

export interface AdminCandidateDetail {
  id: string
  userId: string
  authEmail: string
  view: FullClientView
  coach: { id: string; name: string; hasConsent: boolean } | null
  workSamples: { id: string; title: string; sampleType: string; verified: boolean }[]
  jobActivity: {
    tracked: {
      id: string
      url: string
      appliedAt: Date | null
      interviewLandedAt: Date | null
      offerReceivedAt: Date | null
    }[]
    surfaced: { id: string; title: string; companyName: string | null; reaction: string | null; surfacedAt: Date }[]
    totalSurfaced: number
    goodFitOrBetter: number
    inGeo: number
  }
  jobClicks: {
    id: string
    createdAt: Date
    jobTitle: string
    companyName: string | null
    source: string
    url: string
  }[]
  sentimentAlert: SentimentAlert
  moodHistory: { date: Date; mood: Mood }[]
}

// Same free-text substring approach as compute-match-score.ts's location
// branch — a job's location field is unstructured ("Austin, TX" /
// "Remote — US"), so this is a best-effort match against the candidate's
// own city/state, not a real geocode comparison.
function isInCandidateGeo(
  candidate: { currentCity: string | null; currentState: string | null },
  jobLocation: string | null
): boolean {
  if (!jobLocation) return false
  const loc = jobLocation.toLowerCase()
  if (candidate.currentCity && loc.includes(candidate.currentCity.toLowerCase())) return true
  if (candidate.currentState && loc.includes(candidate.currentState.toLowerCase())) return true
  return false
}

// The candidate admin drill-down — the "anchor" page every other admin list
// links into. Reuses getFullClientView (the coach's own Full Client View
// data assembly — identity/grade-history/work-history/references/moods/
// sessions) rather than re-deriving the same shape, and layers on the
// admin-specific sections that view doesn't cover: real auth email, coach
// assignment/consent (not just session history), work samples, and job
// activity across all three job models.
export async function getAdminCandidateDetail(
  candidateId: string,
  authUsers: Map<string, AuthUserSummary>
): Promise<AdminCandidateDetail> {
  const [candidate, view, workSamples, tracked, surfacedForFit, jobClicks, sentimentAlert, moodHistory] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        userId: true,
        coachId: true,
        coachDossierConsentedAt: true,
        coach: { select: { id: true, fullName: true } },
        primaryFunction: true,
        secondaryFunction: true,
        highestLevelReached: true,
        levelRankScore: true,
        remotePreference: true,
        currentCity: true,
        currentState: true,
        openToRelocation: true,
        targetCompMin: true,
        compFlexible: true,
        targetRoleType: true,
        resumeKeywords: true,
        yearsExperience: true,
        industryContext: true,
        secondaryIndustryContext: true,
        targetIndustries: true,
        hasJD: true,
        hasMD: true,
        hasDO: true,
        targetCompanySize: true,
        priorityMaxComp: true,
        priorityBrandName: true,
        priorityWorkLife: true,
        priorityMission: true,
      },
    }),
    getFullClientView(candidateId),
    prisma.workSample.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, sampleType: true, verified: true },
    }),
    prisma.jobPosting.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, url: true, appliedAt: true, interviewLandedAt: true, offerReceivedAt: true },
    }),
    prisma.surfacedJob.findMany({
      where: { candidateId },
      orderBy: { surfacedAt: 'desc' },
      select: {
        id: true,
        title: true,
        companyName: true,
        location: true,
        description: true,
        reaction: true,
        surfacedAt: true,
      },
    }),
    prisma.jobClickEvent.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, jobTitle: true, companyName: true, source: true, url: true },
    }),
    getSentimentAlert(candidateId),
    getMoodHistory(candidateId),
  ])

  const surfaced = surfacedForFit.map(({ location: _location, description: _description, ...rest }) => rest)
  const goodFitOrBetter = surfacedForFit.filter(
    (job) => computeSurfacedJobFitBucket(candidate, job) !== 'stretch'
  ).length
  const inGeo = surfacedForFit.filter((job) => isInCandidateGeo(candidate, job.location)).length

  return {
    id: candidateId,
    userId: candidate.userId,
    authEmail: getAuthEmail(authUsers, candidate.userId),
    view,
    coach: candidate.coach
      ? { id: candidate.coach.id, name: candidate.coach.fullName, hasConsent: candidate.coachDossierConsentedAt !== null }
      : null,
    workSamples,
    jobActivity: { tracked, surfaced, totalSurfaced: surfacedForFit.length, goodFitOrBetter, inGeo },
    jobClicks,
    sentimentAlert,
    moodHistory,
  }
}
