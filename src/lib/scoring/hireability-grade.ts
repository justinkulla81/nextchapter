// The Market Reality Grade and Search Action Grade — replace the single
// numeric Hireability Score display with two named, separately-meaningful
// grades:
//
//   Market Reality Grade — an honest read on current market position,
//                           including factors the candidate cannot control
//                           (experience, market demand, how big a leap their
//                           target is).
//   Search Action Grade  — how well they're running the search they're
//                           capable of running. Everyone can bring this one
//                           to an A.
//
// Both are A-F. Each Market Reality dimension carries a fixed factor-type
// label (controllable / influenceable / structural) — the label itself is
// what tells the candidate where to spend effort, not the grade alone.
//
// This reuses the existing sub-score building blocks in employability-score.ts
// (references, work samples, resume analysis, action-plan confirmations,
// etc.) regrouped into the new framework — it is not a relabel of one
// number, each dimension/engine is computed from its own real signals.

import 'server-only'
import type {
  CandidateProfile,
  CoachingFocus,
  JobPosting,
  LinkedInActivityLog,
  Reference,
  Resume,
  SurfacedJob,
  WorkHistoryEntry,
  WorkSample,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getMarketConditions } from '@/lib/market'
import { isVagueTargetRole } from '@/lib/constants/onboarding'
import { difficultyLevelToIntensityScore } from '@/lib/scoring/search-intensity'
import { getCurrentWeekSprint, getMondayOfWeek, type CommittedAction } from '@/lib/weekly/sprint'
import {
  pointsNeededForA,
  gradeForWeeklyPoints,
  engineForActionType,
  type SearchExecutionEngineKey,
} from '@/lib/weekly/action-effort'
import {
  scoreToGrade,
  CATEGORY_MINIMUM_ENFORCED_FROM_WEEK,
  CATEGORY_MINIMUM_SCORE_FLOOR,
  type ConfidenceLevel,
  type MarketRealityDimension,
  type SearchExecutionEngine,
  type HireabilityGrade,
  type Grade,
} from '@/lib/scoring/grade'

export type { Grade, FactorType, MarketRealityDimension, SearchExecutionEngine, HireabilityGrade } from '@/lib/scoring/grade'
export { scoreToGrade, GRADE_LABEL, type ConfidenceLevel } from '@/lib/scoring/grade'

export type CandidateWithGradeRelations = CandidateProfile & {
  references: Reference[]
  workSamples: WorkSample[]
  workHistory: WorkHistoryEntry[]
  linkedInActivityLogs: LinkedInActivityLog[]
  jobPostings: JobPosting[]
  resumes: Resume[]
  communityPosts: { createdAt: Date }[]
  surfacedJobs: Pick<SurfacedJob, 'reaction'>[]
  _count: { weeklySprints: number }
  coach: { focus: CoachingFocus } | null
}

// How much real signal backs each Market Reality dimension — separate from
// the grade itself. "Job reactions" (Interested/Not Interested/Unsure on
// surfaced postings, from the Job Discovery Engine) are the clearest signal
// of a candidate's real, revealed preferences, so several dimensions grow
// more confident as that count grows.
function getDimensionConfidence(
  dimension: MarketRealityDimension['key'],
  candidate: CandidateWithGradeRelations,
  jobReactionsCount: number
): ConfidenceLevel {
  switch (dimension) {
    case 'experienceMatch':
      // Based on verifiable resume/profile data — high confidence from day 1.
      return 'HIGH'

    case 'marketPosition':
      // Improves with a stated comp floor plus enough job reactions to know
      // the candidate is actually engaging with real postings.
      return candidate.targetCompMin && jobReactionsCount >= 5
        ? 'HIGH'
        : candidate.targetCompMin
          ? 'BUILDING'
          : 'PROVISIONAL'

    case 'targetComplexity':
      // Improves as job reactions reveal what the candidate actually goes for.
      return jobReactionsCount >= 10 ? 'HIGH' : jobReactionsCount >= 3 ? 'BUILDING' : 'PROVISIONAL'

    case 'presentation':
      // High once both a resume and a LinkedIn URL are on file.
      return candidate.resumes.length > 0 && candidate.linkedInUrl ? 'HIGH' : 'BUILDING'

    case 'socialProof':
      // Always building — there's no ceiling, you can always add more proof.
      return 'BUILDING'

    case 'searchStrategy':
      // Revealed by actual behavior (reactions) over time, not self-report.
      return jobReactionsCount >= 10 ? 'HIGH' : jobReactionsCount >= 3 ? 'BUILDING' : 'PROVISIONAL'
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

// A loose token-overlap check — no NLP available, but this is enough to
// distinguish "same function" from "clearly different function" for the
// Target Complexity dimension without false precision.
function looselyMatches(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  const [na, nb] = [normalize(a), normalize(b)]
  if (!na || !nb) return false
  if (na.includes(nb) || nb.includes(na)) return true
  const wordsA = new Set(na.split(/\s+/).filter((w) => w.length > 3))
  const wordsB = nb.split(/\s+/).filter((w) => w.length > 3)
  return wordsB.some((w) => wordsA.has(w))
}

export async function computeMarketRealityDimensions(
  candidate: CandidateWithGradeRelations
): Promise<MarketRealityDimension[]> {
  const jobReactionsCount = candidate.surfacedJobs.filter((j) => j.reaction !== null).length
  const confidenceFor = (key: MarketRealityDimension['key']) =>
    getDimensionConfidence(key, candidate, jobReactionsCount)

  // 1. Experience Match — mix of structural/influenceable
  let experienceMatch = 0
  if (candidate.yearsExperience !== null) experienceMatch += 40
  if (candidate.highestLevelReached) experienceMatch += 20
  if (candidate.resumeLatestJobTitle) experienceMatch += 20
  if (looselyMatches(candidate.primaryFunction, candidate.targetRoleType)) experienceMatch += 20
  experienceMatch = clamp(experienceMatch)

  // 2. Market Position — mostly structural, driven by real BLS/Adzuna data
  // where available; a neutral default when no market data exists rather
  // than penalizing candidates in under-covered locations/functions.
  let marketPosition = 60
  const marketConditions = await getMarketConditions({
    roleType: candidate.targetRoleType,
    primaryFunction: candidate.primaryFunction,
    city: candidate.currentCity,
    state: candidate.currentState,
  })
  if (marketConditions.dataAvailable) {
    marketPosition = 55
    if (marketConditions.adzunaCount !== null) {
      marketPosition += Math.min(marketConditions.adzunaCount / 10, 25)
    }
    if (marketConditions.blsYoyChangePct !== null) {
      marketPosition += Math.max(-20, Math.min(marketConditions.blsYoyChangePct * 4, 20))
    }
  }
  marketPosition = clamp(marketPosition)

  // 3. Target Complexity — structural. Same function + same industry is the
  // baseline; a pivot on either axis raises the bar, both axes is hardest.
  let targetComplexity: number
  if (isVagueTargetRole(candidate.targetRoleType)) {
    targetComplexity = 60 // no named target yet — can't grade the leap
  } else {
    const sameFunction = looselyMatches(candidate.primaryFunction, candidate.targetRoleType)
    const sameIndustry =
      candidate.targetIndustries.length === 0 ||
      (candidate.industryContext !== null &&
        candidate.targetIndustries.some((ind) => looselyMatches(ind, candidate.industryContext)))
    if (sameFunction && sameIndustry) targetComplexity = 90
    else if (sameFunction || sameIndustry) targetComplexity = 70
    else targetComplexity = 45
  }
  targetComplexity = clamp(targetComplexity)

  // 4. Presentation — controllable, high leverage
  let presentation = 0
  const latestResume = candidate.resumes[0]
  if (latestResume) {
    const resumeAvg =
      ((latestResume.atsScore ?? 0) + (latestResume.resultsScore ?? 0) + (latestResume.experienceScore ?? 0)) / 3
    presentation += resumeAvg * 0.5
  }
  if (candidate.linkedInUrl) presentation += 20
  const narrativeParts = [candidate.part1Complete, candidate.part3Complete, candidate.part4Complete].filter(
    Boolean
  ).length
  presentation += narrativeParts * 8
  if (candidate.knownFor) presentation += 6
  presentation = clamp(presentation)

  // 5. Social Proof — controllable, high leverage
  let socialProof = 0
  const completedRefs = candidate.references.filter((r) => r.status === 'COMPLETED')
  socialProof += Math.min(completedRefs.length * 20, 60)
  socialProof += Math.min(candidate.workSamples.length * 15, 30)
  socialProof += completedRefs.length >= 2 ? 10 : 0
  socialProof = clamp(socialProof)

  // 6. Search Strategy — controllable, highest leverage. How they're
  // looking, not just what for: flexibility, honest engagement, motivation.
  let searchStrategy = 0
  const intensityScore = difficultyLevelToIntensityScore(candidate.jobSearchDifficultyLevel)
  if (intensityScore !== null) searchStrategy += intensityScore * 0.35
  if (candidate.networkingListSubmittedAt) searchStrategy += 20
  if (candidate.askedForHelpAt) searchStrategy += 15
  const flexibilityCount = [candidate.willingToStartLower, candidate.compFlexible, candidate.openToRelocation].filter(
    Boolean
  ).length
  searchStrategy += flexibilityCount * 10
  searchStrategy = clamp(searchStrategy)

  return [
    {
      key: 'experienceMatch',
      label: 'Experience Match',
      score: experienceMatch,
      grade: scoreToGrade(experienceMatch),
      factorType: 'influenceable',
      confidence: confidenceFor('experienceMatch'),
    },
    {
      key: 'marketPosition',
      label: 'Market Position',
      score: marketPosition,
      grade: scoreToGrade(marketPosition),
      factorType: 'structural',
      confidence: confidenceFor('marketPosition'),
    },
    {
      key: 'targetComplexity',
      label: 'Target Complexity',
      score: targetComplexity,
      grade: scoreToGrade(targetComplexity),
      factorType: 'structural',
      confidence: confidenceFor('targetComplexity'),
    },
    {
      key: 'presentation',
      label: 'Presentation',
      score: presentation,
      grade: scoreToGrade(presentation),
      factorType: 'controllable',
      confidence: confidenceFor('presentation'),
    },
    {
      key: 'socialProof',
      label: 'Social Proof',
      score: socialProof,
      grade: scoreToGrade(socialProof),
      factorType: 'controllable',
      confidence: confidenceFor('socialProof'),
    },
    {
      key: 'searchStrategy',
      label: 'Search Strategy',
      score: searchStrategy,
      grade: scoreToGrade(searchStrategy),
      factorType: 'controllable',
      confidence: confidenceFor('searchStrategy'),
    },
  ]
}

// Search Action Grade is now driven by real Weekly Search Score points
// earned this week (1 point = 1 minute), not a lifetime profile-completeness
// proxy —
// each of the four engines sums the points of *completed* committed actions
// that map to it (see engineForActionType), and each engine's 0-100 score is
// its share of points relative to a proportional quarter of the week's
// overall ramp target, so a candidate can't max the headline grade by
// stacking one engine while leaving the other three untouched.
async function computeSearchExecutionEngines(
  candidateId: string,
  weekNumber: number
): Promise<{ engines: SearchExecutionEngine[]; weeklyPoints: number; weeklyPointsTarget: number }> {
  const weeklyPointsTarget = pointsNeededForA(weekNumber)
  const perEngineTarget = weeklyPointsTarget / 4

  const sprint = await getCurrentWeekSprint(candidateId)
  const committedActions = sprint ? (sprint.committedActions as unknown as CommittedAction[]) : []

  const pointsByEngine: Record<SearchExecutionEngineKey, number> = {
    learning: 0,
    effort: 0,
    working: 0,
    connecting: 0,
  }

  for (const action of committedActions) {
    if (!action.completed) continue
    const engine = engineForActionType(action.actionType)
    pointsByEngine[engine] += action.points
  }

  const weeklyPoints = Object.values(pointsByEngine).reduce((sum, p) => sum + p, 0)

  const label: Record<SearchExecutionEngineKey, string> = {
    learning: 'Learning',
    effort: 'Effort',
    working: 'Working',
    connecting: 'Connecting',
  }

  const engines: SearchExecutionEngine[] = (['learning', 'effort', 'working', 'connecting'] as const).map(
    (key) => {
      const score = perEngineTarget > 0 ? clamp((pointsByEngine[key] / perEngineTarget) * 100) : 0
      return { key, label: label[key], score, grade: scoreToGrade(score) }
    }
  )

  return { engines, weeklyPoints, weeklyPointsTarget }
}

// Did the candidate earn an A the calendar week immediately before the
// current one? Recomputed directly from that week's WeeklySprint rather than
// read back from a HireabilityReport snapshot, since reports aren't
// generated on a strict weekly cadence — this stays accurate regardless of
// when/whether a report happened to be generated that week.
async function hadPriorWeekA(candidateId: string, weekNumber: number): Promise<boolean> {
  if (weekNumber <= 1) return false

  const priorMonday = getMondayOfWeek(new Date())
  priorMonday.setUTCDate(priorMonday.getUTCDate() - 7)

  const priorSprint = await prisma.weeklySprint.findUnique({
    where: { candidateId_weekStartDate: { candidateId, weekStartDate: priorMonday } },
  })
  if (!priorSprint) return false

  const priorActions = priorSprint.committedActions as unknown as CommittedAction[]
  const priorPoints = priorActions.filter((a) => a.completed).reduce((sum, a) => sum + a.points, 0)
  const priorTarget = pointsNeededForA(weekNumber - 1)

  return gradeForWeeklyPoints(priorPoints, priorTarget) === 'A'
}

export async function computeHireabilityGrade(
  candidate: CandidateWithGradeRelations
): Promise<HireabilityGrade> {
  const dimensions = await computeMarketRealityDimensions(candidate)
  const weekNumber = candidate._count.weeklySprints + 1
  const { engines, weeklyPoints, weeklyPointsTarget } = await computeSearchExecutionEngines(
    candidate.id,
    weekNumber
  )

  const marketRealityScore = clamp(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length)

  // Executive Coach bonus (+25% recognized points) and a universal
  // consistency bonus (+10%, anyone coming off an A week) stack additively
  // and apply only to the grade-from-points calculation below — the raw
  // weeklyPoints figure (and each engine's own score) stays unboosted, so
  // "real effort" and "recognized score" stay distinguishable in the UI.
  const hasExecutiveCoach = candidate.coach?.focus === 'EXECUTIVE'
  const hadAGradeLastWeek = await hadPriorWeekA(candidate.id, weekNumber)
  const bonusMultiplier = 1 + (hasExecutiveCoach ? 0.25 : 0) + (hadAGradeLastWeek ? 0.1 : 0)
  const recognizedWeeklyPoints = Math.round(weeklyPoints * bonusMultiplier)

  const searchExecutionGradeFromPoints = gradeForWeeklyPoints(recognizedWeeklyPoints, weeklyPointsTarget)

  const laggingEngines = engines.filter((e) => e.score < CATEGORY_MINIMUM_SCORE_FLOOR).map((e) => e.key)
  const categoryMinimumsMet =
    candidate._count.weeklySprints < CATEGORY_MINIMUM_ENFORCED_FROM_WEEK || laggingEngines.length === 0

  let searchExecutionGrade = searchExecutionGradeFromPoints
  if (!categoryMinimumsMet && searchExecutionGrade === 'A') {
    searchExecutionGrade = 'B'
  }

  const searchExecutionScore = clamp(engines.reduce((sum, e) => sum + e.score, 0) / engines.length)

  return {
    marketReality: {
      score: marketRealityScore,
      grade: scoreToGrade(marketRealityScore),
      dimensions,
    },
    searchExecution: {
      score: searchExecutionScore,
      grade: searchExecutionGrade,
      engines,
      categoryMinimumsMet,
      laggingEngines,
      weeklyPoints,
      weeklyPointsTarget,
      bonusMultiplier,
      hasExecutiveCoach,
      hadPriorWeekA: hadAGradeLastWeek,
      recognizedWeeklyPoints,
    },
  }
}

export const GRADE_RELATIONS_INCLUDE = {
  references: true,
  workSamples: true,
  workHistory: true,
  linkedInActivityLogs: true,
  jobPostings: true,
  resumes: { orderBy: { uploadedAt: 'desc' as const } },
  communityPosts: { where: { isActive: true } },
  surfacedJobs: { select: { reaction: true } },
  _count: { select: { weeklySprints: true } },
  coach: { select: { focus: true } },
} as const

// Single-candidate convenience wrapper for the three A-grade gates
// (recruiter visibility snapshot check aside, which uses stored report
// snapshots instead — see the match-inbox query — this is for the two
// gates that need a live, current-standing check on one candidate: the
// bounty claim submission gate and the Exclusive Jobs unlock check).
export async function getCurrentSearchActionGrade(candidateId: string): Promise<Grade> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: GRADE_RELATIONS_INCLUDE,
  })
  const grade = await computeHireabilityGrade(candidate as unknown as CandidateWithGradeRelations)
  return grade.searchExecution.grade
}
