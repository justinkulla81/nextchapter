import type { RecruiterSubmissionStage } from '@prisma/client'

// Pure, DB-free stage helpers — split out of submissions.ts specifically so
// client components (RecruiterSubmissionPanel) can import stage
// labels/ordering without pulling in submissions.ts's 'server-only' +
// Prisma-touching functions into the browser bundle.
export const STAGE_ORDER: Exclude<RecruiterSubmissionStage, 'PASSED'>[] = [
  'REVIEWED',
  'SCREENED',
  'SUBMITTED',
  'INTERVIEWED',
  'PLACED',
]

export const STAGE_LABEL: Record<RecruiterSubmissionStage, string> = {
  REVIEWED: 'Reviewed',
  SCREENED: 'Screened',
  SUBMITTED: 'Submitted',
  INTERVIEWED: 'Interviewed',
  PLACED: 'Placed',
  PASSED: 'Passed',
}

// The stage a recruiter can move a submission to next, in order — PASSED is
// offered separately (passSubmission) since it can happen from any
// non-terminal stage, not just the one after it.
export function nextStage(current: RecruiterSubmissionStage): Exclude<RecruiterSubmissionStage, 'PASSED'> | null {
  const idx = STAGE_ORDER.indexOf(current as Exclude<RecruiterSubmissionStage, 'PASSED'>)
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return null
  return STAGE_ORDER[idx + 1]
}
