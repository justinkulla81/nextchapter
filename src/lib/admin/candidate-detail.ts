import 'server-only'
import { prisma } from '@/lib/prisma'
import { getFullClientView, type FullClientView } from '@/lib/coach/full-client-view'
import { getSentimentAlert, type SentimentAlert } from '@/lib/daily/mood'
import { getAuthEmail, type AuthUserSummary } from '@/lib/admin/auth-users'

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
  }
  sentimentAlert: SentimentAlert
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
  const [candidate, view, workSamples, tracked, surfaced, sentimentAlert] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        userId: true,
        coachId: true,
        coachDossierConsentedAt: true,
        coach: { select: { id: true, fullName: true } },
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
      select: { id: true, title: true, companyName: true, reaction: true, surfacedAt: true },
    }),
    getSentimentAlert(candidateId),
  ])

  return {
    id: candidateId,
    userId: candidate.userId,
    authEmail: getAuthEmail(authUsers, candidate.userId),
    view,
    coach: candidate.coach
      ? { id: candidate.coach.id, name: candidate.coach.fullName, hasConsent: candidate.coachDossierConsentedAt !== null }
      : null,
    workSamples,
    jobActivity: { tracked, surfaced },
    sentimentAlert,
  }
}
