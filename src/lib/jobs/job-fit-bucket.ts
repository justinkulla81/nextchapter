import 'server-only'
import type { CandidateProfile, ExclusiveJobPosting, SurfacedJob } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { computeMatchScore } from '@/lib/matching/compute-match-score'
import { inferFunctionFromTitle, inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import { isVagueTargetRole } from '@/lib/constants/onboarding'
import type { FitBucket } from '@/lib/jobs/fit-bucket-types'
import type { Grade } from '@/lib/scoring/grade'

// The "Quick-read" fit signal shown on every Discover card — free, no LLM
// call, computed for every candidate x listing pair. Deliberately a bucket,
// never a raw number, matching the sitewide rule against showing precise
// scores anywhere a candidate can see them. The real per-listing fit
// analysis (analyzeJobFit) only runs on demand, from the "See full fit"
// bridge action. See fit-bucket-types.ts for the FitBucket type/label
// (kept separate, with no 'server-only' import, so client components can
// render the label without pulling this file's server-only deps in).

// The score a listing needs to clear to count as a "strong" fit — reused
// by the ATS admission gate (a listing is only worth adding if the BEST
// candidate in the whole pool would see it as strong, not just "good").
export const STRONG_FIT_THRESHOLD = 70

function bucketFromScore(score: number): FitBucket {
  if (score >= STRONG_FIT_THRESHOLD) return 'strong'
  if (score >= 45) return 'good'
  return 'stretch'
}

type FitCandidate = Pick<
  CandidateProfile,
  'primaryFunction' | 'highestLevelReached' | 'remotePreference' | 'currentCity' | 'openToRelocation' | 'targetCompMin' | 'compFlexible'
>

// Admin review additionally weighs two signals computeMatchScore doesn't
// see at all: how closely the posting's title matches what the candidate
// themselves said they're after, and whether the posting's text mentions
// skills/tools/certs pulled from their resume. Neither is precise enough to
// fold into the shared P0 heuristic (candidate-facing everywhere else) —
// this is admin curation aid only, so a looser bonus-on-top is fine.
// id/firstName/lastName/email are only needed by the two candidate-centric
// ranking helpers below (rankPendingPostingsForCandidate,
// rankCandidatesByFitCoverage) — harmless to carry on every caller.
export type AdminFitCandidate = FitCandidate &
  Pick<CandidateProfile, 'id' | 'firstName' | 'lastName' | 'email' | 'targetRoleType' | 'resumeKeywords'>

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

function keywordMatchBonus(resumeKeywords: string[], postingText: string): number {
  if (resumeKeywords.length === 0) return 0
  const lower = postingText.toLowerCase()
  const hits = resumeKeywords.filter((kw) => kw && lower.includes(kw.toLowerCase())).length
  return Math.round((hits / resumeKeywords.length) * 10)
}

// Reuses computeMatchScore's function/level/location/comp heuristic as-is —
// same P0 scoring the Match Inbox already relies on, just fed the board
// listing's own targeting fields (only meaningful when distribution =
// 'TARGETED'; an 'OPEN' listing has no targeting fields set, which reads
// through computeMatchScore's existing neutral-credit paths for missing
// data rather than penalizing anything).
export function computeBoardListingFitBucket(
  candidate: FitCandidate,
  posting: Pick<
    ExclusiveJobPosting,
    'title' | 'targetFunction' | 'targetLevel' | 'targetRemotePolicy' | 'targetLocation' | 'location' | 'salaryMin' | 'salaryMax'
  >
): FitBucket {
  // Most board postings (self-submitted OPEN listings, every ATS-fed row)
  // never have targetFunction/targetLevel set — those only exist for
  // recruiter TARGETED listings. Without the title-inference fallback here,
  // computeMatchScore silently fell back to neutral credit for both, so the
  // fit badge ended up driven almost entirely by location/comp — a senior
  // candidate could see an entry-level analyst role labeled "Good fit"
  // purely because the location matched. Falls back the same way the
  // admin-side postingToRole below already does.
  const { score } = computeMatchScore(candidate, {
    primaryFunction: posting.targetFunction ?? inferFunctionFromTitle(posting.title),
    roleLevel: posting.targetLevel ?? inferLevelFromTitle(posting.title),
    remotePolicy: posting.targetRemotePolicy ?? (inferRemoteFromLocation(posting.location) ? 'remote' : null),
    locationRequirement: posting.targetLocation ?? posting.location,
    compMin: posting.salaryMin,
    compMax: posting.salaryMax,
  })
  return bucketFromScore(score)
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
      openToRelocation: true,
      targetCompMin: true,
      compFlexible: true,
      targetRoleType: true,
      resumeKeywords: true,
      isPeopleManager: true,
    },
  })
}

// ATS-fed OPEN postings never have targetRemotePolicy set (that field only
// exists for recruiter TARGETED listings) — without this, a posting whose
// own location literally says "Remote" never gets read as remote-friendly,
// under-crediting fit for candidates who'd be a good match for it.
function inferRemoteFromLocation(location: string | null): boolean {
  return location != null && /\bremote\b/i.test(location)
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

function postingToRole(posting: FitRankablePosting) {
  return {
    primaryFunction: posting.targetFunction ?? inferFunctionFromTitle(posting.title),
    roleLevel: posting.targetLevel ?? inferLevelFromTitle(posting.title),
    remotePolicy: posting.targetRemotePolicy ?? (inferRemoteFromLocation(posting.location) ? 'remote' : null),
    locationRequirement: posting.targetLocation ?? posting.location,
    compMin: posting.salaryMin,
    compMax: posting.salaryMax,
  }
}

// The same boosted (base match + title-similarity + keyword-match) score
// used everywhere admin-side fit is computed — factored out so the
// posting-centric (countPendingJobMatches) and candidate-centric
// (rankPendingPostingsForCandidate, rankCandidatesByFitCoverage) views never
// drift apart on what "a good fit" means.
function boostedMatchScore(candidate: AdminFitCandidate, posting: FitRankablePosting): number {
  const base = computeMatchScore(candidate, postingToRole(posting)).score
  const postingText = `${posting.title} ${posting.description ?? ''}`
  const boosted =
    base + titleSimilarityBonus(candidate.targetRoleType, posting.title) + keywordMatchBonus(candidate.resumeKeywords, postingText)
  return Math.min(100, boosted)
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
export function computeSurfacedJobFitBucket(candidate: FitCandidate, job: Pick<SurfacedJob, 'title' | 'location'>): FitBucket {
  const { score } = computeMatchScore(candidate, {
    primaryFunction: inferFunctionFromTitle(job.title),
    roleLevel: inferLevelFromTitle(job.title),
    remotePolicy: inferRemoteFromLocation(job.location) ? 'remote' : null,
    locationRequirement: job.location,
    compMin: null,
    compMax: null,
  })
  return bucketFromScore(score)
}
