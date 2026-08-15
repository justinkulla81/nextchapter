import 'server-only'
import { prisma } from '@/lib/prisma'
import { orgNamesMatch } from '@/lib/text/org-name-match'
import { autoDetectConflict } from '@/lib/hiring/conflict-check'

// Architectural note (Phase 7, §A8): rather than a parallel
// hiring-manager-submission model, a hiring manager's "candidates submitted
// to their req" is built as a new read-path over the SAME
// RecruiterCandidateSubmission pipeline Phase 6 already built (REVIEWED ->
// SCREENED -> SUBMITTED -> INTERVIEWED -> PLACED/PASSED). See
// RecruiterCandidateSubmission.reqId in prisma/schema.prisma.
//
// The open question that decision creates: HOW does a submission's reqId
// get set? The Recruiter portal's submission form (RecruiterSubmissionPanel)
// only ever collects free-text roleTitle/companyName — Phase 7's scope
// notes say not to touch the Recruiter portal beyond reading/extending its
// models, and adding a req-picker to that form would be a Recruiter-portal
// UI change. So this runs the match AUTOMATICALLY instead, triggered from
// the one place a submission's stage already advances
// (advanceSubmissionStage in src/lib/recruiter/submissions.ts) — the moment
// a submission reaches SUBMITTED, which is also the earliest stage a
// hiring manager is meant to see it at all. No Recruiter-portal UI changes
// needed.
function titlesRoughlyMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const normA = norm(a)
  const normB = norm(b)
  if (!normA || !normB) return false
  if (normA === normB) return true
  if (normA.length < 4 || normB.length < 4) return false
  return normA.includes(normB) || normB.includes(normA)
}

// Called from advanceSubmissionStage when a submission reaches SUBMITTED.
// Best-effort and silent on no-match — most submissions won't map to a
// hiring-manager req yet (most companies don't have one onboarded), and
// that's an expected, unremarkable state, not an error.
export async function autoLinkSubmissionToReq(submissionId: string): Promise<void> {
  const submission = await prisma.recruiterCandidateSubmission.findUnique({ where: { id: submissionId } })
  if (!submission || submission.reqId) return

  const openReqs = await prisma.hiringReq.findMany({
    where: { status: 'OPEN' },
    include: { hiringManager: { select: { companyName: true } } },
  })

  const companyMatches = openReqs.filter((req) => orgNamesMatch(req.hiringManager.companyName, submission.companyName))
  if (companyMatches.length === 0) return

  // Prefer a title match among the company matches; fall back to the
  // single company match if there's exactly one (a hiring manager with
  // more than one open req at the same company and no title match is left
  // unlinked rather than guessed at).
  const match =
    companyMatches.find((req) => titlesRoughlyMatch(req.title, submission.roleTitle)) ??
    (companyMatches.length === 1 ? companyMatches[0] : null)
  if (!match) return

  await prisma.recruiterCandidateSubmission.update({ where: { id: submissionId }, data: { reqId: match.id } })

  // First moment this hiring manager and this candidate are actually
  // paired — run the conflict-of-interest auto-detection now, per §A8/§E3.5.
  await autoDetectConflict(match.hiringManagerId, submission.candidateId)
}
