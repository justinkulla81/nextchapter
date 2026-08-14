'use server'

// Server actions for the guided Resume Walkthrough (§13.1). Every mutating
// action here follows the repo's standard shape: takes (prevState,
// FormData), returns { error } on failure (preserving whatever the
// candidate typed, per design-principles.md), and redirect()s to the next
// step on success — same pattern as submitReference/approvePositioningStatement.
// The one exception is saveBulletDraft, a silent fire-and-forget autosave
// bound directly to onBlur, mirroring saveReferenceDraft.

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { captureServerEvent } from '@/lib/posthog/server'
import { restartWalkthroughSession, updateWalkthroughSession } from '@/lib/walkthrough/session'
import { composeBulletFromAnswers } from '@/lib/walkthrough/compose-bullet'
import type { GuidedBulletAnswers, ReviewerResolutionType, WalkthroughStepAction } from '@/lib/walkthrough/types'
import type { ReviewerDetectionType } from '@/lib/scoring/resume-analysis/types'

export type WalkthroughFormState = { error?: string } | undefined

function stepPath(step: number): string {
  return `/dashboard/resume/walkthrough?step=${step}`
}

async function requireCandidateProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You need to be logged in to do this.')
  return getOrCreateCandidateProfile(user.id)
}

function readNextStep(formData: FormData): number | null {
  const raw = formData.get('nextStep')
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

// Persists the step transition, fires the one analytics event every step
// completion needs, and fires the whole-walkthrough completion event
// exactly once (the first time the review screen is reached).
async function advanceStep(
  candidateId: string,
  patch: Parameters<typeof updateWalkthroughSession>[1],
  nextStep: number,
  step: string,
  action: WalkthroughStepAction,
  eventProps?: Record<string, unknown>
): Promise<void> {
  const result = await updateWalkthroughSession(candidateId, patch, nextStep)
  captureServerEvent(candidateId, 'resume_walkthrough_step_completed', {
    candidateId,
    step,
    action,
    ...eventProps,
  })
  if (result.justCompleted) {
    captureServerEvent(candidateId, 'resume_walkthrough_completed', { candidateId })
  }
  revalidatePath('/dashboard/resume/walkthrough')
  revalidatePath('/dashboard/resume')
}

export async function advanceOverviewStepAction(
  _prev: WalkthroughFormState,
  formData: FormData
): Promise<WalkthroughFormState> {
  const nextStep = readNextStep(formData)
  if (nextStep === null) return { error: 'Something went wrong. Please try again.' }

  let profile
  try {
    profile = await requireCandidateProfile()
  } catch {
    return { error: 'You need to be logged in to do this.' }
  }

  await advanceStep(profile.id, {}, nextStep, 'overview', 'started')
  redirect(stepPath(nextStep))
}

export async function resolveMechanicalFindingAction(
  _prev: WalkthroughFormState,
  formData: FormData
): Promise<WalkthroughFormState> {
  const key = formData.get('key') as string | null
  const action = formData.get('action') as 'fixed' | 'skipped' | null
  const nextStep = readNextStep(formData)
  if (!key || !action || nextStep === null) return { error: 'Something went wrong. Please try again.' }

  let profile
  try {
    profile = await requireCandidateProfile()
  } catch {
    return { error: 'You need to be logged in to do this.' }
  }

  await advanceStep(profile.id, { mechanicalHandled: { [key]: action } }, nextStep, 'mechanical', action, { key })
  redirect(stepPath(nextStep))
}

export async function approveTargetLineAction(
  _prev: WalkthroughFormState,
  formData: FormData
): Promise<WalkthroughFormState> {
  const text = (formData.get('positioningStatementText') as string | null)?.trim()
  const nextStep = readNextStep(formData)
  if (!text) return { error: 'Please review the target line before approving it.' }
  if (nextStep === null) return { error: 'Something went wrong. Please try again.' }

  let profile
  try {
    profile = await requireCandidateProfile()
  } catch {
    return { error: 'You need to be logged in to do this.' }
  }

  // Reuses CandidateProfile.positioningStatementText/SetAt (the Dossier's
  // existing draft/approve field, see PositioningStatementApproval.tsx) —
  // see TargetLineStep.tsx for the reasoning: one candidate has one
  // professional headline, not a Dossier one and a separate resume one.
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { positioningStatementText: text, positioningStatementSetAt: new Date() },
  })

  await advanceStep(profile.id, { targetLineDone: true }, nextStep, 'target-line', 'fixed')
  revalidatePath('/dashboard/recruiter-report')
  redirect(stepPath(nextStep))
}

export async function skipTargetLineAction(
  _prev: WalkthroughFormState,
  formData: FormData
): Promise<WalkthroughFormState> {
  const nextStep = readNextStep(formData)
  if (nextStep === null) return { error: 'Something went wrong. Please try again.' }

  let profile
  try {
    profile = await requireCandidateProfile()
  } catch {
    return { error: 'You need to be logged in to do this.' }
  }

  await advanceStep(profile.id, {}, nextStep, 'target-line', 'skipped')
  redirect(stepPath(nextStep))
}

export async function composeBulletAction(
  _prev: WalkthroughFormState,
  formData: FormData
): Promise<WalkthroughFormState> {
  const workHistoryEntryId = formData.get('workHistoryEntryId') as string | null
  const nextStep = readNextStep(formData)
  const answers: GuidedBulletAnswers = {
    outcome: (formData.get('outcome') as string | null) ?? '',
    scope: (formData.get('scope') as string | null) ?? '',
    elaboration: (formData.get('elaboration') as string | null) ?? '',
  }
  if (!workHistoryEntryId || nextStep === null) return { error: 'Something went wrong. Please try again.' }

  let profile
  try {
    profile = await requireCandidateProfile()
  } catch {
    return { error: 'You need to be logged in to do this.' }
  }

  const entry = await prisma.workHistoryEntry.findFirst({ where: { id: workHistoryEntryId, candidateId: profile.id } })
  if (!entry) return { error: 'We could not find that role. Please refresh and try again.' }

  const composed = composeBulletFromAnswers(answers)
  if (composed) {
    await prisma.workHistoryEntry.update({ where: { id: entry.id }, data: { keyAchievement: composed } })
  }

  await advanceStep(
    profile.id,
    { bulletsHandled: { [workHistoryEntryId]: true }, bulletDrafts: { [workHistoryEntryId]: answers } },
    nextStep,
    'bullet',
    composed ? 'fixed' : 'skipped',
    { workHistoryEntryId }
  )
  revalidatePath('/dashboard/resume')
  redirect(stepPath(nextStep))
}

// Fire-and-forget autosave for the guided-bullet step's in-progress typed
// answers, called on blur — mirrors saveReferenceDraft
// (src/app/ref/[token]/actions.ts). Never advances currentStep or fires
// analytics; a stray late call after the real submit is expected, not a bug.
export async function saveBulletDraft(workHistoryEntryId: string, answers: GuidedBulletAnswers): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  const profile = await getOrCreateCandidateProfile(user.id)
  await updateWalkthroughSession(profile.id, { bulletDrafts: { [workHistoryEntryId]: answers } })
}

export async function resolveReviewerQuestionAction(
  _prev: WalkthroughFormState,
  formData: FormData
): Promise<WalkthroughFormState> {
  const id = formData.get('id') as string | null
  const resolutionType = formData.get('resolutionType') as ReviewerResolutionType | null
  const nextStep = readNextStep(formData)
  const stepLabel = (formData.get('stepLabel') as string | null) ?? 'reviewer-questions'
  const explanation = (formData.get('explanation') as string | null)?.trim() || null

  if (!id || !resolutionType || nextStep === null) return { error: 'Something went wrong. Please try again.' }

  let profile
  try {
    profile = await requireCandidateProfile()
  } catch {
    return { error: 'You need to be logged in to do this.' }
  }

  const question = await prisma.reviewerQuestion.findFirst({ where: { id, candidateId: profile.id } })
  if (!question) return { error: 'We could not find that item. Please refresh and try again.' }

  if (resolutionType === 'CORRECTED') {
    const workHistoryEntryId = (formData.get('workHistoryEntryId') as string | null) || null
    const educationEntryId = (formData.get('educationEntryId') as string | null) || null

    if (workHistoryEntryId) {
      const entry = await prisma.workHistoryEntry.findFirst({
        where: { id: workHistoryEntryId, candidateId: profile.id },
      })
      if (!entry) return { error: 'We could not find that role. Please refresh and try again.' }

      const roleTitle = (formData.get('roleTitle') as string | null)?.trim()
      const startDateRaw = formData.get('startDate') as string | null
      const endDateRaw = (formData.get('endDate') as string | null)?.trim()
      const isCurrent = formData.get('isCurrent') === 'on'
      const teamSizeRaw = (formData.get('teamSize') as string | null)?.trim()
      const keyAchievement = (formData.get('keyAchievement') as string | null)?.trim()

      const data: Prisma.WorkHistoryEntryUpdateInput = { isCurrent }
      if (roleTitle) data.roleTitle = roleTitle
      if (startDateRaw) {
        const startDate = new Date(startDateRaw)
        if (Number.isNaN(startDate.getTime())) return { error: 'Please enter a valid start date.' }
        data.startDate = startDate
      }
      if (isCurrent) {
        data.endDate = null
      } else if (endDateRaw) {
        const endDate = new Date(endDateRaw)
        if (Number.isNaN(endDate.getTime())) return { error: 'Please enter a valid end date.' }
        data.endDate = endDate
      }
      if (teamSizeRaw) {
        const teamSize = Number(teamSizeRaw)
        if (!Number.isNaN(teamSize)) data.teamSize = teamSize
      }
      if (keyAchievement) data.keyAchievement = keyAchievement

      await prisma.workHistoryEntry.update({ where: { id: entry.id }, data })
    } else if (educationEntryId) {
      const entry = await prisma.educationEntry.findFirst({
        where: { id: educationEntryId, candidateId: profile.id },
      })
      if (!entry) return { error: 'We could not find that entry. Please refresh and try again.' }

      const schoolName = (formData.get('schoolName') as string | null)?.trim()
      if (!schoolName) return { error: 'Please enter the granting institution.' }
      await prisma.educationEntry.update({ where: { id: entry.id }, data: { schoolName } })
    }
    // Neither id present covers the honest-fallback case (no auto-matched
    // field to correct) — the candidate is trusted to have fixed it
    // directly in Work History, and we still record the resolution below.
  }

  await prisma.reviewerQuestion.update({
    where: { id: question.id },
    data: {
      resolutionType,
      resolvedAt: new Date(),
      ...(explanation ? { candidateExplanation: explanation } : {}),
    },
  })

  const analyticsAction: WalkthroughStepAction =
    resolutionType === 'CORRECTED' ? 'fixed' : resolutionType === 'NOT_APPLICABLE' ? 'dismissed' : 'skipped'

  await advanceStep(
    profile.id,
    { reviewerHandled: { [id]: { resolutionType } } },
    nextStep,
    stepLabel,
    analyticsAction,
    { reviewerQuestionId: id, detectionType: question.detectionType as ReviewerDetectionType }
  )
  revalidatePath('/dashboard/resume')
  redirect(stepPath(nextStep))
}

// Restarts the walkthrough after completion (e.g. a new resume upload
// surfaced fresh findings/detections) — a plain void action bound to a
// button, same shape as markResumeFixApplied, since there's no per-field
// state to preserve on failure.
export async function restartWalkthroughAction(): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const profile = await getOrCreateCandidateProfile(user.id)
  await restartWalkthroughSession(profile.id)
  captureServerEvent(profile.id, 'resume_walkthrough_step_completed', { candidateId: profile.id, step: 'overview', action: 'started' })

  revalidatePath('/dashboard/resume/walkthrough')
  redirect(stepPath(0))
}
