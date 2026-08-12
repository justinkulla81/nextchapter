import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName, orgNamesMatch, fixAllCapsCompanyName } from '@/lib/text/org-name-match'
import { guessTitleFromConfirmationSubject } from './ats-patterns'
import { applyInterviewLandedRewrite, applyInterviewPatternConfirmedRewrite } from '@/lib/scoring/rewrite-actions'
import { autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import type { EmailActivityType } from '@prisma/client'

// Real, verified signal — a Gmail-detected application confirmation is
// exactly as real as clicking "Mark Applied" on a tracked posting (see
// markApplied in find-my-job/actions.ts) — so it earns the same Search
// Action rather than silently never crediting a candidate who applies
// straight from a job board and never opens NextChapter to log it.
async function creditApplicationSubmitted(candidateId: string) {
  const effort = estimateActionEffort({ actionType: 'JOB_APPLICATION_SUBMITTED' })
  await autoCompleteEngagementAction(candidateId, {
    actionType: 'JOB_APPLICATION_SUBMITTED',
    text: 'Apply to a job',
    points: effort.points,
    estimatedMinutes: effort.minutes,
  })
}

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
    // Before recording this as a new application, check whether the
    // candidate already has *any* tracked posting for this company —
    // most commonly a manually URL-pasted row they added before applying.
    // Without this check, a confirmation email always created a second,
    // separate "My Applications" card even when the candidate was already
    // tracking that exact job — the manual row's appliedAt just never got
    // set, and the actual application looked untracked.
    const existingForCompany = await prisma.jobPosting.findMany({
      where: { candidateId, companyName: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, companyName: true, appliedAt: true },
    })
    const existingMatch = existingForCompany.find((p) => orgNamesMatch(p.companyName ?? '', companyName))
    if (existingMatch) {
      if (!existingMatch.appliedAt) {
        await prisma.jobPosting.update({ where: { id: existingMatch.id }, data: { appliedAt: emailDate } })
        await creditApplicationSubmitted(candidateId)
      }
      return
    }

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
    if (sameDayRows.some((r) => orgNamesMatch(r.companyName ?? '', companyName))) return

    await prisma.jobPosting.create({
      data: {
        candidateId,
        source: 'EMAIL_DETECTED',
        fetchStatus: 'no_url',
        companyName: fixAllCapsCompanyName(companyName),
        title: guessTitleFromConfirmationSubject(subject),
        appliedAt: emailDate,
      },
    })
    await creditApplicationSubmitted(candidateId)
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
  const match = candidates.find((p) => p.companyName && orgNamesMatch(p.companyName, companyName))
  if (!match) return

  if (activityType === 'INTERVIEW_INVITE' && !match.interviewLandedAt) {
    await prisma.jobPosting.update({ where: { id: match.id }, data: { interviewLandedAt: emailDate } })
    await applyInterviewLandedRewrite(candidateId)
    await applyInterviewPatternConfirmedRewrite(candidateId)
  }

  if (activityType === 'REJECTION' && !match.declinedAt && !match.offerReceivedAt) {
    await prisma.jobPosting.update({
      where: { id: match.id },
      data: { declinedAt: emailDate, declinedBy: 'COMPANY' },
    })
  }
}
