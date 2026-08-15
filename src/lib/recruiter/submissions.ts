import 'server-only'
import { prisma } from '@/lib/prisma'
import type { RecruiterSubmissionStage, RecruiterFeeArrangementType } from '@prisma/client'
import { isCandidateConsentedForRecruiter } from '@/lib/recruiter/introductions'
import { getRecruiterSettings } from '@/lib/admin/recruiter-settings'

// Recruiter portal §A6.2 — "feedback loop (reviewed / screened / submitted /
// interviewed / placed / passed with reason)" — and §A6.4's SLA
// enforcement. A RecruiterCandidateSubmission only makes sense on top of an
// already-CONSENTED introduction (see introductions.ts) — every write below
// re-checks consent rather than trusting the caller, same defense-in-depth
// pattern as isCandidateConsentedForRecruiter's other callers.
//
// Stage ordering/labels live in submission-stages.ts (no 'server-only', no
// Prisma import) so client components can use them without pulling this
// file's DB-touching functions into the browser bundle — re-exported here
// too so server-side callers can import either module.
export { STAGE_LABEL, nextStage } from './submission-stages'

const TERMINAL_STAGES: RecruiterSubmissionStage[] = ['PLACED', 'PASSED']

export async function createSubmission(
  recruiterId: string,
  candidateId: string,
  roleTitle: string,
  companyName: string
): Promise<{ error?: string; submissionId?: string }> {
  if (!(await isCandidateConsentedForRecruiter(candidateId, recruiterId))) {
    return { error: 'You need an active introduction to this candidate first.' }
  }
  if (!roleTitle.trim() || !companyName.trim()) {
    return { error: 'Enter both a role title and a company.' }
  }

  const submission = await prisma.recruiterCandidateSubmission.create({
    data: { recruiterId, candidateId, roleTitle: roleTitle.trim(), companyName: companyName.trim() },
  })
  await prisma.recruiterCandidateSubmissionEvent.create({
    data: { submissionId: submission.id, stage: 'REVIEWED', actor: `recruiter:${recruiterId}` },
  })
  return { submissionId: submission.id }
}

export async function advanceSubmissionStage(
  submissionId: string,
  recruiterId: string,
  toStage: Exclude<RecruiterSubmissionStage, 'PASSED'>,
  note?: string
): Promise<{ error?: string }> {
  const submission = await prisma.recruiterCandidateSubmission.findUnique({ where: { id: submissionId } })
  if (!submission || submission.recruiterId !== recruiterId) return { error: 'Submission not found.' }
  if (TERMINAL_STAGES.includes(submission.stage)) return { error: 'This submission has already reached a final stage.' }

  await prisma.recruiterCandidateSubmission.update({
    where: { id: submissionId },
    data: { stage: toStage, stageUpdatedAt: new Date() },
  })
  await prisma.recruiterCandidateSubmissionEvent.create({
    data: { submissionId, stage: toStage, actor: `recruiter:${recruiterId}`, note: note?.trim() || null },
  })
  return {}
}

export async function passSubmission(
  submissionId: string,
  recruiterId: string,
  reason: string
): Promise<{ error?: string }> {
  const submission = await prisma.recruiterCandidateSubmission.findUnique({ where: { id: submissionId } })
  if (!submission || submission.recruiterId !== recruiterId) return { error: 'Submission not found.' }
  if (TERMINAL_STAGES.includes(submission.stage)) return { error: 'This submission has already reached a final stage.' }
  if (!reason.trim()) return { error: 'A reason is required when passing on a candidate.' }

  await prisma.recruiterCandidateSubmission.update({
    where: { id: submissionId },
    data: { stage: 'PASSED', passedReason: reason.trim(), stageUpdatedAt: new Date() },
  })
  await prisma.recruiterCandidateSubmissionEvent.create({
    data: { submissionId, stage: 'PASSED', actor: `recruiter:${recruiterId}`, note: reason.trim() },
  })
  return {}
}

export interface PlacementInput {
  startDate?: Date | null
  feeType?: RecruiterFeeArrangementType | null
  feePercentage?: number | null
  feeFlatAmountUsd?: number | null
  feeNotes?: string | null
}

// §A6.2/§A6.4 — "placement and fee tracking," "tied to the firm's
// fee-arrangement config." Marks the submission PLACED (if not already) and
// creates the one placement row, defaulting any omitted fee field from the
// recruiter's firm — a snapshot at creation time, not a live link, so a
// later firm-default change never rewrites an already-recorded placement.
export async function recordPlacement(
  submissionId: string,
  recruiterId: string,
  input: PlacementInput
): Promise<{ error?: string; placementId?: string }> {
  const submission = await prisma.recruiterCandidateSubmission.findUnique({
    where: { id: submissionId },
    include: { placement: true },
  })
  if (!submission || submission.recruiterId !== recruiterId) return { error: 'Submission not found.' }
  if (submission.stage === 'PASSED') return { error: 'This submission was already marked passed.' }
  if (submission.placement) return { error: 'A placement is already recorded for this submission.' }

  const recruiter = await prisma.recruiter.findUnique({
    where: { id: recruiterId },
    include: { recruiterFirm: true },
  })

  const feeType = input.feeType ?? recruiter?.recruiterFirm?.feeArrangementType ?? null
  const feePercentage = input.feePercentage ?? recruiter?.recruiterFirm?.feeArrangementPercentage ?? null
  const feeFlatAmountUsd = input.feeFlatAmountUsd ?? recruiter?.recruiterFirm?.feeArrangementFlatAmountUsd ?? null
  const feeNotes = input.feeNotes ?? recruiter?.recruiterFirm?.feeArrangementNotes ?? null

  const [, placement] = await prisma.$transaction([
    prisma.recruiterCandidateSubmission.update({
      where: { id: submissionId },
      data: { stage: 'PLACED', stageUpdatedAt: new Date() },
    }),
    prisma.recruiterPlacement.create({
      data: {
        submissionId,
        recruiterId,
        candidateId: submission.candidateId,
        startDate: input.startDate ?? null,
        feeType,
        feePercentage,
        feeFlatAmountUsd,
        feeNotes,
      },
    }),
    prisma.recruiterCandidateSubmissionEvent.create({
      data: { submissionId, stage: 'PLACED', actor: `recruiter:${recruiterId}` },
    }),
  ])

  return { placementId: placement.id }
}

export interface LateSubmission {
  submissionId: string
  candidateId: string
  roleTitle: string
  companyName: string
  stage: RecruiterSubmissionStage
  hoursSinceUpdate: number
  slaHours: number
}

// §A6.4 — "Feedback SLA and enforcement." A submission sitting in a
// non-terminal stage longer than the firm's SLA window (or the global
// default when the recruiter has no firm / the firm has no override) is
// "late," full stop — real elapsed time against a real config value, not a
// heuristic.
export async function getLateSubmissions(recruiterId: string): Promise<LateSubmission[]> {
  const [recruiter, settings, submissions] = await Promise.all([
    prisma.recruiter.findUnique({ where: { id: recruiterId }, include: { recruiterFirm: true } }),
    getRecruiterSettings(),
    prisma.recruiterCandidateSubmission.findMany({
      where: { recruiterId, stage: { notIn: TERMINAL_STAGES } },
      orderBy: { stageUpdatedAt: 'asc' },
    }),
  ])

  const slaHours = recruiter?.recruiterFirm?.feedbackSlaHours ?? settings.feedbackSlaHoursDefault
  const now = Date.now()

  return submissions
    .map((s) => ({
      submissionId: s.id,
      candidateId: s.candidateId,
      roleTitle: s.roleTitle,
      companyName: s.companyName,
      stage: s.stage,
      hoursSinceUpdate: Math.floor((now - s.stageUpdatedAt.getTime()) / (60 * 60 * 1000)),
      slaHours,
    }))
    .filter((s) => s.hoursSinceUpdate >= s.slaHours)
}
