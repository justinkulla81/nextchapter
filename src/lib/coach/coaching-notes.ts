import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Mood } from '@prisma/client'
import { getMoodHistory, getSentimentAlert, type SentimentAlert } from '@/lib/daily/mood'
import { getVisibilityComfortTrend, type VisibilityComfortTrend } from '@/lib/weekly/visibility-sentiment'
import { detectAvoidancePattern, type AvoidancePattern } from '@/lib/coach/pre-session-brief'
import {
  PUBLIC_DISCLOSURE_COMFORT_OPTIONS,
  REFERRAL_RECENCY_OPTIONS,
  LOCATION_PREFERENCE_OPTIONS,
  COMPANY_STAGE_OPTIONS,
  TRADEOFF_PRIORITIES,
} from '@/lib/constants/onboarding'
import {
  getCoachingOnboardingAnswersForDisplay,
  type CoachingOnboardingAnswerDisplay,
} from '@/lib/coach/onboarding-form'
import {
  getConfidentialDisclosureForDisplay,
  type ConfidentialDisclosureDisplay,
} from '@/lib/coach/confidential-disclosure'
import type { TrendSnapshot } from '@/components/dashboard/MarketRealityTrendChart'
import { benefitsPressureLabel } from '@/lib/benefits/pressure-options'
import {
  computeCategoryGrades,
  GRADE_RELATIONS_INCLUDE,
  type CandidateWithGradeRelations,
} from '@/lib/scoring/dossier-competencies'
import { summarizeSelfAwareness } from '@/lib/scoring/self-awareness'
import { getVisibilityCalibration, type VisibilityCalibration } from '@/lib/coach/visibility-calibration'
import type { ApplicationTrendsResult } from '@/lib/network/application-trends'
import { getAnonymizedReferenceBreakdown, type ReferenceBreakdown } from '@/lib/coach/reference-breakdown'
import { getJobActivityBreakdown, type JobActivityBreakdown } from '@/lib/coach/job-activity'
import { getSearchStrategyDiagnosis, type SearchPatternFlag } from '@/lib/coach/search-strategy-diagnosis'
import { BLOCKER_OPTIONS, MOTIVATIONS_OPTIONS } from '@/lib/constants/onboarding'

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

export interface AppliedJobEntry {
  title: string | null
  companyName: string | null
  appliedAt: Date
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

// How receptive this candidate seems to picking up new skills — combines
// their own self-report (learnedNewSkillsLevel, from the Circumstances
// form) with real evidence of learning behavior (resume-extracted
// certifications, in-platform LearningBadge activity). Real evidence is
// weighted at least as heavily as the self-report, same calibration
// instinct as summarizeSelfAwareness/getVisibilityCalibration elsewhere in
// this file — a candidate who says "not yet" but holds two certifications
// is more open to learning than their own answer suggests, and a bare
// "actively learning" self-report with no corroborating evidence reads as
// Moderate rather than High until something backs it up. Null when there's
// no signal at all (no self-report answer, no certifications, no badges).
export interface OpennessToLearning {
  label: 'High' | 'Moderate' | 'Limited'
  detail: string
}

async function getOpennessToLearning(candidateId: string): Promise<OpennessToLearning | null> {
  const [candidate, learningBadgeCount] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: { learnedNewSkillsLevel: true, certifications: true },
    }),
    prisma.learningBadge.count({ where: { candidateId } }),
  ])

  if (candidate.learnedNewSkillsLevel === null && candidate.certifications.length === 0 && learningBadgeCount === 0) {
    return null
  }

  const selfReportText =
    candidate.learnedNewSkillsLevel === 3
      ? 'Says they are actively learning new skills.'
      : candidate.learnedNewSkillsLevel === 2
        ? 'Says they have picked up a little something new recently.'
        : candidate.learnedNewSkillsLevel === 1
          ? 'Says they have not learned anything new recently.'
          : null

  const evidenceParts: string[] = []
  if (candidate.certifications.length > 0) {
    evidenceParts.push(
      `resume lists ${candidate.certifications.length} certification${candidate.certifications.length === 1 ? '' : 's'} (${candidate.certifications.join(', ')})`
    )
  }
  if (learningBadgeCount > 0) {
    evidenceParts.push(`${learningBadgeCount} logged learning ${learningBadgeCount === 1 ? 'activity' : 'activities'} on the platform`)
  }
  const evidenceText = evidenceParts.length > 0 ? `Real evidence: ${evidenceParts.join('; ')}.` : null

  const selfReportScore = candidate.learnedNewSkillsLevel === 3 ? 2 : candidate.learnedNewSkillsLevel === 2 ? 1 : 0
  const evidenceScore = (candidate.certifications.length > 0 ? 1 : 0) + (learningBadgeCount > 0 ? 1 : 0)
  const total = selfReportScore + evidenceScore
  const label: OpennessToLearning['label'] = total >= 3 ? 'High' : total >= 1 ? 'Moderate' : 'Limited'

  return { label, detail: [selfReportText, evidenceText].filter(Boolean).join(' ') }
}

// Flexibility signals a coach can lean on when negotiating scope with the
// candidate ("would you consider...") — pulled from the same onboarding
// Goals/Search Strategy fields the candidate already answered, not
// re-collected here. Every sub-object is present even when the candidate
// has given no signal in that category (booleans default false at the
// schema level once they've completed onboarding), so the panel always
// renders the full shape; only priorityRanking is conditionally empty.
export interface FlexibilitySummary {
  titleLevel: { current: string | null; willingToStartLower: boolean; startLowerRationale: string | null }
  jobFunction: { primary: string | null; target: string | null; secondary: string | null; isPivoting: boolean }
  industry: { primary: string | null; secondary: string | null; targetIndustries: string[] }
  location: { preferenceLabel: string | null; openToRelocation: boolean; relocationNotes: string | null }
  compensation: { flexible: boolean; equityImportant: boolean }
  company: { sizeLabel: string | null; stageLabel: string | null }
  // Forced Tradeoff Rankings, sorted most-important-first — empty until the
  // candidate has ranked at least one (onboarding Goals step).
  priorityRanking: { label: string; rank: number }[]
}

// Non-negotiables a coach needs to know before spending time on a role that
// was never going to work. Unlike FlexibilitySummary above (always present),
// this list only includes items where a real constraint is detected — no
// row for "not open to relocating" when the candidate hasn't said so.
export interface RedLine {
  label: string
  detail: string
}

// The remaining Search Strategy fields with no other coach-facing home —
// how hard they're pushing volume-wise, what they think they're missing,
// and whether they'd take interim work in the meantime.
export interface SearchPlan {
  applicationVolumeGoal: number | null
  skillsToBuild: string[]
  interimConsultingInterest: boolean
}

// Personal Context: Blockers + Motivations (Prompt 47 rework) — coaching
// context and Victoria tone calibration only, per the schema's own comment
// ("read only by getCoachingNotes"). Never read by dossier-sections.ts —
// see that file's exclusion comment. Null when the candidate hasn't
// answered PersonalContextForm at all yet.
export interface PersonalContext {
  blockerLabels: string[]
  blockersOpenText: string | null
  consistencySelfRating: number | null
  motivationLabels: string[]
  motivationsElaboration: string | null
}

function buildPersonalContext(candidate: {
  blockers: string[]
  blockersOpenText: string | null
  consistencySelfRating: number | null
  motivations: string[]
  motivationsElaboration: string | null
}): PersonalContext | null {
  if (
    candidate.blockers.length === 0 &&
    !candidate.blockersOpenText &&
    candidate.consistencySelfRating === null &&
    candidate.motivations.length === 0 &&
    !candidate.motivationsElaboration
  ) {
    return null
  }
  return {
    blockerLabels: candidate.blockers.map((v) => BLOCKER_OPTIONS.find((o) => o.value === v)?.label ?? v),
    blockersOpenText: candidate.blockersOpenText,
    consistencySelfRating: candidate.consistencySelfRating,
    motivationLabels: candidate.motivations.map((v) => MOTIVATIONS_OPTIONS.find((o) => o.value === v)?.label ?? v),
    motivationsElaboration: candidate.motivationsElaboration,
  }
}

function buildFlexibilitySummary(candidate: {
  targetRoleType: string | null
  willingToStartLower: boolean
  startLowerRationale: string | null
  primaryFunction: string | null
  targetFunction: string | null
  secondaryFunction: string | null
  isPivoting: boolean
  industryContext: string | null
  secondaryIndustryContext: string | null
  targetIndustries: string[]
  remotePreference: string | null
  openToRelocation: boolean
  relocationNotes: string | null
  compFlexible: boolean
  equityImportant: boolean
  targetCompanySize: string | null
  targetCompanyStage: string | null
  priorityMaxComp: number | null
  priorityBrandName: number | null
  priorityJobSecurity: number | null
  priorityWorkLife: number | null
  priorityMission: number | null
}): FlexibilitySummary {
  const priorityValues: Record<string, number | null> = {
    priorityMaxComp: candidate.priorityMaxComp,
    priorityBrandName: candidate.priorityBrandName,
    priorityJobSecurity: candidate.priorityJobSecurity,
    priorityWorkLife: candidate.priorityWorkLife,
    priorityMission: candidate.priorityMission,
  }
  const priorityRanking: { label: string; rank: number }[] = TRADEOFF_PRIORITIES.map((p) => ({
    label: p.label as string,
    rank: priorityValues[p.key],
  }))
    .filter((p) => p.rank !== null)
    .map((p) => ({ label: p.label, rank: p.rank as number }))
    .sort((a, b) => a.rank - b.rank)

  return {
    titleLevel: {
      current: candidate.targetRoleType,
      willingToStartLower: candidate.willingToStartLower,
      startLowerRationale: candidate.startLowerRationale,
    },
    jobFunction: {
      primary: candidate.primaryFunction,
      target: candidate.targetFunction,
      secondary: candidate.secondaryFunction,
      isPivoting: candidate.isPivoting,
    },
    industry: {
      primary: candidate.industryContext,
      secondary: candidate.secondaryIndustryContext,
      targetIndustries: candidate.isPivoting ? candidate.targetIndustries : [],
    },
    location: {
      preferenceLabel: candidate.remotePreference
        ? (LOCATION_PREFERENCE_OPTIONS.find((o) => o.value === candidate.remotePreference)?.label ?? candidate.remotePreference)
        : null,
      openToRelocation: candidate.openToRelocation,
      relocationNotes: candidate.relocationNotes,
    },
    compensation: { flexible: candidate.compFlexible, equityImportant: candidate.equityImportant },
    company: {
      sizeLabel: candidate.targetCompanySize ? (candidate.targetCompanySize === 'Any' ? 'Any size' : candidate.targetCompanySize) : null,
      stageLabel: candidate.targetCompanyStage
        ? (COMPANY_STAGE_OPTIONS.find((o) => o.value === candidate.targetCompanyStage)?.label ?? candidate.targetCompanyStage)
        : null,
    },
    priorityRanking,
  }
}

// Flags when the candidate's stated minimum acceptable comp sits well below
// their last salary — worth a coach's eye because it can mean the past
// salary was inflated, or that the candidate is more willing (or
// desperate) to move lower than they're letting on elsewhere. Checked
// against compFlexible/willingToStartLower — the closest thing to a
// calibrating question already on file — so a coach sees at a glance
// whether the gap is consistent with what the candidate said, or a
// contradiction worth raising in session.
export interface SalaryGapFlag {
  lastSalary: number
  targetCompMin: number
  gapPercent: number
  consistentWithStatedFlexibility: boolean
}

// targetCompMin at or below 85% of lastSalary counts as a "big gap" —
// arbitrary but conservative; a 5-10% haircut is normal negotiation room,
// not a signal.
const SALARY_GAP_THRESHOLD = 0.85

function buildSalaryGapFlag(candidate: {
  lastSalary: number | null
  targetCompMin: number | null
  compFlexible: boolean
  willingToStartLower: boolean
}): SalaryGapFlag | null {
  const { lastSalary, targetCompMin } = candidate
  if (!lastSalary || !targetCompMin || targetCompMin > lastSalary * SALARY_GAP_THRESHOLD) return null
  return {
    lastSalary,
    targetCompMin,
    gapPercent: Math.round((1 - targetCompMin / lastSalary) * 100),
    consistentWithStatedFlexibility: candidate.compFlexible || candidate.willingToStartLower,
  }
}

const WORK_AUTHORIZATION_RED_LINE_LABEL: Record<string, string> = {
  h1b: 'H-1B',
  opt: 'OPT / STEM OPT',
  tn: 'TN',
  other: 'other visa',
}

function buildRedLines(candidate: {
  openToRelocation: boolean
  remotePreference: string | null
  currentCity: string | null
  currentState: string | null
  workAuthorization: string | null
  visaStatus: string | null
  dealBreakers: string | null
}): RedLine[] {
  const redLines: RedLine[] = []

  if (!candidate.openToRelocation) {
    const location = [candidate.currentCity, candidate.currentState].filter(Boolean).join(', ')
    redLines.push({
      label: 'Location',
      detail:
        candidate.remotePreference === 'onsite'
          ? `Not open to relocating — needs an on-site role${location ? ` in ${location}` : ''}.`
          : `Not open to relocating${location ? ` (currently based in ${location})` : ''}.`,
    })
  }

  if (candidate.workAuthorization === 'need_sponsorship') {
    const visaLabel = candidate.visaStatus && candidate.visaStatus !== 'not_applicable'
      ? (WORK_AUTHORIZATION_RED_LINE_LABEL[candidate.visaStatus] ?? candidate.visaStatus)
      : null
    redLines.push({
      label: 'Work authorization',
      detail: `Will need visa sponsorship${visaLabel ? ` (${visaLabel})` : ''} — many employers won't sponsor.`,
    })
  }

  if (candidate.dealBreakers && candidate.dealBreakers.trim().length > 0) {
    redLines.push({ label: 'In their own words', detail: candidate.dealBreakers.trim() })
  }

  return redLines
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
  salaryGapFlag: SalaryGapFlag | null
  gapAnalysis: { targetRole: string; gaps: GapAnalysisGap[] } | null
  avoidancePattern: AvoidancePattern | null
  selfAwarenessFlags: SelfAwarenessFlag[]
  financialPressureContext: string | null
  jobFitHistory: JobFitHistoryEntry[]
  // Jobs the candidate reacted "Interested" to — a callout of the more
  // notable subset of jobFitHistory above, so a coach/recruiter doesn't
  // have to scan the full reaction list to see what caught their eye.
  interestedJobs: JobFitHistoryEntry[]
  // Companies the candidate applied to directly (manual fit-check flow or
  // detected from a confirmation email) — names and roles a recruiter
  // should know the candidate is actively pursuing.
  appliedJobs: AppliedJobEntry[]
  // Company Tracker watchlist — companies the candidate named as places
  // they'd want to work, regardless of whether we have an open role there.
  watchedCompanies: string[]
  // What's My Pattern, read from the most recent Market Reality Report
  // (already generated there) rather than re-run here — this view can be
  // opened often and shouldn't trigger its own LLM call. Null until a
  // report has been generated, or until the candidate has enough signal.
  jobSearchPatternSummary: string | null
  // Same "read from the persisted report, don't recompute" rule as
  // jobSearchPatternSummary above — see application-trends.ts. Null until a
  // report has been generated with enough applications to be eligible.
  applicationTrends: ApplicationTrendsResult | null
  // Prompt 60 — the candidate's Coaching Onboarding Form answers, once
  // submitted. Null until they've completed it.
  coachingOnboardingAnswers: CoachingOnboardingAnswerDisplay[] | null
  // The optional confidential disclosure (ConfidentialDisclosureForm),
  // submitted right after the Coaching Onboarding Form above. Coach-only —
  // never shown in the Dossier or back to the candidate. Null until
  // they've answered the question at all; see getConfidentialDisclosureForDisplay.
  confidentialDisclosure: ConfidentialDisclosureDisplay | null
  // How much the candidate says they like being visible (content,
  // networking) versus how much they've actually done recently — feeds a
  // coach's help building the candidate's own Marketing Plan.
  visibilityCalibration: VisibilityCalibration
  // How receptive the candidate seems to picking up new skills — see
  // getOpennessToLearning above for how self-report and real evidence are
  // combined. Null when there's no signal at all yet.
  opennessToLearning: OpennessToLearning | null
  // Where the candidate has said they'd bend — title/level, function,
  // industry, location, comp, company size/stage, and their own ranked
  // tradeoff priorities. See buildFlexibilitySummary.
  flexibility: FlexibilitySummary
  // Non-negotiables worth knowing before spending time on a role that was
  // never going to work — see buildRedLines.
  redLines: RedLine[]
  // Applications-per-week goal, self-identified skill gaps, and openness to
  // interim/consulting work — the Search Strategy fields with no other
  // coach-facing home.
  searchPlan: SearchPlan
  // Every completed reference's answers, pooled by category/section rather
  // than grouped by reviewer — see getAnonymizedReferenceBreakdown for why
  // (referee anonymity). Null until at least one reference has completed.
  referenceBreakdown: ReferenceBreakdown | null
  // Practical constraints (blockers) and what's driving the search
  // (motivations) — captured on Profile > Personal Context, coach-only, never
  // in the Executive Dossier. Null until the candidate has answered any part
  // of that form. See buildPersonalContext.
  personalContext: PersonalContext | null
  // Full all-time job-search activity: applications, rejections, interviews,
  // offers, networking outreach, calendar meetings, follow-ups made/pending,
  // and which applied jobs have a Support Network connection attached. See
  // getJobActivityBreakdown — the coach-facing, all-time counterpart to the
  // candidate-facing weekly outcomes.
  jobActivity: JobActivityBreakdown
  // Deterministic, no-LLM pattern flags (applying-without-interviews,
  // apply/network imbalance, scattershot targeting, company repeats) — see
  // search-strategy-diagnosis.ts. Safe to compute on every view.
  searchPatternFlags: SearchPatternFlag[]
}

export async function getCoachingNotes(candidateId: string): Promise<CoachingNotes> {
  const [candidate, moodHistory, sentimentAlert, visibilityComfortTrend, latestWeeklyVisibilityComfort, marketRealitySnapshots, avoidancePattern, latestReport, surfacedJobs, coachingOnboardingAnswers, confidentialDisclosure, selfAwarenessFlags, visibilityCalibration, appliedJobs, watchlistEntries, opennessToLearning, referenceBreakdown, jobActivity, searchPatternFlags] = await Promise.all([
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
        targetRoleType: true,
        willingToStartLower: true,
        startLowerRationale: true,
        primaryFunction: true,
        targetFunction: true,
        secondaryFunction: true,
        isPivoting: true,
        industryContext: true,
        secondaryIndustryContext: true,
        targetIndustries: true,
        remotePreference: true,
        openToRelocation: true,
        relocationNotes: true,
        compFlexible: true,
        equityImportant: true,
        targetCompanySize: true,
        targetCompanyStage: true,
        priorityMaxComp: true,
        priorityBrandName: true,
        priorityJobSecurity: true,
        priorityWorkLife: true,
        priorityMission: true,
        currentCity: true,
        currentState: true,
        workAuthorization: true,
        visaStatus: true,
        dealBreakers: true,
        applicationVolumeGoal: true,
        skillsToBuild: true,
        interimConsultingInterest: true,
        blockers: true,
        blockersOpenText: true,
        consistencySelfRating: true,
        motivations: true,
        motivationsElaboration: true,
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
    prisma.marketRealityReport.findFirst({
      where: { candidateId },
      orderBy: { generatedAt: 'desc' },
      select: { gapAnalysis: true, jobSearchPattern: true },
    }),
    prisma.surfacedJob.findMany({
      where: { candidateId, reaction: { not: null } },
      orderBy: { reactedAt: 'desc' },
      select: { title: true, companyName: true, reaction: true, reactedAt: true },
      take: 50,
    }),
    getCoachingOnboardingAnswersForDisplay(candidateId),
    getConfidentialDisclosureForDisplay(candidateId),
    getSelfAwarenessFlags(candidateId),
    getVisibilityCalibration(candidateId),
    prisma.jobPosting.findMany({
      where: { candidateId, appliedAt: { not: null } },
      orderBy: { appliedAt: 'desc' },
      select: { title: true, companyName: true, appliedAt: true },
    }),
    prisma.companyWatchlistEntry.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      select: { companyName: true },
    }),
    getOpennessToLearning(candidateId),
    getAnonymizedReferenceBreakdown(candidateId),
    getJobActivityBreakdown(candidateId),
    getSearchStrategyDiagnosis(candidateId),
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
    salaryGapFlag: buildSalaryGapFlag(candidate),
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
    interestedJobs: surfacedJobs.filter((j) => j.reaction === 'INTERESTED'),
    // appliedAt is guaranteed non-null by the query's where filter above —
    // Prisma's generated type doesn't narrow on that, so assert it here.
    appliedJobs: appliedJobs.map((j) => ({ ...j, appliedAt: j.appliedAt! })),
    watchedCompanies: watchlistEntries.map((e) => e.companyName),
    jobSearchPatternSummary: latestReport
      ? ((latestReport.jobSearchPattern as unknown as { summary: string | null } | null)?.summary ?? null)
      : null,
    applicationTrends: latestReport
      ? ((latestReport.jobSearchPattern as unknown as { applicationTrends: ApplicationTrendsResult | null } | null)
          ?.applicationTrends ?? null)
      : null,
    coachingOnboardingAnswers,
    confidentialDisclosure,
    visibilityCalibration,
    opennessToLearning,
    flexibility: buildFlexibilitySummary(candidate),
    redLines: buildRedLines(candidate),
    searchPlan: {
      applicationVolumeGoal: candidate.applicationVolumeGoal,
      skillsToBuild: candidate.skillsToBuild,
      interimConsultingInterest: candidate.interimConsultingInterest,
    },
    referenceBreakdown,
    personalContext: buildPersonalContext(candidate),
    jobActivity,
    searchPatternFlags,
  }
}
