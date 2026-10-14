import 'server-only'
import type { CompanySizeBand } from '@prisma/client'
import { computeBoardListingFitBucket, isVeryStrongBoardFit } from '@/lib/jobs/job-fit-bucket'
import { legacyComputeBoardListingFitBucket, legacyIsVeryStrongBoardFit } from '@/lib/jobs/job-fit-bucket-legacy'
import type { FitBucket } from '@/lib/jobs/fit-bucket-types'

// Which fit scoring picks the jobs in member emails — fresh-job alerts, Job
// Search Daily and the coach weekly digest. The board moved to fit scoring v2
// on 2026-10-14; the emails stay on the frozen pre-v2 logic
// (job-fit-bucket-legacy.ts) until the owner has seen who would be emailed
// and approves. To switch: set FIT_SCORING_V2_FOR_EMAILS=true in Vercel
// (Production) and redeploy. Unset or anything else keeps 'legacy'.

export type FitScoringVersion = 'v2' | 'legacy'

export function emailFitScoringVersion(): FitScoringVersion {
  return process.env.FIT_SCORING_V2_FOR_EMAILS === 'true' ? 'v2' : 'legacy'
}

type Candidate = Parameters<typeof computeBoardListingFitBucket>[0]
type Posting = Parameters<typeof computeBoardListingFitBucket>[1]

export function boardListingFitBucketFor(
  version: FitScoringVersion,
  candidate: Candidate,
  posting: Posting,
  companySizeBand?: CompanySizeBand | null
): FitBucket {
  return version === 'v2'
    ? computeBoardListingFitBucket(candidate, posting, companySizeBand)
    : legacyComputeBoardListingFitBucket(candidate, posting, companySizeBand)
}

export function isVeryStrongBoardFitFor(
  version: FitScoringVersion,
  candidate: Candidate,
  posting: Posting,
  postingLevel: string | null
): boolean {
  return version === 'v2' ? isVeryStrongBoardFit(candidate, posting, postingLevel) : legacyIsVeryStrongBoardFit(candidate, posting, postingLevel)
}
