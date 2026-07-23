import 'server-only'
import type { CandidateProfile, ExclusiveJobPosting, SurfacedJob } from '@prisma/client'
import { computeMatchScore } from '@/lib/matching/compute-match-score'

// The "Quick-read" fit signal shown on every Discover card — free, no LLM
// call, computed for every candidate x listing pair. Deliberately a bucket,
// never a raw number, matching the sitewide rule against showing precise
// scores anywhere a candidate can see them. The real per-listing fit
// analysis (analyzeJobFit) only runs on demand, from the "See full fit"
// bridge action.
export type FitBucket = 'strong' | 'good' | 'stretch'

export const FIT_BUCKET_LABEL: Record<FitBucket, string> = {
  strong: 'Strong fit',
  good: 'Good fit',
  stretch: 'Stretch',
}

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
