'use server'

import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { syncReferenceDelta } from '@/lib/scoring/reference-delta'
import { REFERENCE_TOKEN_EXPIRY_DAYS } from '@/lib/constants/references'
import { generateReferenceQuotes } from '@/lib/references/testimony-processing'
import { applyReferenceCompletedRewrite } from '@/lib/scoring/rewrite-actions'
import { parseReferenceFormData, parseReferenceCheckExtension } from '@/lib/references/parse-reference-form'
import { getCurrentWeekSprint, autoCompleteEngagementAction } from '@/lib/weekly/sprint'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { sendReferenceDeclinedNotice } from '@/lib/email/send-reference-declined-notice'
import type { RelativeRank, HireAgainLevel, DepartureContext, TakeAgainLevel, TrustedScopeLevel } from '@prisma/client'

export type FormState = { error?: string } | undefined

// Fired on every "Next" click in the paginated form (see
// ReferenceSubmissionForm) — best-effort, fire-and-forget from the client,
// so a reference who never finishes still leaves a real, readable partial
// answer set behind instead of nothing. Silently no-ops past COMPLETED
// (nothing left to save over) rather than erroring, since a stray late
// autosave racing the real submit is expected, not a bug.
export async function saveReferenceDraft(token: string, page: number, answers: Record<string, string>): Promise<void> {
  const reference = await prisma.reference.findUnique({ where: { token }, select: { status: true } })
  if (!reference || reference.status === 'COMPLETED') return

  await prisma.reference.update({
    where: { token },
    data: { draftAnswers: answers, draftPage: page, draftUpdatedAt: new Date() },
  })
}

export async function submitReference(_prevState: FormState, formData: FormData): Promise<FormState> {
  const token = formData.get('token') as string | null
  if (!token) {
    return { error: 'Missing reference token.' }
  }

  const reference = await prisma.reference.findUnique({ where: { token } })

  if (!reference) {
    return { error: 'This reference link is not valid.' }
  }

  if (reference.status === 'COMPLETED') {
    return { error: 'This reference has already been submitted.' }
  }

  const expiresAt = new Date(reference.requestedAt)
  expiresAt.setDate(expiresAt.getDate() + REFERENCE_TOKEN_EXPIRY_DAYS)
  if (new Date() > expiresAt) {
    await prisma.reference.update({ where: { token }, data: { status: 'EXPIRED' } })
    return { error: 'This reference link has expired.' }
  }

  const parsed = parseReferenceFormData(formData)
  if ('error' in parsed) {
    return { error: parsed.error }
  }
  const content = parsed.data
  const extension = parseReferenceCheckExtension(formData)

  const updatedReference = await prisma.reference.update({
    where: { token },
    data: {
      overallRating: content.overallRating,
      wouldHireAgain: content.wouldHireAgain,
      strengthSummary: content.strengthSummary,
      growthAreaSummary: content.growthAreaSummary,
      contextNotes: content.contextNotes,
      ...content.bars,
      ...content.traits,
      superpowerText: content.superpowerText,
      underPressureStory: content.underPressureStory,
      definingStory: content.definingStory,
      wouldWorkWithAgainReason: content.wouldWorkWithAgainReason,
      quotableWithAttribution: content.quotableWithAttribution,
      ...extension.performance,
      compRelativeRank: extension.compRelativeRank as RelativeRank | null,
      compWouldHireAgain: extension.compWouldHireAgain as HireAgainLevel | null,
      compDepartureContext: extension.compDepartureContext as DepartureContext | null,
      compWouldTakeAgain: extension.compWouldTakeAgain as TakeAgainLevel | null,
      compTrustedScope: extension.compTrustedScope as TrustedScopeLevel | null,
      writtenResponse1Text: extension.writtenResponse1,
      writtenResponse2Text: extension.writtenResponse2,
      verifiedTitleCorrect: extension.verifiedTitleCorrect,
      correctedTitle: extension.correctedTitle,
      verifiedDatesCorrect: extension.verifiedDatesCorrect,
      correctedDates: extension.correctedDates,
      verifiedReportingCorrect: extension.verifiedReportingCorrect,
      correctedReporting: extension.correctedReporting,
      verifiedScopeCorrect: extension.verifiedScopeCorrect,
      correctedScope: extension.correctedScope,
      verificationConfidence: extension.verificationConfidence,
      status: 'COMPLETED',
      completedAt: new Date(),
      draftAnswers: Prisma.JsonNull,
      draftPage: null,
    },
  })


  // Must never block the referee's submission from succeeding.
  try {
    await syncReferenceDelta(reference.candidateId)
  } catch (error) {
    console.error('Failed to sync reference delta after reference completion:', error)
  }

  try {
    await generateReferenceQuotes(updatedReference)
  } catch (error) {
    console.error('Failed to generate reference quotes after reference completion:', error)
  }

  try {
    await applyReferenceCompletedRewrite(reference.candidateId, updatedReference)
  } catch (error) {
    console.error('Failed to apply reference-completed baseline rewrite:', error)
  }

  // Weekly Sprint credit for the reference actually landing — the bigger
  // credit that used to fire at request time (see requestReference in
  // src/app/dashboard/references/actions.ts, which now only awards the
  // small REFERENCE_REQUESTED credit for sending the ask).
  try {
    const sprint = await getCurrentWeekSprint(reference.candidateId)
    if (sprint) {
      const effort = estimateActionEffort({ actionType: 'REFERENCE_ADDED' })
      await autoCompleteEngagementAction(reference.candidateId, {
        actionType: 'REFERENCE_ADDED',
        text: 'Got a reference',
        points: effort.points,
        estimatedMinutes: effort.minutes,
      })
    }
  } catch (error) {
    console.error('Failed to auto-complete REFERENCE_ADDED action:', error)
  }

  redirect(`/ref/${token}/complete`)
}

// Lets a referee self-decline instead of just going silent — the candidate
// gets a real, immediate signal (see sendReferenceDeclinedNotice) instead
// of an unexplained REQUESTED row sitting there forever. Distinct from the
// existing admin/candidate-settable DECLINED status: this path is the
// referee's own action, tracked via declinedAt/declineReason.
export async function declineReference(_prevState: FormState, formData: FormData): Promise<FormState> {
  const token = formData.get('token') as string | null
  if (!token) return { error: 'Missing reference token.' }

  const reason = (formData.get('reason') as string | null)?.trim() || null

  const reference = await prisma.reference.findUnique({
    where: { token },
    include: { candidate: { select: { displayName: true } } },
  })
  if (!reference) return { error: 'This reference link is not valid.' }
  if (reference.status === 'COMPLETED') return { error: 'This reference has already been submitted.' }

  await prisma.reference.update({
    where: { token },
    data: { status: 'DECLINED', declinedAt: new Date(), declineReason: reason },
  })

  try {
    await sendReferenceDeclinedNotice({
      candidateId: reference.candidateId,
      candidateName: reference.candidate.displayName || 'there',
      refereeName: reference.refereeName,
    })
  } catch (error) {
    console.error('Failed to send reference declined notice:', error)
  }

  redirect(`/ref/${token}/declined`)
}
