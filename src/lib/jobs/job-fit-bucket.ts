import 'server-only'
import type { CandidateProfile, ExclusiveJobPosting, SurfacedJob } from '@prisma/client'
import { computeMatchScore } from '@/lib/matching/compute-match-score'
import { inferFunctionFromTitle, inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import type { FitBucket } from '@/lib/jobs/fit-bucket-types'

// The "Quick-read" fit signal shown on every Discover card — free, no LLM
// call, computed for every candidate x listing pair. Deliberately a bucket,
// never a raw number, matching the sitewide rule against showing precise
// scores anywhere a candidate can see them. The real per-listing fit
// analysis (analyzeJobFit) only runs on demand, from the "See full fit"
// bridge action. See fit-bucket-types.ts for the FitBucket type/label
// (kept separate, with no 'server-only' import, so client components can
// render the label without pulling this file's server-only deps in).

function bucketFromScore(score: number): FitBucket {
  if (score >= 70) return 'strong'
  if (score >= 45) return 'good'
  return 'stretch'
}

type FitCandidate = Pick<
  CandidateProfile,
  'primaryFunction' | 'highestLevelReached' | 'remotePreference' | 'currentCity' | 'openToRelocation' | 'targetCompMin' | 'compFlexible'
>

// Reuses computeMatchScore's function/level/location/comp heuristic as-is —
// same P0 scoring the Match Inbox already relies on, just fed the board
// listing's own targeting fields (only meaningful when distribution =
// 'TARGETED'; an 'OPEN' listing has no targeting fields set, which reads
// through computeMatchScore's existing neutral-credit paths for missing
// data rather than penalizing anything).
export function computeBoardListingFitBucket(
  candidate: FitCandidate,
  posting: Pick<ExclusiveJobPosting, 'targetFunction' | 'targetLevel' | 'targetRemotePolicy' | 'targetLocation' | 'salaryMin' | 'salaryMax'>
): FitBucket {
  const { score } = computeMatchScore(candidate, {
    primaryFunction: posting.targetFunction,
    roleLevel: posting.targetLevel,
    remotePolicy: posting.targetRemotePolicy,
    locationRequirement: posting.targetLocation,
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
}

export function countPendingJobMatches(
  posting: Pick<
    ExclusiveJobPosting,
    'title' | 'location' | 'salaryMin' | 'salaryMax' | 'targetFunction' | 'targetLevel' | 'targetRemotePolicy' | 'targetLocation'
  >,
  candidates: FitCandidate[]
): PendingJobMatchCount {
  const role = {
    primaryFunction: posting.targetFunction ?? inferFunctionFromTitle(posting.title),
    roleLevel: posting.targetLevel ?? inferLevelFromTitle(posting.title),
    remotePolicy: posting.targetRemotePolicy,
    locationRequirement: posting.targetLocation ?? posting.location,
    compMin: posting.salaryMin,
    compMax: posting.salaryMax,
  }
  const matched = candidates.filter((c) => computeMatchScore(c, role).score >= 45).length
  return { matched, total: candidates.length }
}

// SurfacedJob rows have no structured function/level/comp fields — only
// title/location free text, since the waterfall that generated them already
// searched using the candidate's own target role. Passing nulls through the
// same computeMatchScore lands on its existing "insufficient data" neutral
// credit for those dimensions, so this is a real reuse, not a special case.
export function computeSurfacedJobFitBucket(candidate: FitCandidate, job: Pick<SurfacedJob, 'location'>): FitBucket {
  const { score } = computeMatchScore(candidate, {
    primaryFunction: null,
    roleLevel: null,
    remotePolicy: null,
    locationRequirement: job.location,
    compMin: null,
    compMax: null,
  })
  return bucketFromScore(score)
}
