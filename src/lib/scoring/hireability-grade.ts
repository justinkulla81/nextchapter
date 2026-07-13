// The Hireability Grade — replaces the single numeric Hireability Score
// display with two named, separately-meaningful grades:
//
//   Market Reality   — an honest read on current market position, including
//                       factors the candidate cannot control (experience,
//                       market demand, how big a leap their target is).
//   Search Execution — how well they're running the search they're capable
//                       of running. Everyone can bring this one to an A.
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
  JobPosting,
  LinkedInActivityLog,
  Reference,
  Resume,
  WorkHistoryEntry,
  WorkSample,
} from '@prisma/client'
import { getMarketConditions } from '@/lib/market'
import { isVagueTargetRole } from '@/lib/constants/onboarding'
import {
  scoreToGrade,
  type MarketRealityDimension,
  type SearchExecutionEngine,
  type HireabilityGrade,
} from '@/lib/scoring/grade'

export type { Grade, FactorType, MarketRealityDimension, SearchExecutionEngine, HireabilityGrade } from '@/lib/scoring/grade'
export { scoreToGrade, GRADE_LABEL } from '@/lib/scoring/grade'

export type CandidateWithGradeRelations = CandidateProfile & {
  references: Reference[]
  workSamples: WorkSample[]
  workHistory: WorkHistoryEntry[]
  linkedInActivityLogs: LinkedInActivityLog[]
  jobPostings: JobPosting[]
  resumes: Resume[]
  communityPosts: { createdAt: Date }[]
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

async function computeMarketRealityDimensions(
  candidate: CandidateWithGradeRelations
): Promise<MarketRealityDimension[]> {
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
  if (candidate.jobSearchIntensity !== null) searchStrategy += candidate.jobSearchIntensity * 0.35
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
    },
    {
      key: 'marketPosition',
      label: 'Market Position',
      score: marketPosition,
      grade: scoreToGrade(marketPosition),
      factorType: 'structural',
    },
    {
      key: 'targetComplexity',
      label: 'Target Complexity',
      score: targetComplexity,
      grade: scoreToGrade(targetComplexity),
      factorType: 'structural',
    },
    {
      key: 'presentation',
      label: 'Presentation',
      score: presentation,
      grade: scoreToGrade(presentation),
      factorType: 'controllable',
    },
    {
      key: 'socialProof',
      label: 'Social Proof',
      score: socialProof,
      grade: scoreToGrade(socialProof),
      factorType: 'controllable',
    },
    {
      key: 'searchStrategy',
      label: 'Search Strategy',
      score: searchStrategy,
      grade: scoreToGrade(searchStrategy),
      factorType: 'controllable',
    },
  ]
}

function computeSearchExecutionEngines(candidate: CandidateWithGradeRelations): SearchExecutionEngine[] {
  // Learning Engine — profile complete, target defined, assessment done
  let learning = 0
  const onboardingParts = [candidate.part1Complete, candidate.part3Complete, candidate.part4Complete].filter(
    Boolean
  ).length
  learning += onboardingParts * 20
  if (candidate.assessmentComplete) learning += 20
  if (candidate.targetRoleType && !isVagueTargetRole(candidate.targetRoleType)) learning += 20
  learning = clamp(learning)

  // Effort Engine — action-plan confirmations completed vs. available today.
  // (Full "committed vs completed weekly actions" tracking lands with the
  // Success Sprint build — this is the best available proxy until then.)
  const confirmations = [
    candidate.profileConfirmedAt,
    candidate.industryConfirmedAt,
    candidate.functionConfirmedAt,
    candidate.salaryConfirmedAt,
    candidate.workAuthConfirmedAt,
    candidate.linkedInConfirmedAt,
    candidate.networkingListSubmittedAt,
    candidate.askedForHelpAt,
  ]
  const confirmedCount = confirmations.filter(Boolean).length
  let effort = (confirmedCount / confirmations.length) * 80
  effort += Math.min(candidate.jobPostings.length * 5, 20)
  effort = clamp(effort)

  // Working Engine — assets built: resume, proof assets, LinkedIn content
  let working = 0
  if (candidate.resumes.length > 0) working += 35
  working += Math.min(candidate.workSamples.length * 15, 30)
  working += Math.min(candidate.linkedInActivityLogs.length * 5, 20)
  if (candidate.knownFor) working += 15
  working = clamp(working)

  // Connecting Engine — thinnest signal today; real outreach tracking
  // (Support Network / BCC logging) hasn't been built yet, so this proxies
  // from network-list submission, references requested, and community
  // engagement until that system exists.
  let connecting = 0
  if (candidate.networkingListSubmittedAt) connecting += 35
  connecting += Math.min(candidate.references.length * 10, 30)
  connecting += Math.min(candidate.communityPosts.length * 10, 20)
  connecting += Math.min(candidate.linkedInActivityLogs.length * 3, 15)
  connecting = clamp(connecting)

  return [
    { key: 'learning', label: 'Learning', score: learning, grade: scoreToGrade(learning) },
    { key: 'effort', label: 'Effort', score: effort, grade: scoreToGrade(effort) },
    { key: 'working', label: 'Working', score: working, grade: scoreToGrade(working) },
    { key: 'connecting', label: 'Connecting', score: connecting, grade: scoreToGrade(connecting) },
  ]
}

export async function computeHireabilityGrade(
  candidate: CandidateWithGradeRelations
): Promise<HireabilityGrade> {
  const dimensions = await computeMarketRealityDimensions(candidate)
  const engines = computeSearchExecutionEngines(candidate)

  const marketRealityScore = clamp(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length)
  const searchExecutionScore = clamp(engines.reduce((sum, e) => sum + e.score, 0) / engines.length)

  return {
    marketReality: {
      score: marketRealityScore,
      grade: scoreToGrade(marketRealityScore),
      dimensions,
    },
    searchExecution: {
      score: searchExecutionScore,
      grade: scoreToGrade(searchExecutionScore),
      engines,
    },
  }
}
