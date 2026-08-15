import 'server-only'
import { prisma } from '@/lib/prisma'

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

// Called from recordPlacement (src/lib/recruiter/submissions.ts) the moment
// a hiring-manager-linked submission is marked PLACED. §A8 "90-day
// post-hire feedback" / §E2.2 — this row is the real seed of outcome data,
// stored for real even though nothing reads it back yet.
export async function schedulePostHireFeedback(submissionId: string, reqId: string, anchorDate: Date): Promise<void> {
  const req = await prisma.hiringReq.findUnique({ where: { id: reqId }, select: { hiringManagerId: true } })
  if (!req) return

  const dueAt = new Date(anchorDate.getTime() + NINETY_DAYS_MS)

  // Idempotent — recordPlacement already guards against a submission
  // reaching PLACED twice, but upsert keeps this safe even if that ever
  // changes.
  await prisma.postHireFeedback.upsert({
    where: { submissionId },
    create: { submissionId, hiringManagerId: req.hiringManagerId, dueAt },
    update: {},
  })
}

export interface DuePostHireFeedback {
  id: string
  submissionId: string
  candidateName: string
  roleTitle: string
  companyName: string
  dueAt: Date
  isOverdue: boolean
}

// Feedbacks whose 90-day window has arrived (or passed) and haven't been
// submitted yet — what the hiring-manager Overview page surfaces as an
// action item.
export async function getDuePostHireFeedbacks(hiringManagerId: string): Promise<DuePostHireFeedback[]> {
  const rows = await prisma.postHireFeedback.findMany({
    where: { hiringManagerId, submittedAt: null, dueAt: { lte: new Date() } },
    include: {
      submission: { include: { candidate: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { dueAt: 'asc' },
  })

  const now = Date.now()
  return rows.map((r) => ({
    id: r.id,
    submissionId: r.submissionId,
    candidateName: [r.submission.candidate.firstName, r.submission.candidate.lastName].filter(Boolean).join(' ').trim() || 'Candidate',
    roleTitle: r.submission.roleTitle,
    companyName: r.submission.companyName,
    dueAt: r.dueAt,
    isOverdue: r.dueAt.getTime() < now,
  }))
}

export async function getPostHireFeedback(submissionId: string, hiringManagerId: string) {
  return prisma.postHireFeedback.findFirst({ where: { submissionId, hiringManagerId } })
}

export async function submitPostHireFeedback(
  submissionId: string,
  hiringManagerId: string,
  input: { howIsItGoingRating: number; wouldHireAgain: boolean; notes: string }
): Promise<{ error?: string }> {
  const feedback = await prisma.postHireFeedback.findFirst({ where: { submissionId, hiringManagerId } })
  if (!feedback) return { error: 'No post-hire feedback request found for this candidate.' }
  if (feedback.submittedAt) return { error: 'Feedback has already been submitted for this candidate.' }
  if (input.howIsItGoingRating < 1 || input.howIsItGoingRating > 5) return { error: 'Rating must be between 1 and 5.' }

  await prisma.postHireFeedback.update({
    where: { id: feedback.id },
    data: {
      howIsItGoingRating: input.howIsItGoingRating,
      wouldHireAgain: input.wouldHireAgain,
      notes: input.notes.trim() || null,
      submittedAt: new Date(),
    },
  })
  return {}
}
