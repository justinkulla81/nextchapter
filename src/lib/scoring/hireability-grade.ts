// Scoring Model 2.0 — one Market Reality Grade, built from six categories:
//
//   Target Fit                      — real hiring demand + how well matched
//                                      and focused the candidate's target is.
//                                      Carries the old structural/market-
//                                      condition signal, now a first-class,
//                                      improvable category rather than a
//                                      caveat label on the others.
//   Leadership & Management         \
//   Skills & Execution               |  Five hiring-manager competency
//   Communication & Collaboration    |  categories — built from resume/
//   Adaptability & Change Readiness  |  self-report facts, confidence
//   Ownership & Reliability         /   sliders, and reference BARS ratings
//                                       where available.
//
// Weekly effort (Networking/Learning/Working, plus raw Effort points) is an
// INPUT to the one grade — a bounded, non-compounding nudge on top of a
// persisted per-category baseline — not a second grade of its own.
//
// Working Style (the How I Work Best assessment) is deliberately NOT used
// to compute any category's numeric score. Its 9 dimensions are ipsative
// style poles (e.g. "async & written" vs "sync & verbal," "protects 40
// hours" vs "whatever it takes") — neither pole is objectively better, and
// assessment-vectors.ts explicitly documents that these vectors are valid
// only for within-candidate profile shape, never for comparing candidates
// against each other. Working Style stays exactly what the codebase
// already treats it as: a narrative/fit signal (Dossier "friction
// surfaces," self-awareness comparisons) — never a scoring input here.
//
// This reuses the existing sub-score building blocks (references, work
// samples, resume analysis, market data, action-plan confirmations) — it is
// not a relabel of one number; each category is computed from its own real
// signals.

import 'server-only'
import type {
  CandidateAssessmentResponse,
  CandidateProfile,
  CoachingFocus,
  JobPosting,
  LinkedInActivityLog,
  PrivacyTier,
  Reference,
  Resume,
  SurfacedJob,
  WorkHistoryEntry,
  WorkSample,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getMarketConditions } from '@/lib/market'
import { isVagueTargetRole } from '@/lib/constants/onboarding'
import { getSelfAwarenessRead, type SelfAwarenessInputs } from '@/lib/scoring/self-awareness'
import { computeReferenceWeights } from '@/lib/references/collusion-check'
import { getCurrentWeekSprint, getMondayOfWeek, getCandidateWeekNumber, type CommittedAction } from '@/lib/weekly/sprint'
import { pointsNeededForA, gradeForWeeklyPoints, engineForActionType } from '@/lib/weekly/action-effort'
import {
  scoreToGrade,
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  CATEGORY_MINIMUM_ENFORCED_FROM_WEEK,
  CATEGORY_MINIMUM_SCORE_FLOOR,
  WEEKLY_ENGINE_LABEL,
  type CategoryKey,
  type ConfidenceLevel,
  type CategoryGrade,
  type WeeklyEngine,
  type WeeklyEngineKey,
  type HireabilityGrade,
  type Grade,
} from '@/lib/scoring/grade'

export type {
  Grade,
  CategoryKey,
  CategoryGrade,
  WeeklyEngine,
  WeeklyEngineKey,
  HireabilityGrade,
} from '@/lib/scoring/grade'
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
  assessmentResponses: Pick<CandidateAssessmentResponse, 'dimensionVectors' | 'completedAt'>[]
  _count: { weeklySprints: number }
  coach: { focus: CoachingFocus } | null
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

// A loose token-overlap check — no NLP available, but this is enough to
// distinguish "same function" from "clearly different function" for Target
// Fit without false precision.
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

// Average of a reference BARS field (1-5) across completed references,
// rescaled to 0-100. Returns null when no completed reference has rated
// this field yet — callers fall back to the self-report-only component and
// mark confidence/self-awareness accordingly rather than inventing a score.
//
// Field choice: the Reference model's original ratingReliability/
// ratingCommunication/ratingTeamLift/ratingWorkEthic/ratingGrowthMindset
// columns are legacy — the live reference form (src/app/ref/[token]/actions.ts)
// never writes to them. The Reference Testimony Intake (Prompt 48) trait
// fields are what's actually populated, and map more directly onto these
// categories anyway: traitFollowThroughRating is literally reliability,
// traitCollaborationRating is literally communication/collaboration,
// traitAdaptabilityRating is literally adaptability. overallRating stands
// in for skills/execution and traitPresenceRating for leadership, since
// there's no closer-matching trait for either.
function averageReferenceRating(
  references: Reference[],
  field: 'traitPresenceRating' | 'overallRating' | 'traitCollaborationRating' | 'traitAdaptabilityRating' | 'traitFollowThroughRating'
): number | null {
  const completed = references.filter((r) => r.status === 'COMPLETED')

  // Weighted, not a flat mean — near-identical reference text collapses to
  // roughly one voice (see references/collusion-check.ts). Without this, the
  // cheapest way to raise a reference-backed category is to submit the same
  // testimony several times.
  const weights = computeReferenceWeights(completed)

  const weighted = completed
    .map((r) => ({ value: r[field], weight: weights.get(r.id) ?? 1 }))
    .filter((x): x is { value: number; weight: number } => x.value !== null && x.value !== undefined)
  if (weighted.length === 0) return null

  const totalWeight = weighted.reduce((sum, x) => sum + x.weight, 0)
  if (totalWeight === 0) return null
  const avg = weighted.reduce((sum, x) => sum + x.value * x.weight, 0) / totalWeight
  return clamp(((avg - 1) / 4) * 100)
}

function completedReferenceCount(references: Reference[]): number {
  return references.filter((r) => r.status === 'COMPLETED').length
}

// How much real signal backs each category's grade today, separate from
// the grade itself. A category that leans on reference data moves from
// PROVISIONAL/BUILDING toward HIGH as completed references accumulate.
function getCategoryConfidence(
  category: CategoryKey,
  candidate: CandidateWithGradeRelations,
  jobReactionsCount: number
): ConfidenceLevel {
  const refCount = completedReferenceCount(candidate.references)
  switch (category) {
    case 'targetFit':
      return jobReactionsCount >= 10 ? 'HIGH' : jobReactionsCount >= 3 ? 'BUILDING' : 'PROVISIONAL'
    case 'leadership':
      return refCount >= 1 ? 'HIGH' : candidate.isPeopleManager !== null ? 'BUILDING' : 'PROVISIONAL'
    case 'skillsExecution':
      return refCount >= 1 ? 'HIGH' : candidate.functionSkillConfidence !== null ? 'BUILDING' : 'PROVISIONAL'
    case 'communication':
      return refCount >= 1 ? 'HIGH' : candidate.communicatorConfidence !== null ? 'BUILDING' : 'PROVISIONAL'
    case 'adaptability':
      return refCount >= 1 ? 'HIGH' : 'BUILDING'
    case 'ownership':
      return refCount >= 1 ? 'HIGH' : candidate.actionOrientedConfidence !== null ? 'BUILDING' : 'PROVISIONAL'
  }
}

export async function computeCategoryGrades(candidate: CandidateWithGradeRelations): Promise<CategoryGrade[]> {
  const jobReactionsCount = candidate.surfacedJobs.filter((j) => j.reaction !== null).length
  const refs = candidate.references
  const latestVectors = candidate.assessmentResponses[0]?.dimensionVectors as
    | Record<string, number>
    | undefined

  // ---- Target Fit — real market demand + how well matched/focused the
  // target is. Same math as the old marketPosition/targetComplexity/focus/
  // experienceMatch dimensions, now averaged into one category.
  const latestResume = candidate.resumes[0]

  // The resume's own experienceScore (gaps, tenure, alignment with stated
  // goals — see analyze-resume.ts's prompt) is a genuinely richer read on
  // the same question this heuristic is approximating, so once a resume
  // exists it's blended in rather than left unused. atsScore/resultsScore
  // are deliberately NOT here — those are about how clearly the resume
  // communicates, not whether the underlying experience fits, so they
  // belong to Communication & Collaboration instead (below).
  let experienceMatchHeuristic = 0
  if (candidate.yearsExperience !== null) experienceMatchHeuristic += 40
  if (candidate.highestLevelReached) experienceMatchHeuristic += 20
  if (candidate.resumeLatestJobTitle) experienceMatchHeuristic += 20
  if (looselyMatches(candidate.primaryFunction, candidate.targetRoleType)) experienceMatchHeuristic += 20
  experienceMatchHeuristic = clamp(experienceMatchHeuristic)
  const experienceMatch =
    latestResume?.experienceScore != null
      ? clamp(experienceMatchHeuristic * 0.5 + latestResume.experienceScore * 0.5)
      : experienceMatchHeuristic

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

  let targetComplexity: number
  if (isVagueTargetRole(candidate.targetRoleType)) {
    targetComplexity = 60
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

  const focus = isVagueTargetRole(candidate.targetRoleType) ? 35 : 90
  const targetFitScore = clamp((experienceMatch + marketPosition + targetComplexity + focus) / 4)

  // ---- Leadership & Management — resume scope (isPeopleManager,
  // teamSizeManaged) + self-rated management confidence, blended with the
  // reference "team lift" rating where available.
  const leadershipSelfReport = candidate.isPeopleManager
    ? clamp(30 + Math.min(candidate.teamSizeManaged ?? 0, 20) * 2 + (candidate.managementSkillConfidence ?? 50) * 0.3)
    : 40 // not a penalty — an IC candidate simply has less direct-management evidence to show yet
  const leadershipRefRating = averageReferenceRating(refs, 'traitPresenceRating')
  const leadershipScore =
    leadershipRefRating !== null ? clamp(leadershipSelfReport * 0.5 + leadershipRefRating * 0.5) : leadershipSelfReport

  // ---- Skills & Execution — self-rated core-skill confidence, blended
  // with the reference "work ethic" rating.
  const skillsSelfReport = candidate.functionSkillConfidence ?? 50
  const skillsRefRating = averageReferenceRating(refs, 'overallRating')
  const skillsExecutionScore =
    skillsRefRating !== null ? clamp(skillsSelfReport * 0.5 + skillsRefRating * 0.5) : clamp(skillsSelfReport)

  // ---- Communication & Collaboration — self-rated communicator
  // confidence blended with how clearly the resume itself communicates
  // (ATS readability + quantified-results framing — both fundamentally
  // about writing clearly, not about whether the underlying experience
  // fits), then blended again with the reference communication rating.
  const presentationScore =
    latestResume?.atsScore != null && latestResume?.resultsScore != null
      ? clamp((latestResume.atsScore + latestResume.resultsScore) / 2)
      : null
  const communicationSelfReport =
    presentationScore !== null
      ? clamp((candidate.communicatorConfidence ?? 50) * 0.6 + presentationScore * 0.4)
      : (candidate.communicatorConfidence ?? 50)
  const communicationRefRating = averageReferenceRating(refs, 'traitCollaborationRating')
  const communicationScore =
    communicationRefRating !== null
      ? clamp(communicationSelfReport * 0.5 + communicationRefRating * 0.5)
      : clamp(communicationSelfReport)

  // ---- Adaptability & Change Readiness — behavioral flexibility already
  // on file (comp/level/location) plus, if pivoting, whether that's paired
  // with real preparation (learning activity — read at report-generation
  // time, not here, so this stays a pure/no-extra-query function); blended
  // with the reference growth-mindset rating.
  const flexibilityCount = [candidate.willingToStartLower, candidate.compFlexible, candidate.openToRelocation].filter(
    Boolean
  ).length
  const adaptabilitySelfReport = clamp(40 + flexibilityCount * 15 + (candidate.isPivoting ? 10 : 0))
  const adaptabilityRefRating = averageReferenceRating(refs, 'traitAdaptabilityRating')
  const adaptabilityScore =
    adaptabilityRefRating !== null
      ? clamp(adaptabilitySelfReport * 0.5 + adaptabilityRefRating * 0.5)
      : adaptabilitySelfReport

  // ---- Ownership & Reliability — "how action-oriented are you?" (onboarding
  // Part 3) is the self-report proxy for "can you be trusted without
  // supervision": doing things without being told, even at the cost of more
  // work, is initiative/follow-through in the candidate's own words. Blended
  // with the reference "follow-through" rating the same way every other
  // category blends self-report and reference signal, rather than leaning on
  // the reference alone.
  const ownershipSelfReport = candidate.actionOrientedConfidence ?? 50
  const ownershipRefRating = averageReferenceRating(refs, 'traitFollowThroughRating')
  const ownershipBase =
    ownershipRefRating !== null
      ? clamp(ownershipSelfReport * 0.5 + ownershipRefRating * 0.5)
      : ownershipSelfReport

  // Structural facts layered on top of the reference/self-report baseline —
  // job-hopping and career-trajectory are real patterns a hiring manager
  // notices, and this category has no other home for them. First-pass
  // magnitudes — tune after seeing this against real seeded candidates.
  let ownershipStructuralAdjustment = 0
  if (candidate.jobHoppingFlag) ownershipStructuralAdjustment -= 15
  if (candidate.careerTrajectory === 'PROMOTED') ownershipStructuralAdjustment += 10
  if (candidate.careerTrajectory === 'DEMOTED') ownershipStructuralAdjustment -= 10

  const ownershipScore = clamp(ownershipBase + ownershipStructuralAdjustment)

  const scores: Record<CategoryKey, number> = {
    targetFit: targetFitScore,
    leadership: leadershipScore,
    skillsExecution: skillsExecutionScore,
    communication: communicationScore,
    adaptability: adaptabilityScore,
    ownership: ownershipScore,
  }

  const selfAwarenessInputs: SelfAwarenessInputs = {
    communicatorConfidence: candidate.communicatorConfidence,
    managementSkillConfidence: candidate.managementSkillConfidence,
    isPeopleManager: candidate.isPeopleManager,
    topStrengths: candidate.topStrengths,
    dimensionVectors: latestVectors ?? null,
    hasCompletedReference: completedReferenceCount(refs) > 0,
  }

  return CATEGORY_ORDER.map((key) => ({
    key,
    label: CATEGORY_LABEL[key],
    score: scores[key],
    grade: scoreToGrade(scores[key]),
    confidence: getCategoryConfidence(key, candidate, jobReactionsCount),
    selfAwareness: getSelfAwarenessRead(key, selfAwarenessInputs),
  }))
}

// Reads the persisted per-category baseline, backfilling it from a live
// computation the first time a candidate is graded (so there's never a
// "no baseline yet" gap for an existing candidate mid-migration).
export async function getCategoryBaseline(
  candidate: CandidateWithGradeRelations
): Promise<Record<CategoryKey, number>> {
  const stored = candidate.categoryBaselineScores as Record<CategoryKey, number> | null
  if (stored) return stored

  const categories = await computeCategoryGrades(candidate)
  const baseline = Object.fromEntries(categories.map((c) => [c.key, c.score])) as Record<CategoryKey, number>
  await prisma.candidateProfile.update({
    where: { id: candidate.id },
    data: { categoryBaselineScores: baseline, categoryBaselineUpdatedAt: new Date() },
  })
  return baseline
}

// Called by rewrite-actions.ts when a real event (a landed interview, a
// reference that rebuts a named weakness, etc.) should move a category's
// baseline directly, rather than waiting for the bounded weekly nudge.
export async function updateCategoryBaseline(
  candidateId: string,
  category: CategoryKey,
  newScore: number
): Promise<void> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } })
  const current = (candidate.categoryBaselineScores as Record<CategoryKey, number> | null) ?? {}
  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      categoryBaselineScores: { ...current, [category]: clamp(newScore) },
      categoryBaselineUpdatedAt: new Date(),
    },
  })
}

// Weekly effort — an input to the grade, not a second grade. Same point
// math as before: each of the four engines sums the points of *completed*
// committed actions that map to it, scored against a proportional quarter
// of the week's overall ramp target.
export async function computeWeeklyEngines(
  candidateId: string,
  weekNumber: number,
  privacyTier: PrivacyTier
): Promise<{ engines: WeeklyEngine[]; weeklyPoints: number; weeklyPointsTarget: number }> {
  const weeklyPointsTarget = pointsNeededForA(weekNumber)
  const perEngineTarget = weeklyPointsTarget / 4

  const sprint = await getCurrentWeekSprint(candidateId)
  const committedActions = sprint ? (sprint.committedActions as unknown as CommittedAction[]) : []

  const pointsByEngine: Record<WeeklyEngineKey, number> = { learning: 0, effort: 0, working: 0, connecting: 0 }
  for (const action of committedActions) {
    if (!action.completed) continue
    const engine = engineForActionType(action.actionType)
    pointsByEngine[engine] += action.points ?? 0
  }

  // Being Public/Semi-Public amplifies real networking effort already done
  // this week — it never manufactures connecting-engine score from nothing.
  // Gating on pointsByEngine.connecting > 0 matters specifically because of
  // the week-4+ anti-neglect floor below: an ungated bonus would let a
  // candidate cross that floor by leaving a visibility toggle set, with zero
  // real outreach, defeating the one mechanism that catches neglect.
  const isPubliclyVisible = privacyTier === 'PUBLIC' || privacyTier === 'SEMI_PUBLIC'
  if (isPubliclyVisible && pointsByEngine.connecting > 0) {
    pointsByEngine.connecting += 5
  }

  const weeklyPoints = Object.values(pointsByEngine).reduce((sum, p) => sum + p, 0)

  const engines: WeeklyEngine[] = (['learning', 'effort', 'working', 'connecting'] as const).map((key) => {
    const score = perEngineTarget > 0 ? clamp((pointsByEngine[key] / perEngineTarget) * 100) : 0
    return { key, label: WEEKLY_ENGINE_LABEL[key], score, grade: scoreToGrade(score) }
  })

  return { engines, weeklyPoints, weeklyPointsTarget }
}

// Did the candidate earn an A the calendar week immediately before the
// current one? Recomputed directly from that week's WeeklySprint rather
// than read back from a HireabilityReport snapshot, since reports aren't
// generated on a strict weekly cadence.
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

// The non-compounding weekly blend: baseline (stable, only moves via a
// rewrite-action event or a full retake) plus a bounded nudge from this
// week's effort — never a running multiplier across weeks. A perfect week
// moves the grade up to 15 points; a dead week moves it down up to 15; an
// average, at-target week leaves the baseline untouched.
function blendCategoryScore(baselineScore: number, weeklyPerformanceRatio: number): number {
  const nudge = Math.max(-15, Math.min(15, (weeklyPerformanceRatio - 0.5) * 30))
  return clamp(baselineScore + nudge)
}

export async function computeHireabilityGrade(candidate: CandidateWithGradeRelations): Promise<HireabilityGrade> {
  const weekNumber = await getCandidateWeekNumber(candidate.id, getMondayOfWeek(new Date()))
  const [baseline, categoriesLive, { engines, weeklyPoints, weeklyPointsTarget }] = await Promise.all([
    getCategoryBaseline(candidate),
    computeCategoryGrades(candidate),
    computeWeeklyEngines(candidate.id, weekNumber, candidate.privacyTier),
  ])

  const hasExecutiveCoach = candidate.coach?.focus === 'EXECUTIVE'
  const hadAGradeLastWeek = await hadPriorWeekA(candidate.id, weekNumber)
  const bonusMultiplier = 1 + Math.min(0.2, (hasExecutiveCoach ? 0.1 : 0) + (hadAGradeLastWeek ? 0.1 : 0))
  const recognizedWeeklyPoints = Math.round(weeklyPoints * bonusMultiplier)

  const weeklyPerformanceRatio =
    weeklyPointsTarget > 0 ? Math.min(1.5, recognizedWeeklyPoints / weeklyPointsTarget) : 0

  const laggingEngines = engines.filter((e) => e.score < CATEGORY_MINIMUM_SCORE_FLOOR).map((e) => e.key)
  const categoryMinimumsMet =
    candidate._count.weeklySprints < CATEGORY_MINIMUM_ENFORCED_FROM_WEEK || laggingEngines.length === 0

  // The weekly nudge (and the week-4+ engine floor) apply to the grade as a
  // whole, not per category — categories keep their own baselines but move
  // together with the week's overall effort level. Live-computed category
  // scores (categoriesLive) are used for confidence/self-awareness/commentary;
  // the graded score/grade per category comes from the blended baseline.
  const categories: CategoryGrade[] = categoriesLive.map((c) => {
    const blendedScore = blendCategoryScore(baseline[c.key] ?? c.score, weeklyPerformanceRatio)
    return { ...c, score: blendedScore, grade: scoreToGrade(blendedScore) }
  })

  let overallScore = clamp(categories.reduce((sum, c) => sum + c.score, 0) / categories.length)
  let overallGrade = scoreToGrade(overallScore)
  if (!categoryMinimumsMet && overallGrade === 'A') {
    overallGrade = 'B'
    overallScore = Math.min(overallScore, 89)
  }

  return {
    score: overallScore,
    grade: overallGrade,
    categories,
    weeklyEngines: engines,
    categoryMinimumsMet,
    laggingEngines,
    weeklyPoints,
    weeklyPointsTarget,
    recognizedWeeklyPoints,
    bonusMultiplier,
    hasExecutiveCoach,
    hadPriorWeekA: hadAGradeLastWeek,
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
  assessmentResponses: { orderBy: { completedAt: 'desc' as const }, take: 1, select: { dimensionVectors: true, completedAt: true } },
  _count: { select: { weeklySprints: true } },
  coach: { select: { focus: true } },
} as const

// Single-candidate convenience wrapper for the live A-grade gates (the
// bounty-claim submission gate and the Exclusive Jobs unlock check;
// recruiter visibility instead reads from stored report snapshots — see
// the match-inbox query).
export async function getCurrentGrade(candidateId: string): Promise<Grade> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    include: GRADE_RELATIONS_INCLUDE,
  })
  const grade = await computeHireabilityGrade(candidate as unknown as CandidateWithGradeRelations)
  return grade.grade
}

// Legacy shape, stored in HireabilityReport.hireabilityGradeAtGeneration
// (and MarketRealitySnapshot-adjacent JSON) before the Scoring Model 2.0
// collapse — kept narrow and local to this one adapter, not re-exported,
// since nothing should be written in this shape going forward.
interface LegacyHireabilityGradeSnapshot {
  marketReality: { score: number; grade: Grade }
  searchExecution: {
    engines: WeeklyEngine[]
    categoryMinimumsMet: boolean
    laggingEngines: WeeklyEngineKey[]
    weeklyPoints: number
    weeklyPointsTarget: number
    bonusMultiplier?: number
    hasExecutiveCoach?: boolean
    hadPriorWeekA?: boolean
    recognizedWeeklyPoints?: number
  }
}

function isLegacySnapshot(raw: object): raw is LegacyHireabilityGradeSnapshot {
  return 'marketReality' in raw && 'searchExecution' in raw
}

// Reads a stored grade snapshot in either shape. Old (pre-collapse) rows
// have no six-category breakdown to recover — the dimensions they stored
// don't map cleanly onto the new categories, so rather than fabricate a
// wrong-looking breakdown, categories comes back empty and callers that
// render it should treat that the same as "not available for this report."
// The overall grade, weekly engines, and bonus fields all carry over
// faithfully, since those kept the same shape or a directly compatible one
// (the four weekly engine keys didn't change).
export function normalizeGradeSnapshot(raw: unknown): HireabilityGrade | null {
  if (!raw || typeof raw !== 'object') return null
  if (isLegacySnapshot(raw)) {
    return {
      score: raw.marketReality.score,
      grade: raw.marketReality.grade,
      categories: [],
      weeklyEngines: raw.searchExecution.engines,
      categoryMinimumsMet: raw.searchExecution.categoryMinimumsMet,
      laggingEngines: raw.searchExecution.laggingEngines,
      weeklyPoints: raw.searchExecution.weeklyPoints,
      weeklyPointsTarget: raw.searchExecution.weeklyPointsTarget,
      recognizedWeeklyPoints: raw.searchExecution.recognizedWeeklyPoints ?? raw.searchExecution.weeklyPoints,
      bonusMultiplier: raw.searchExecution.bonusMultiplier ?? 1,
      hasExecutiveCoach: raw.searchExecution.hasExecutiveCoach ?? false,
      hadPriorWeekA: raw.searchExecution.hadPriorWeekA ?? false,
    }
  }
  return raw as HireabilityGrade
}
