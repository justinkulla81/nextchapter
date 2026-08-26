import 'server-only'
import { prisma } from '@/lib/prisma'
import type { RecruiterCandidateSubmission, RecruiterSubmissionStage } from '@prisma/client'
import { orgNamesMatch } from '@/lib/text/org-name-match'
import { isCandidateBlockedForEmployer } from '@/lib/talent/conflict-check'

// InterviewPanel/Scorecard are keyed on RecruiterCandidateSubmission, which
// has no direct FK to EmployerProfile — a submission only carries a
// free-text companyName (set by the recruiter). The retired Hiring Manager
// portal solved the equivalent problem via autoLinkSubmissionToReq's
// company-name matching (see src/lib/hiring/req-matching.ts); this is the
// same approach, ported for Talent so the Candidate Inbox can offer
// interview-panel/scorecard setup for a submission that plausibly belongs
// to this employer, without adding a new required FK this phase.
const VISIBLE_SUBMISSION_STAGES: RecruiterSubmissionStage[] = ['SUBMITTED', 'INTERVIEWED', 'PLACED', 'PASSED']

// Returns the most-recently-updated submission for this candidate whose
// free-text companyName matches this employer's companyName, has reached a
// "submitted or later" stage, and isn't blocked by an active conflict flag
// — or null if no such submission exists (the common case: most candidates
// in the Candidate Inbox never came through a recruiter submission at all).
export async function getEligibleSubmissionForEmployerCandidate(
  employerId: string,
  candidateId: string
): Promise<RecruiterCandidateSubmission | null> {
  const employer = await prisma.employerProfile.findUnique({ where: { id: employerId }, select: { companyName: true } })
  if (!employer) return null

  const blocked = await isCandidateBlockedForEmployer(employerId, candidateId)
  if (blocked) return null

  const submissions = await prisma.recruiterCandidateSubmission.findMany({
    where: { candidateId, stage: { in: VISIBLE_SUBMISSION_STAGES } },
    orderBy: { stageUpdatedAt: 'desc' },
  })

  return submissions.find((s) => orgNamesMatch(s.companyName, employer.companyName)) ?? null
}

// Defense-in-depth check for server actions that only receive a
// submissionId (e.g. from a bound form action) — re-derives the
// candidateId and re-runs the same eligibility check, same "never trust
// that the page already checked" discipline as the retired Hiring Manager
// portal's requireVisible.
export async function assertSubmissionVisibleToEmployer(
  employerId: string,
  submissionId: string
): Promise<RecruiterCandidateSubmission | null> {
  const submission = await prisma.recruiterCandidateSubmission.findUnique({ where: { id: submissionId } })
  if (!submission) return null

  const eligible = await getEligibleSubmissionForEmployerCandidate(employerId, submission.candidateId)
  if (!eligible || eligible.id !== submissionId) return null

  return submission
}
