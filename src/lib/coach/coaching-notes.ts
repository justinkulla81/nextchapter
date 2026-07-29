import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Mood } from '@prisma/client'
import { getMoodHistory, getSentimentAlert, type SentimentAlert } from '@/lib/daily/mood'
import { getVisibilityComfortTrend, type VisibilityComfortTrend } from '@/lib/weekly/visibility-sentiment'
import { detectAvoidancePattern, type AvoidancePattern } from '@/lib/coach/pre-session-brief'
import { PUBLIC_DISCLOSURE_COMFORT_OPTIONS, REFERRAL_RECENCY_OPTIONS } from '@/lib/constants/onboarding'
import {
  getCoachingOnboardingAnswersForDisplay,
  type CoachingOnboardingAnswerDisplay,
} from '@/lib/coach/onboarding-form'
import type { TrendSnapshot } from '@/components/dashboard/MarketRealityTrendChart'
import { benefitsPressureLabel } from '@/lib/benefits/pressure-options'
import {
  computeCategoryGrades,
  GRADE_RELATIONS_INCLUDE,
  type CandidateWithGradeRelations,
} from '@/lib/scoring/hireability-grade'
import { summarizeSelfAwareness } from '@/lib/scoring/self-awareness'

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
// Only a 'wildly_off' verdict reaches a human, and only here — never the
// Dossier, never the candidate's completeness ring. See
// summarizeSelfAwareness: a single disagreement is noise and stays silent;
// this fires only when two or more independent dimensions disagree, which
// is a real coaching conversation rather than a scoring penalty.
export interface SelfAwarenessFlag {
  categoryLabel: string
  note: string
}

async function getSelfAwarenessFlags(candidateId: string): Promise<SelfAwarenessFlag[]> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: GRADE_RELATIONS_INCLUDE,
  })
  const categories = await computeCategoryGrades(candidate as unknown as CandidateWithGradeRelations)
  if (summarizeSelfAwareness(categories.map((c) => c.selfAwareness)) !== 'wildly_off') return []
  return categories
    .filter((c) => c.selfAwareness?.status === 'mismatch' && c.selfAwareness.note)
    .map((c) => ({ categoryLabel: c.label, note: c.selfAwareness!.note! }))
}

export interface CoachingNotes {
  moodHistory: { date: Date; mood: Mood }[]
  sentimentAlert: SentimentAlert
  marketRealityTrend: TrendSnapshot[]
  publicDisclosureComfortLabel: string | null
  // The most recent weekly re-check (WeeklySprint.visibilityComfort), if
  // any answer exists yet — distinct from publicDisclosureComfortLabel
  // above, which is the one-time onboarding baseline.
  latestWeeklyVisibilityComfortLabel: string | null
  visibilityComfortTrend: VisibilityComfortTrend
  hasBeenReferredBefore: boolean | null
  referralRecencyLabel: string | null
  lastSalary: number | null
  targetCompMin: number | null
  gapAnalysis: { targetRole: string; gaps: GapAnalysisGap[] } | null
  avoidancePattern: AvoidancePattern | null
  selfAwarenessFlags: SelfAwarenessFlag[]
  financialPressureContext: string | null
  jobFitHistory: JobFitHistoryEntry[]
  // Prompt 60 — the candidate's Coaching Onboarding Form answers, once
  // submitted. Null until they've completed it.
  coachingOnboardingAnswers: CoachingOnboardingAnswerDisplay[] | null
}

export async function getCoachingNotes(candidateId: string): Promise<CoachingNotes> {
  const [candidate, moodHistory, sentimentAlert, visibilityComfortTrend, latestWeeklyVisibilityComfort, marketRealitySnapshots, avoidancePattern, latestReport, surfacedJobs, coachingOnboardingAnswers, selfAwarenessFlags] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        publicDisclosureComfort: true,
        hasBeenReferredBefore: true,
        referralRecency: true,
        lastSalary: true,
        targetCompMin: true,
        benefitsPressures: true,
        benefitsPressureOtherText: true,
      },
    }),
    getMoodHistory(candidateId),
    getSentimentAlert(candidateId),
    getVisibilityComfortTrend(candidateId),
    prisma.weeklySprint.findFirst({
      where: { candidateId, visibilityComfort: { not: null } },
      orderBy: { weekStartDate: 'desc' },
      select: { visibilityComfort: true },
    }),
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
    getSelfAwarenessFlags(candidateId),
  ])

  return {
    moodHistory,
    sentimentAlert,
    marketRealityTrend: marketRealitySnapshots as unknown as TrendSnapshot[],
    publicDisclosureComfortLabel: candidate.publicDisclosureComfort
      ? (PUBLIC_DISCLOSURE_COMFORT_OPTIONS.find((o) => o.value === candidate.publicDisclosureComfort)?.label ?? null)
      : null,
    latestWeeklyVisibilityComfortLabel: latestWeeklyVisibilityComfort?.visibilityComfort
      ? (PUBLIC_DISCLOSURE_COMFORT_OPTIONS.find((o) => o.value === latestWeeklyVisibilityComfort.visibilityComfort)?.label ?? null)
      : null,
    visibilityComfortTrend,
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
    selfAwarenessFlags,
    financialPressureContext:
      candidate.benefitsPressures.length > 0
        ? candidate.benefitsPressures
            .map((p) => (p === 'OTHER' && candidate.benefitsPressureOtherText ? candidate.benefitsPressureOtherText : benefitsPressureLabel(p)))
            .join(', ')
        : null,
    jobFitHistory: surfacedJobs,
    coachingOnboardingAnswers,
  }
}
