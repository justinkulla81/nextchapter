import 'server-only'
import { prisma } from '@/lib/prisma'
import type { RecruiterSubmissionStage } from '@prisma/client'

// §A8 — "a hiring manager sees ONLY candidates submitted to their own
// req(s), never a browsable pool." Originally two conditions: (1) stage is
// SUBMITTED or later — REVIEWED/SCREENED are the recruiter's own internal
// triage, not yet "submitted to the req"; (2) no active HiringConflictFlag
// for this hiring manager/candidate pair. Condition (2) was ported to
// Talent and re-keyed to EmployerProfile as part of the /hiring -> /talent
// consolidation (see src/lib/talent/conflict-check.ts) — this legacy
// portal only still enforces (1) plus its own self-exclusion check below.
// Every hiring-manager page/action that lists or loads a candidate MUST go
// through one of the two functions below — there is no other query path to
// a submission in this portal.
const VISIBLE_STAGES: RecruiterSubmissionStage[] = ['SUBMITTED', 'INTERVIEWED', 'PLACED', 'PASSED']

// §A1.2.4 / §E4 item 9, generalized to the hiring-manager portal the same
// way introductions.ts generalizes it to the recruiter portal: an identity
// holding both `hiring_manager` and `candidate` grants must never resolve
// their own candidate record from this org-side surface, however unlikely
// it is that a recruiter would submit someone to their own hiring
// manager's req. Resolved from the hiring manager's own auth userId so
// both functions below inherit the protection the same way the active-
// conflict-flag filter already works.
async function ownCandidateIdForHiringManager(hiringManagerId: string): Promise<string | null> {
  const hiringManager = await prisma.hiringManager.findUnique({ where: { id: hiringManagerId }, select: { userId: true } })
  if (!hiringManager?.userId) return null
  const ownCandidate = await prisma.candidateProfile.findUnique({
    where: { userId: hiringManager.userId },
    select: { id: true },
  })
  return ownCandidate?.id ?? null
}

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
  const [submissions, ownCandidateId] = await Promise.all([
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
    ownCandidateIdForHiringManager(hiringManagerId),
  ])

  // Conflict-of-interest flagging was ported to Talent and re-keyed from
  // HiringConflictFlag.hiringManagerId to .employerId as part of the
  // /hiring -> /talent consolidation (see src/lib/talent/conflict-check.ts)
  // — HiringManager has no equivalent row to filter on anymore, so this
  // legacy portal's own conflict-blocking is now inert pending its removal
  // in the next step. Self-exclusion (below) is unrelated and still applies.
  const blockedCandidateIds = new Set<string>()
  if (ownCandidateId) blockedCandidateIds.add(ownCandidateId)

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
// exist" response) whenever wrong owner, stage too early, or (formerly)
// an active conflict flag — see the module comment above for why the
// conflict-flag check no longer runs here.
export async function getVisibleSubmissionForHiringManager(submissionId: string, hiringManagerId: string) {
  const submission = await prisma.recruiterCandidateSubmission.findUnique({
    where: { id: submissionId },
    include: { req: true },
  })
  if (!submission) return null
  if (!submission.req || submission.req.hiringManagerId !== hiringManagerId) return null
  if (!VISIBLE_STAGES.includes(submission.stage)) return null

  const ownCandidateId = await ownCandidateIdForHiringManager(hiringManagerId)
  if (ownCandidateId && submission.candidateId === ownCandidateId) return null

  // See the comment in getVisibleSubmissionsForHiringManager above —
  // conflict-of-interest flagging now lives on Talent's EmployerProfile-
  // keyed HiringConflictFlag, so there's nothing left to check here.

  return submission
}
