import 'server-only'
import { prisma } from '@/lib/prisma'
import type { RecruiterSubmissionStage } from '@prisma/client'

// §A8 — "a hiring manager sees ONLY candidates submitted to their own
// req(s), never a browsable pool." Two conditions, both enforced here and
// nowhere else more loosely: (1) stage is SUBMITTED or later — REVIEWED/
// SCREENED are the recruiter's own internal triage, not yet "submitted to
// the req"; (2) no active HiringConflictFlag for this hiring
// manager/candidate pair (§A8/§E3.5's conflict rule). Every hiring-manager
// page/action that lists or loads a candidate MUST go through one of the
// two functions below — there is no other query path to a submission in
// this portal.
const VISIBLE_STAGES: RecruiterSubmissionStage[] = ['SUBMITTED', 'INTERVIEWED', 'PLACED', 'PASSED']

export interface VisibleSubmissionSummary {
  submissionId: string
  candidateId: string
  candidateName: string
  reqId: string
  reqTitle: string
  companyName: string
  roleTitle: string
  stage: RecruiterSubmissionStage
  stageUpdatedAt: Date
}

export async function getVisibleSubmissionsForHiringManager(hiringManagerId: string): Promise<VisibleSubmissionSummary[]> {
  const [submissions, activeFlags] = await Promise.all([
    prisma.recruiterCandidateSubmission.findMany({
      where: {
        stage: { in: VISIBLE_STAGES },
        req: { hiringManagerId },
      },
      include: {
        candidate: { select: { firstName: true, lastName: true } },
        req: { select: { id: true, title: true } },
      },
      orderBy: { stageUpdatedAt: 'desc' },
    }),
    prisma.hiringConflictFlag.findMany({
      where: { hiringManagerId, clearedAt: null },
      select: { candidateId: true },
    }),
  ])

  const blockedCandidateIds = new Set(activeFlags.map((f) => f.candidateId))

  return submissions
    .filter((s) => !blockedCandidateIds.has(s.candidateId))
    .map((s) => ({
      submissionId: s.id,
      candidateId: s.candidateId,
      candidateName: [s.candidate.firstName, s.candidate.lastName].filter(Boolean).join(' ').trim() || 'Candidate',
      reqId: s.req!.id,
      reqTitle: s.req!.title,
      companyName: s.companyName,
      roleTitle: s.roleTitle,
      stage: s.stage,
      stageUpdatedAt: s.stageUpdatedAt,
    }))
}

// Single-submission version of the same rule, for detail pages/actions —
// returns null (never a distinguishable "exists but blocked" vs "doesn't
// exist" response) whenever any of: wrong owner, stage too early, or an
// active conflict flag. A hiring manager must never be able to tell the
// difference between "no such candidate" and "conflict-blocked" — same
// non-differencing discipline as §A1.2's identity wall.
export async function getVisibleSubmissionForHiringManager(submissionId: string, hiringManagerId: string) {
  const submission = await prisma.recruiterCandidateSubmission.findUnique({
    where: { id: submissionId },
    include: { req: true },
  })
  if (!submission) return null
  if (!submission.req || submission.req.hiringManagerId !== hiringManagerId) return null
  if (!VISIBLE_STAGES.includes(submission.stage)) return null

  const blocked = await prisma.hiringConflictFlag.findUnique({
    where: { hiringManagerId_candidateId: { hiringManagerId, candidateId: submission.candidateId } },
    select: { clearedAt: true },
  })
  if (blocked && blocked.clearedAt === null) return null

  return submission
}
