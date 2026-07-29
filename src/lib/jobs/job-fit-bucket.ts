import 'server-only'
import type { CandidateProfile, ExclusiveJobPosting, SurfacedJob } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeMatchScore } from '@/lib/matching/compute-match-score'
import { inferFunctionFromTitle, inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import { isVagueTargetRole } from '@/lib/constants/onboarding'
import type { FitBucket } from '@/lib/jobs/fit-bucket-types'
import type { Grade } from '@/lib/scoring/grade'
import { detectRequiredCredential, candidateMeetsCredentialGate } from '@/lib/jobs/credential-gate'

// The "Quick-read" fit signal shown on every Discover card — free, no LLM
// call, computed for every candidate x listing pair. Deliberately a bucket,
// never a raw number, matching the sitewide rule against showing precise
// scores anywhere a candidate can see them. The real per-listing fit
// analysis (analyzeJobFit) only runs on demand, from the "See full fit"
// bridge action. See fit-bucket-types.ts for the FitBucket type/label
// (kept separate, with no 'server-only' import, so client components can
// render the label without pulling this file's server-only deps in).

// The score a listing needs to clear to count as a "strong" fit — used by
// every fit-bucket consumer below (candidate Discover badges, SurfacedJob
// badges, admin review). The ATS admission gate uses its own harder,
// two-part function+seniority check instead (see ats-job-board-feed.ts) —
// a continuous score maxed over a large, diverse candidate pool proved too
// easy to clear for that use case.
export const STRONG_FIT_THRESHOLD = 70

function bucketFromScore(score: number): FitBucket {
  if (score >= STRONG_FIT_THRESHOLD) return 'strong'
  if (score >= 45) return 'good'
  return 'stretch'
}

// Widened to carry every signal the enriched scorer below uses — industry,
// years of experience, and resume keywords used to be admin-only
// (AdminFitCandidate), but the candidate-facing Discover/SurfacedJob
// buckets need the same signals now that they share one scoring path with
// the admin review queue instead of a thinner computeMatchScore-only call.
type FitCandidate = Pick<
  CandidateProfile,
  | 'primaryFunction'
  | 'highestLevelReached'
  | 'remotePreference'
  | 'currentCity'
  | 'currentState'
  | 'openToRelocation'
  | 'targetCompMin'
  | 'compFlexible'
  | 'targetRoleType'
  | 'resumeKeywords'
  | 'yearsExperience'
  | 'industryContext'
  | 'targetIndustries'
  | 'hasJD'
  | 'hasMD'
  | 'hasDO'
>

// id/firstName/lastName/email are only needed by admin-side display and the
// two candidate-centric ranking helpers below (rankPendingPostingsForCandidate,
// rankCandidatesByFitCoverage) — harmless to carry on every caller.
export type AdminFitCandidate = FitCandidate & Pick<CandidateProfile, 'id' | 'firstName' | 'lastName' | 'email'>

function titleSimilarityBonus(targetRoleType: string | null, postingTitle: string): number {
  if (!targetRoleType || isVagueTargetRole(targetRoleType)) return 0
  const target = targetRoleType.trim().toLowerCase()
  if (!target) return 0
  const title = postingTitle.toLowerCase()
  if (title === target) return 20
  if (title.includes(target) || target.includes(title)) return 16
  const targetWords = target.split(/\s+/).filter((w) => w.length > 2)
  if (targetWords.length === 0) return 0
  const titleWords = new Set(title.split(/\s+/).filter((w) => w.length > 2))
  const overlap = targetWords.filter((w) => titleWords.has(w)).length
  return Math.round((overlap / targetWords.length) * 16)
}

// A candidate with a substantial keyword set (6+, pulled from their resume)
// needs real corroboration from the posting text before that keyword
// signal counts as confident — one or two incidental matches out of a
// dozen skills isn't meaningfully "this role uses my skills." Below 6
// keywords there isn't enough volume for a ratio to mean anything, so no
// gate applies (the raw hit count still contributes via `bonus`).
const KEYWORD_GATE_MIN_COUNT = 6
const KEYWORD_GATE_MIN_RATIO = 0.25

function keywordMatchInfo(resumeKeywords: string[], postingText: string): { bonus: number; failsGate: boolean } {
  if (resumeKeywords.length === 0) return { bonus: 0, failsGate: false }
  const lower = postingText.toLowerCase()
  const hits = resumeKeywords.filter((kw) => kw && lower.includes(kw.toLowerCase())).length
  const ratio = hits / resumeKeywords.length
  const failsGate = resumeKeywords.length >= KEYWORD_GATE_MIN_COUNT && ratio < KEYWORD_GATE_MIN_RATIO
  return { bonus: Math.round(ratio * 10), failsGate }
}

// Binary, not ratio-based — postings rarely name an industry explicitly
// enough to score partial credit against, so this only rewards a real
// mention of one of the candidate's target industries (or their own
// resume-derived industry) somewhere in the title/company/description.
// Neutral (0, no penalty) when the candidate hasn't set any — most
// candidates haven't filled in targetIndustries, and an empty array
// shouldn't read as "targeting nothing."
function industryMatchBonus(candidate: Pick<FitCandidate, 'targetIndustries' | 'industryContext'>, postingText: string): number {
  const targets = [...candidate.targetIndustries, candidate.industryContext].filter(
    (s): s is string => !!s && s.trim().length > 0
  )
  if (targets.length === 0) return 0
  const lower = postingText.toLowerCase()
  return targets.some((t) => lower.includes(t.toLowerCase())) ? 10 : 0
}

// Best-effort extraction of a minimum-years requirement from free-text
// posting copy ("5+ years", "3-5 years of experience") — same
// regex-over-free-text approach already used for ATS salary parsing
// (parseSalaryRange in ats-job-board-feed.ts). Returns null when nothing
// matches, which callers treat as "no requirement stated," not "zero
// years required."
function parseMinYearsRequired(text: string): number | null {
  const match = text.match(/(\d{1,2})\+?\s*(?:-\s*\d{1,2}\s*)?\s*years?/i)
  if (!match) return null
  const years = parseInt(match[1], 10)
  return Number.isNaN(years) ? null : years
}

function yearsExperienceBonus(candidateYears: number | null, postingText: string): number {
  const required = parseMinYearsRequired(postingText)
  if (required === null || candidateYears === null) return 5 // insufficient data on one side — neutral, not a penalty
  if (candidateYears >= required) return 10
  if (candidateYears >= required - 2) return 5 // close enough to be worth surfacing, not a confident match
  return 0
}

// ATS-fed OPEN postings never have targetRemotePolicy set (that field only
// exists for recruiter TARGETED listings) — without this, a posting whose
// own location literally says "Remote" never gets read as remote-friendly,
// under-crediting fit for candidates who'd be a good match for it.
function inferRemoteFromLocation(location: string | null): boolean {
  return location != null && /\bremote\b/i.test(location)
}

// The full shape the enriched scorer below needs from a posting — deliberately
// a plain interface, not a Prisma Pick, so both ExclusiveJobPosting rows and
// adapted SurfacedJob rows (which have no targeting/comp fields at all) can
// satisfy it via a small object-literal adapter at the call site.
interface FitPostingLike {
  title: string
  description: string | null
  location: string | null
  salaryMin: number | null
  salaryMax: number | null
  targetFunction: string | null
  targetLevel: string | null
  targetRemotePolicy: string | null
  targetLocation: string | null
}

function postingToRole(posting: FitPostingLike) {
  return {
    primaryFunction: posting.targetFunction ?? inferFunctionFromTitle(posting.title),
    roleLevel: posting.targetLevel ?? inferLevelFromTitle(posting.title),
    remotePolicy: posting.targetRemotePolicy ?? (inferRemoteFromLocation(posting.location) ? 'remote' : null),
    locationRequirement: posting.targetLocation ?? posting.location,
    compMin: posting.salaryMin,
    compMax: posting.salaryMax,
  }
}

// The one enriched fit score used everywhere — candidate Discover badges,
// SurfacedJob badges, and admin review all call this same function now, so
// "a good fit" means the same thing regardless of who's looking. Combines
// computeMatchScore's function/level/location/comp heuristic (falling back
// to title-inference for function/level when a posting has no explicit
// targeting — true for nearly every board posting) with title-similarity,
// a keyword-match bonus that's hard-capped below "strong" when a
// keyword-rich resume (6+ terms) doesn't clear a 25% hit rate, and two new
// signals: industry (binary — does the posting mention a target industry)
// and years-of-experience (parsed from posting text when stated).
function computeEnrichedFitScore(candidate: FitCandidate, posting: FitPostingLike): number {
  const postingText = `${posting.title} ${posting.description ?? ''}`

  // Hard, categorical gate — a law-firm attorney posting or a hospital
  // physician posting is simply not a fit for a candidate without the
  // license, no matter how well function/level/location/comp line up.
  // Short-circuits before any of the softer scoring below.
  const requiredCredential = detectRequiredCredential(postingText)
  if (!candidateMeetsCredentialGate(candidate, requiredCredential)) return 0

  const base = computeMatchScore(candidate, postingToRole(posting)).score
  const { bonus: keywordBonus, failsGate } = keywordMatchInfo(candidate.resumeKeywords, postingText)

  let score =
    base +
    titleSimilarityBonus(candidate.targetRoleType, posting.title) +
    keywordBonus +
    industryMatchBonus(candidate, postingText) +
    yearsExperienceBonus(candidate.yearsExperience, postingText)
  score = Math.min(100, score)

  // A keyword-rich resume with too few real hits can't be called a
  // "strong" fit no matter how well the other signals line up — this caps
  // the ceiling rather than zeroing the score, since the role can still be
  // a legitimate "good" fit on function/level/location alone.
  if (failsGate) score = Math.min(score, STRONG_FIT_THRESHOLD - 1)
  return score
}

// Reuses the shared enriched scorer, fed the board listing's own targeting
// fields (only meaningful when distribution = 'TARGETED'; an 'OPEN' listing
// has no targeting fields set, which reads through computeMatchScore's
// existing neutral-credit paths for missing data rather than penalizing
// anything).
export function computeBoardListingFitBucket(
  candidate: FitCandidate,
  posting: Pick<
    ExclusiveJobPosting,
    | 'title'
    | 'description'
    | 'targetFunction'
    | 'targetLevel'
    | 'targetRemotePolicy'
    | 'targetLocation'
    | 'location'
    | 'salaryMin'
    | 'salaryMax'
  >
): FitBucket {
  return bucketFromScore(computeEnrichedFitScore(candidate, posting))
}

// How many candidates in the whole pool this pending posting is a
// plausible ('good' bucket or better) fit for — the admin review queue's
// quality signal. Unlike computeBoardListingFitBucket above, this doesn't
// wait for distribution: 'TARGETED' targeting fields to exist (most
// pending admin/ATS/self-submitted rows are 'OPEN' and never get those
// filled in); it falls back to inferring function/level from the posting's
// own title, same heuristic the ATS feed's fit-gate already relies on.
export interface PendingJobMatchCount {
  matched: number
  total: number
  grade: Grade
  // Raw matched/total expressed as 0-100 — the admin-facing display now
  // leads with this instead of the letter grade (still computed above for
  // any caller that wants a coarser bucket; nothing currently reads it).
  scorePercent: number
}

// Provisional thresholds on % of the whole candidate pool that's a plausible
// fit — this is an admin-only comparative signal (not the candidate-facing
// Grade scale in lib/scoring/grade.ts, which is calibrated against a single
// candidate's own hireability). Reuses the same A-F type and color tokens
// purely for visual consistency; revisit these cutoffs once there's a real
// posting volume to calibrate against.
function fitRatioToGrade(matched: number, total: number): Grade {
  if (total === 0) return 'F'
  const ratio = matched / total
  if (ratio >= 0.5) return 'A'
  if (ratio >= 0.3) return 'B'
  if (ratio >= 0.15) return 'C'
  if (ratio >= 0.05) return 'D'
  return 'F'
}

function scorePercent(matched: number, total: number): number {
  return total === 0 ? 0 : Math.round((matched / total) * 100)
}

// Shared select shape for the admin fit-matching candidate pool — used by
// both the Job Board review queue (page.tsx) and the manual-add form's
// live fit preview, so the two never drift out of sync with each other.
export function loadAdminFitCandidates(): Promise<AdminFitCandidate[]> {
  return prisma.candidateProfile.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      primaryFunction: true,
      highestLevelReached: true,
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
      targetIndustries: true,
      isPeopleManager: true,
      hasJD: true,
      hasMD: true,
      hasDO: true,
    },
  })
}

export type FitRankablePosting = Pick<
  ExclusiveJobPosting,
  | 'id'
  | 'title'
  | 'companyName'
  | 'description'
  | 'location'
  | 'salaryMin'
  | 'salaryMax'
  | 'targetFunction'
  | 'targetLevel'
  | 'targetRemotePolicy'
  | 'targetLocation'
>

// Thin wrapper kept for the admin-side callers below, which pass
// AdminFitCandidate (a superset of FitCandidate) and FitRankablePosting (a
// superset of FitPostingLike) — both satisfy the shared scorer's narrower
// parameter types structurally, so this is just a naming/readability layer,
// not a different scoring path.
function boostedMatchScore(candidate: AdminFitCandidate, posting: FitRankablePosting): number {
  return computeEnrichedFitScore(candidate, posting)
}


// The threshold a boosted score has to clear to count as a real, plausible
// fit — shared by every consumer below so "good fit" means the same thing
// everywhere on the admin side.
const GOOD_FIT_THRESHOLD = 45

export function countPendingJobMatches(posting: FitRankablePosting, candidates: AdminFitCandidate[]): PendingJobMatchCount {
  const matched = candidates.filter((c) => boostedMatchScore(c, posting) >= GOOD_FIT_THRESHOLD).length
  return {
    matched,
    total: candidates.length,
    grade: fitRatioToGrade(matched, candidates.length),
    scorePercent: scorePercent(matched, candidates.length),
  }
}

// The reverse of countPendingJobMatches — for one candidate, how well does
// each pending posting fit them, highest first. Powers the "Job
// recommendations" section on the admin candidate detail page.
export function rankPendingPostingsForCandidate<T extends FitRankablePosting>(
  candidate: AdminFitCandidate,
  postings: T[]
): Array<{ posting: T; score: number }> {
  return postings
    .map((posting) => ({ posting, score: boostedMatchScore(candidate, posting) }))
    .sort((a, b) => b.score - a.score)
}

export interface CandidateFitCoverage {
  candidate: AdminFitCandidate
  goodFitCount: number
  totalPostings: number
}

// For every candidate, how many of the given (active) postings are a
// plausible fit — sorted ascending, so candidates with the fewest real
// options surface first. Powers the admin "Candidates with the fewest
// options" section, which flags who most needs manual sourcing attention
// rather than just showing which postings are popular.
export function rankCandidatesByFitCoverage<T extends FitRankablePosting>(
  candidates: AdminFitCandidate[],
  postings: T[]
): CandidateFitCoverage[] {
  return candidates
    .map((candidate) => ({
      candidate,
      goodFitCount: postings.filter((posting) => boostedMatchScore(candidate, posting) >= GOOD_FIT_THRESHOLD).length,
      totalPostings: postings.length,
    }))
    .sort((a, b) => a.goodFitCount - b.goodFitCount)
}

// SurfacedJob rows have no structured function/level/comp fields — only
// title/location free text, since the waterfall that generated them already
// searched using the candidate's own target role. Function/level are now
// inferred from the title (same helpers as the board-listing path above)
// rather than passed through as null — passing null unconditionally meant
// every surfaced job landed in the same "good fit" band by default
// regardless of actual seniority/function match, since the neutral credits
// for missing function+level plus a location match alone were already
// enough to clear the "good" threshold.
export function computeSurfacedJobFitBucket(
  candidate: FitCandidate,
  job: Pick<SurfacedJob, 'title' | 'location' | 'description'>
): FitBucket {
  const score = computeEnrichedFitScore(candidate, {
    title: job.title,
    description: job.description,
    location: job.location,
    salaryMin: null,
    salaryMax: null,
    targetFunction: null,
    targetLevel: null,
    targetRemotePolicy: null,
    targetLocation: null,
  })
  return bucketFromScore(score)
}
