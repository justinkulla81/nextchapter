import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Mood } from '@prisma/client'
import { getMoodHistory, getSentimentAlert, type SentimentAlert } from '@/lib/daily/mood'
import { detectAvoidancePattern, type AvoidancePattern } from '@/lib/coach/pre-session-brief'
import { PUBLIC_DISCLOSURE_COMFORT_OPTIONS, REFERRAL_RECENCY_OPTIONS } from '@/lib/constants/onboarding'
import {
  getCoachingOnboardingAnswersForDisplay,
  type CoachingOnboardingAnswerDisplay,
} from '@/lib/coach/onboarding-form'
import type { TrendSnapshot } from '@/components/dashboard/MarketRealityTrendChart'

export interface GapAnalysisGap {
  area: string
  why: string
  remediation: string
  remediationType: string
}

export interface JobFitHistoryEntry {
  title: string
  companyName: string | null
  reaction: string | null
  reactedAt: Date | null
}

// Coach-only data (Prompt 54) — deliberately broader than anything the
// external Executive Dossier ever shows (financial pressure, raw
// compensation, unfiltered Gap Analysis, sentiment). Never rendered
// anywhere outside the coach's Full Client View, and only after the
// candidate's explicit consent (coachDossierConsentedAt) is recorded.
export interface CoachingNotes {
  moodHistory: { date: Date; mood: Mood }[]
  sentimentAlert: SentimentAlert
  marketRealityTrend: TrendSnapshot[]
  publicDisclosureComfortLabel: string | null
  hasBeenReferredBefore: boolean | null
  referralRecencyLabel: string | null
  lastSalary: number | null
  targetCompMin: number | null
  gapAnalysis: { targetRole: string; gaps: GapAnalysisGap[] } | null
  avoidancePattern: AvoidancePattern | null
  financialPressureContext: string | null
  jobFitHistory: JobFitHistoryEntry[]
  // Prompt 60 — the candidate's Coaching Onboarding Form answers, once
  // submitted. Null until they've completed it.
  coachingOnboardingAnswers: CoachingOnboardingAnswerDisplay[] | null
}

export async function getCoachingNotes(candidateId: string): Promise<CoachingNotes> {
  const [candidate, moodHistory, sentimentAlert, marketRealitySnapshots, avoidancePattern, latestReport, surfacedJobs, coachingOnboardingAnswers] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        publicDisclosureComfort: true,
        hasBeenReferredBefore: true,
        referralRecency: true,
        lastSalary: true,
        targetCompMin: true,
        benefitsUnlockAnswer: true,
      },
    }),
    getMoodHistory(candidateId),
    getSentimentAlert(candidateId),
    prisma.marketRealitySnapshot.findMany({
      where: { candidateId },
      orderBy: { weekStartDate: 'asc' },
      select: { weekStartDate: true, grade: true },
    }),
    detectAvoidancePattern(candidateId),
    prisma.hireabilityReport.findFirst({
      where: { candidateId },
      orderBy: { generatedAt: 'desc' },
      select: { gapAnalysis: true },
    }),
    prisma.surfacedJob.findMany({
      where: { candidateId, reaction: { not: null } },
      orderBy: { reactedAt: 'desc' },
      select: { title: true, companyName: true, reaction: true, reactedAt: true },
      take: 50,
    }),
    getCoachingOnboardingAnswersForDisplay(candidateId),
  ])

  return {
    moodHistory,
    sentimentAlert,
    marketRealityTrend: marketRealitySnapshots as unknown as TrendSnapshot[],
    publicDisclosureComfortLabel: candidate.publicDisclosureComfort
      ? (PUBLIC_DISCLOSURE_COMFORT_OPTIONS.find((o) => o.value === candidate.publicDisclosureComfort)?.label ?? null)
      : null,
    hasBeenReferredBefore: candidate.hasBeenReferredBefore,
    referralRecencyLabel: candidate.referralRecency
      ? (REFERRAL_RECENCY_OPTIONS.find((o) => o.value === candidate.referralRecency)?.label ?? null)
      : null,
    lastSalary: candidate.lastSalary,
    targetCompMin: candidate.targetCompMin,
    gapAnalysis: latestReport
      ? (latestReport.gapAnalysis as unknown as { targetRole: string; gaps: GapAnalysisGap[] })
      : null,
    avoidancePattern,
    financialPressureContext: candidate.benefitsUnlockAnswer,
    jobFitHistory: surfacedJobs,
    coachingOnboardingAnswers,
  }
}
