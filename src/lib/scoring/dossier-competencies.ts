// Scoring Model 2.0 — one Current Market Reality, built from six categories:
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
  CompanySizeBand,
  JobPosting,
  LinkedInActivityLog,
  PerformanceAssessmentResponse,
  PrivacyTier,
  Reference,
  Resume,
  SurfacedJob,
  WorkHistoryEntry,
  WorkSample,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getMarketConditions } from '@/lib/market'
import { resolveCompanySizeBand } from '@/lib/market/company-size'
import { isVagueTargetRole } from '@/lib/constants/onboarding'
import { getSelfAwarenessRead, type SelfAwarenessInputs } from '@/lib/scoring/self-awareness'
import { computeReferenceWeights } from '@/lib/references/collusion-check'
import { getCurrentWeekSprint, type CommittedAction } from '@/lib/weekly/sprint'
import { pointsNeededForA, engineForActionType, getEarnedPoints } from '@/lib/weekly/action-effort'
import {
  scoreToGrade,
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  WEEKLY_ENGINE_LABEL,
  type CategoryKey,
  type ConfidenceLevel,
  type CategoryGrade,
  type WeeklyEngine,
  type WeeklyEngineKey,
} from '@/lib/scoring/grade'

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
  performanceAssessmentResponses: Pick<
    PerformanceAssessmentResponse,
    'executionScore' | 'judgmentScore' | 'composureScore' | 'influenceScore' | 'completedAt'
  >[]
  _count: { weeklySprints: number }
  coach: { focus: CoachingFocus } | null
}

// Rescales a How I Perform dimension mean (1-4) to the 0-100 self-report
// scale every other category input already uses. Averages when >1 dimension
// feeds a category (Ownership: Execution + Composure; Adaptability: Judgment
// + Composure — spec §3.2). Returns null when the candidate hasn't completed
// How I Perform yet, so callers can fall back to the pre-existing self-report
// input untouched.
type PerformanceDimensionKey = 'executionScore' | 'judgmentScore' | 'composureScore' | 'influenceScore'

function performanceSelfReport(candidate: CandidateWithGradeRelations, dims: PerformanceDimensionKey[]): number | null {
  const response = candidate.performanceAssessmentResponses[0]
  if (!response) return null
  const mean = dims.reduce((sum, dim) => sum + response[dim], 0) / dims.length
  return clamp(((mean - 1) / 3) * 100)
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

// CompanySizeBand is an 8-tier employee-headcount scale (see company-size.ts);
// the candidate-facing COMPANY_SIZE_OPTIONS is a coarser 3-bucket version of
// the same scale. Ordinals below place both on one line so a candidate's
// most recent employer can be compared against their stated target — bucket
// ordinals are the midpoint of the bands they span.
const COMPANY_SIZE_BAND_ORDINAL: Record<CompanySizeBand, number> = {
  MICRO: 0,
  SMALL: 1,
  SMALL_MID: 2,
  MID: 3,
  MID_LARGE: 4,
  LARGE: 5,
  ENTERPRISE: 6,
  MEGA: 7,
}
const TARGET_COMPANY_SIZE_ORDINAL: Record<string, number> = {
  '1-50': 0.5, // spans MICRO-SMALL
  '50-500': 2.5, // spans SMALL_MID-MID
  '500+': 5.5, // spans MID_LARGE-MEGA
}

// A company-size jump is a real thing a hiring manager weighs, and the two
// directions aren't symmetric: going from a large, structured company to a
// small one is the harder sell (different, scrappier operating muscle —
// less process, less specialization, more generalist), while small-to-large
// reads more as resourcefulness than risk. Same-size-ish moves are free.
// Silent no-op whenever either side can't be resolved (no target
// preference, or the most recent employer's name doesn't resolve to a
// band) — this is a real-world estimate, never a guess from a null.
async function computeCompanySizeTransitionAdjustment(
  workHistory: WorkHistoryEntry[],
  targetCompanySize: string | null
): Promise<number> {
  if (!targetCompanySize) return 0
  const targetOrdinal = TARGET_COMPANY_SIZE_ORDINAL[targetCompanySize]
  if (targetOrdinal === undefined) return 0

  const mostRecent = [...workHistory].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
    return b.startDate.getTime() - a.startDate.getTime()
  })[0]
  if (!mostRecent) return 0

  const { band } = await resolveCompanySizeBand(mostRecent.companyName)
  if (!band) return 0

  const distance = COMPANY_SIZE_BAND_ORDINAL[band] - targetOrdinal // positive = moving to something smaller
  if (distance >= 3) return -8
  if (distance <= -4) return -3
  return 0
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
  field: 'traitPresenceRating' | 'overallRating' | 'traitCollaborationRating' | 'traitAdaptabilityRating' | 'traitFollowThroughRating',
  // The trait-* fields are still a 1-5 scale (RatingScale, unchanged);
  // overallRating moved to the anchored 1-4 scale (see AnchoredOverallScale)
  // to match the rest of the form, so its normalization needs its own max.
  maxScale: number = 5
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
  return clamp(((avg - 1) / (maxScale - 1)) * 100)
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
      return refCount >= 1
        ? 'HIGH'
        : candidate.performanceAssessmentResponses.length > 0 || candidate.communicatorConfidence !== null
          ? 'BUILDING'
          : 'PROVISIONAL'
    case 'adaptability':
      return refCount >= 1 ? 'HIGH' : 'BUILDING'
    case 'ownership':
      return refCount >= 1
        ? 'HIGH'
        : candidate.performanceAssessmentResponses.length > 0 || candidate.actionOrientedConfidence !== null
          ? 'BUILDING'
          : 'PROVISIONAL'
  }
}

export async function computeCategoryGrades(
  candidate: CandidateWithGradeRelations,
  options?: { includeFlexibilitySignal?: boolean }
): Promise<CategoryGrade[]> {
  const includeFlexibilitySignal = options?.includeFlexibilitySignal ?? true
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
  // Being locked to on-site with no willingness to relocate only matters
  // because it removes the escape valve a remote/hybrid/relocating candidate
  // has — it's not a penalty on its own, only when the local market (already
  // reflected in marketPosition above, itself now scoped to a 50-mile
  // radius — see searchAdzunaJobs) is already thin.
  if (candidate.remotePreference === 'onsite' && !candidate.openToRelocation && marketPosition < 50) {
    marketPosition -= 10
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
  const companySizeTransitionAdjustment = await computeCompanySizeTransitionAdjustment(
    candidate.workHistory,
    candidate.targetCompanySize
  )
  // Pedigree/prestige bonus (elite institution, prestige employer, high-
  // demand function, promotion velocity) — persisted by computeStructuralFlags
  // (see pedigree-bonus.ts), applied additively here rather than folded into
  // the four-way average above, same treatment as the real-event bumps in
  // rewrite-actions.ts. A candidate with no matching signal gets +0 and is
  // otherwise unaffected. companySizeTransitionAdjustment (see above) is the
  // same kind of additive structural term.
  const targetFitScore = clamp(
    (experienceMatch + marketPosition + targetComplexity + focus) / 4 +
      (candidate.pedigreeBonus ?? 0) +
      companySizeTransitionAdjustment
  )

  // ---- Leadership & Management — resume scope (isPeopleManager,
  // teamSizeManaged) + self-rated management confidence, blended with the
  // reference "team lift" rating where available. The confidence component
  // is How I Perform's Influence score once completed (spec §3.2) — it
  // replaces managementSkillConfidence rather than blending alongside it,
  // since it's a richer 8-item read on the same "gets outcomes through
  // people" question a single slider was standing in for.
  const managementConfidenceInput = performanceSelfReport(candidate, ['influenceScore']) ?? candidate.managementSkillConfidence ?? 50
  const leadershipSelfReport = candidate.isPeopleManager
    ? clamp(30 + Math.min(candidate.teamSizeManaged ?? 0, 20) * 2 + managementConfidenceInput * 0.3)
    : 40 // not a penalty — an IC candidate simply has less direct-management evidence to show yet
  const leadershipRefRating = averageReferenceRating(refs, 'traitPresenceRating')
  const leadershipScore =
    leadershipRefRating !== null ? clamp(leadershipSelfReport * 0.5 + leadershipRefRating * 0.5) : leadershipSelfReport

  // ---- Skills & Execution — self-rated core-skill confidence, blended
  // with the reference "work ethic" rating. How I Perform's Execution score
  // replaces functionSkillConfidence once completed (spec §3.2) — same
  // "richer instrument replaces the thin slider" treatment as Leadership.
  const skillsSelfReport = performanceSelfReport(candidate, ['executionScore']) ?? candidate.functionSkillConfidence ?? 50
  const skillsRefRating = averageReferenceRating(refs, 'overallRating', 4)
  const skillsExecutionBase =
    skillsRefRating !== null ? clamp(skillsSelfReport * 0.5 + skillsRefRating * 0.5) : clamp(skillsSelfReport)

  // Self-reported AI-skill confidence (onboarding Experience Q5) is a real
  // ding for the bottom stop, not just a narrative aside — a candidate who
  // says they're "just getting started" with AI is a genuine hiring-manager
  // concern in a function being reshaped by it. Never a bonus (this stays
  // separate from the concrete-evidence AI_FLUENCY_STRENGTH_ID narrative
  // reason in named-reasons.ts, which is about a real example, not a
  // self-report slider) — only a penalty, and only at the two weakest stops.
  let aiSkillsAdjustment = 0
  if (candidate.aiFlexibilityLevel != null) {
    if (candidate.aiFlexibilityLevel <= 25) aiSkillsAdjustment = -10
    else if (candidate.aiFlexibilityLevel <= 50) aiSkillsAdjustment = -5
  }
  const skillsExecutionScore = clamp(skillsExecutionBase + aiSkillsAdjustment)

  // ---- Communication & Collaboration — self-rated communicator
  // confidence blended with how clearly the resume itself communicates
  // (ATS readability + quantified-results framing — both fundamentally
  // about writing clearly, not about whether the underlying experience
  // fits), then blended again with the reference communication rating.
  // Confidence input is How I Perform's Influence score once completed
  // (spec §3.2), replacing communicatorConfidence.
  const presentationScore =
    latestResume?.atsScore != null && latestResume?.resultsScore != null
      ? clamp((latestResume.atsScore + latestResume.resultsScore) / 2)
      : null
  const communicatorConfidenceInput = performanceSelfReport(candidate, ['influenceScore']) ?? candidate.communicatorConfidence ?? 50
  const communicationSelfReport =
    presentationScore !== null
      ? clamp(communicatorConfidenceInput * 0.6 + presentationScore * 0.4)
      : communicatorConfidenceInput
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
  //
  // includeFlexibilitySignal=false (used only by the displayed Current
  // Market Reality path, via computeDossierCompetencies) holds the self-report
  // at a neutral midpoint instead — candidates shouldn't be able to move
  // their Current Market Reality by how flexible they say they are on
  // comp/level/location/pivoting. The archival snapshot, Coaching Notes,
  // and the Dossier's self-awareness read all keep the real signal via the
  // default.
  //
  // How I Perform's Judgment + Composure average (spec §3.2) replaces this
  // whole structural formula once completed — unlike the flexibility
  // checkboxes it isn't gameable by claiming comp/location flexibility, so
  // it's used regardless of includeFlexibilitySignal.
  const flexibilityCount = [candidate.willingToStartLower, candidate.compFlexible, candidate.openToRelocation].filter(
    Boolean
  ).length
  const structuralAdaptabilitySelfReport = includeFlexibilitySignal
    ? clamp(40 + flexibilityCount * 15 + (candidate.isPivoting ? 10 : 0))
    : clamp(50)
  const adaptabilitySelfReport =
    performanceSelfReport(candidate, ['judgmentScore', 'composureScore']) ?? structuralAdaptabilitySelfReport
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
  // the reference alone. How I Perform's Execution + Composure average
  // (spec §3.2) replaces actionOrientedConfidence once completed.
  const ownershipSelfReport =
    performanceSelfReport(candidate, ['executionScore', 'composureScore']) ?? candidate.actionOrientedConfidence ?? 50
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

  // A real employment gap is a legitimate hiring-manager concern, and it
  // compounds the longer it runs — graduated rather than a single flat
  // penalty so a fresh gap barely registers but a year-plus gap dings as
  // hard as job-hopping. ZERO_TO_THREE_MONTHS gets no penalty at all: that's
  // a normal transition window, not a red flag.
  switch (candidate.gapDuration) {
    case 'THREE_TO_SIX_MONTHS':
      ownershipStructuralAdjustment -= 5
      break
    case 'SIX_TO_TWELVE_MONTHS':
      ownershipStructuralAdjustment -= 10
      break
    case 'TWELVE_PLUS_MONTHS':
      ownershipStructuralAdjustment -= 15
      break
  }

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

// Called by rewrite-actions.ts when a real event (a landed interview, a
// reference that rebuts a named weakness, etc.) should move a category's
// baseline directly. No candidate-facing grade reads this baseline anymore
// (see the six-category grade removal) — it's kept because
// bias-detection.ts's fairness audit still reads categoryBaselineScores
// directly for its avgSkillsExecutionScore cohort metric.
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
  privacyTier: PrivacyTier,
  confidentialSearchMode: boolean
): Promise<{
  engines: WeeklyEngine[]
  weeklyPoints: number
  weeklyPointsTarget: number
  visibilityBonus: number
}> {
  const weeklyPointsTarget = pointsNeededForA(weekNumber)
  const perEngineTarget = weeklyPointsTarget / 4

  const sprint = await getCurrentWeekSprint(candidateId)
  const committedActions = sprint ? (sprint.committedActions as unknown as CommittedAction[]) : []

  const pointsByEngine: Record<WeeklyEngineKey, number> = { learning: 0, effort: 0, working: 0, connecting: 0 }
  for (const action of committedActions) {
    const engine = engineForActionType(action.actionType)
    pointsByEngine[engine] += getEarnedPoints(action)
  }

  // Being Public/Semi-Public amplifies real networking effort already done
  // this week — it never manufactures connecting-engine score from nothing.
  // Gating on pointsByEngine.connecting > 0 matters specifically because of
  // the week-4+ anti-neglect floor below: an ungated bonus would let a
  // candidate cross that floor by leaving a visibility toggle set, with zero
  // real outreach, defeating the one mechanism that catches neglect.
  //
  // Confidential Search Mode candidates are folded into this same
  // eligibility check (not just privacyTier) — spec §5: "the mode doesn't
  // change... badges, points, streaks, personal bests." A confidential-mode
  // candidate typically also carries a non-public privacyTier (their
  // identity IS hidden, by design, for safety reasons unrelated to their
  // actual connecting activity), so gating this bonus on privacyTier alone
  // would systematically cost them the +5 every week for a reason that has
  // nothing to do with how much real connecting work they did. Folding
  // confidentialSearchMode into the same eligibility check — rather than
  // dropping the real-activity requirement — keeps the anti-neglect
  // property intact (pointsByEngine.connecting > 0 is still required) while
  // no longer punishing the choice to stay confidential.
  const visibilityBonusEligible = privacyTier === 'PUBLIC' || privacyTier === 'SEMI_PUBLIC' || confidentialSearchMode
  let visibilityBonus = 0
  if (visibilityBonusEligible && pointsByEngine.connecting > 0) {
    visibilityBonus = 5
    pointsByEngine.connecting += visibilityBonus
  }

  const weeklyPoints = Object.values(pointsByEngine).reduce((sum, p) => sum + p, 0)

  const engines: WeeklyEngine[] = (['learning', 'effort', 'working', 'connecting'] as const).map((key) => {
    const score = perEngineTarget > 0 ? clamp((pointsByEngine[key] / perEngineTarget) * 100) : 0
    return { key, label: WEEKLY_ENGINE_LABEL[key], score, grade: scoreToGrade(score) }
  })

  return { engines, weeklyPoints, weeklyPointsTarget, visibilityBonus }
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
  performanceAssessmentResponses: {
    orderBy: { completedAt: 'desc' as const },
    take: 1,
    select: { executionScore: true, judgmentScore: true, composureScore: true, influenceScore: true, completedAt: true },
  },
  _count: { select: { weeklySprints: true } },
  coach: { select: { focus: true } },
} as const

