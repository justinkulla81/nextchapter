import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { guessTitleFromConfirmationSubject } from './ats-patterns'
import { applyInterviewLandedRewrite, applyInterviewPatternConfirmedRewrite } from '@/lib/scoring/rewrite-actions'
import type { EmailActivityType } from '@prisma/client'

// Mirrors an email-detected application/outcome into the candidate's
// JobPosting list (the same list the URL-paste fit-check flow uses — see
// JobPostingSource in schema.prisma). Only data fields are touched here —
// deliberately never triggers generateInterviewPrep or a cover letter draft,
// since those are metered LLM calls and this runs on every page-visit sync;
// a candidate can still get interview prep for a matched posting that has
// extractedText by using the existing manual flow.
export async function syncJobPostingFromEmail(
  candidateId: string,
  activityType: EmailActivityType,
  companyName: string | null,
  subject: string,
  emailDate: Date
): Promise<void> {
  if (!companyName) return
  const normalized = normalizeOrgName(companyName)
  if (!normalized) return

  if (activityType === 'APPLICATION_CONFIRMATION') {
    // A single application commonly triggers two confirmation emails (the
    // ATS's own receipt plus LinkedIn's separate notification) — dedupe by
    // company + calendar day so it isn't recorded as two applications.
    const sameDayRows = await prisma.jobPosting.findMany({
      where: {
        candidateId,
        source: 'EMAIL_DETECTED',
        companyName: { not: null },
        appliedAt: {
          gte: new Date(emailDate.getFullYear(), emailDate.getMonth(), emailDate.getDate()),
          lt: new Date(emailDate.getFullYear(), emailDate.getMonth(), emailDate.getDate() + 1),
        },
      },
      select: { companyName: true },
    })
    if (sameDayRows.some((r) => normalizeOrgName(r.companyName ?? '') === normalized)) return

    await prisma.jobPosting.create({
      data: {
        candidateId,
        source: 'EMAIL_DETECTED',
        fetchStatus: 'no_url',
        companyName,
        title: guessTitleFromConfirmationSubject(subject),
        appliedAt: emailDate,
      },
    })
    return
  }

  if (activityType !== 'INTERVIEW_INVITE' && activityType !== 'REJECTION') return

  // Match against any of the candidate's applications for this company —
  // manual (URL-pasted) or email-detected — most recently applied first, so
  // a repeat application to the same company updates the newest one.
  const candidates = await prisma.jobPosting.findMany({
    where: { candidateId, companyName: { not: null }, appliedAt: { not: null } },
    orderBy: { appliedAt: 'desc' },
  })
  const match = candidates.find((p) => p.companyName && normalizeOrgName(p.companyName) === normalized)
  if (!match) return

  if (activityType === 'INTERVIEW_INVITE' && !match.interviewLandedAt) {
    await prisma.jobPosting.update({ where: { id: match.id }, data: { interviewLandedAt: emailDate } })
    await applyInterviewLandedRewrite(candidateId)
    await applyInterviewPatternConfirmedRewrite(candidateId)
  }

  if (activityType === 'REJECTION' && !match.declinedAt && !match.offerReceivedAt) {
    await prisma.jobPosting.update({ where: { id: match.id }, data: { declinedAt: emailDate } })
  }
}
