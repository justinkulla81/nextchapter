'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentHiringManager } from '@/lib/hiring/current-hiring-manager'
import { getVisibleSubmissionForHiringManager } from '@/lib/hiring/visibility'
import { generateInterviewGuide } from '@/lib/talent/generate-interview-guide'
import { createPanel, type PanelistInput } from '@/lib/talent/panels'
import { submitPostHireFeedback } from '@/lib/hiring/post-hire-feedback'
import { captureServerEvent } from '@/lib/posthog/server'
import type { HiringConflictSource } from '@prisma/client'

export type CandidateActionState = { error?: string } | undefined

// Every action below re-checks visibility itself (defense in depth, same
// convention as isCandidateConsentedForRecruiter's callers in Phase 6) —
// never trusts that the page that rendered the form already checked.
async function requireVisible(submissionId: string) {
  const hiringManager = await getCurrentHiringManager()
  const submission = await getVisibleSubmissionForHiringManager(submissionId, hiringManager.id)
  if (!submission) return null
  return { hiringManager, submission }
}

export async function generateInterviewGuideAction(submissionId: string): Promise<void> {
  const ctx = await requireVisible(submissionId)
  if (!ctx) return

  await generateInterviewGuide(submissionId)
  captureServerEvent(ctx.hiringManager.id, 'hiring_interview_guide_generated', { submissionId })
  revalidatePath(`/hiring/candidates/${submissionId}`)
}

export async function createPanelAction(
  submissionId: string,
  _prevState: CandidateActionState,
  formData: FormData
): Promise<CandidateActionState> {
  const ctx = await requireVisible(submissionId)
  if (!ctx) return { error: 'Candidate not found.' }

  const names = formData.getAll('panelistName') as string[]
  const emails = formData.getAll('panelistEmail') as string[]
  const panelists: PanelistInput[] = names.map((name, i) => ({ name, email: emails[i] ?? '' }))

  const result = await createPanel(submissionId, ctx.hiringManager.id, panelists)
  if (result.error) return { error: result.error }

  captureServerEvent(ctx.hiringManager.id, 'hiring_panel_created', { submissionId, panelId: result.panelId, panelistCount: panelists.length })
  revalidatePath(`/hiring/candidates/${submissionId}`)
  return {}
}

export async function declareConflictAction(submissionId: string, formData: FormData): Promise<void> {
  const ctx = await requireVisible(submissionId)
  if (!ctx) return

  const sourceRaw = formData.get('source') as string | null
  const source: Extract<HiringConflictSource, 'DECLARED_RELATIONSHIP' | 'DECLARED_HOUSEHOLD' | 'DECLARED_OTHER'> =
    sourceRaw === 'DECLARED_HOUSEHOLD' ? 'DECLARED_HOUSEHOLD' : sourceRaw === 'DECLARED_OTHER' ? 'DECLARED_OTHER' : 'DECLARED_RELATIONSHIP'

  // declareConflict was ported to Talent and re-keyed from
  // HiringConflictFlag.hiringManagerId to .employerId as part of the
  // /hiring -> /talent consolidation (see src/lib/talent/conflict-check.ts)
  // — a HiringManager id is no longer a valid key for it (and would violate
  // the new employerId foreign key), so this legacy action no longer writes
  // a flag. It still records the intent (via the event below) and redirects
  // the same way, since this whole flow is retired in the next step anyway.
  captureServerEvent(ctx.hiringManager.id, 'hiring_conflict_declared', { submissionId, source })

  // Declaring a conflict used to immediately remove this candidate from
  // view — see getVisibleSubmissionForHiringManager — so there's nowhere on
  // this page left to redirect back to.
  redirect('/hiring/dashboard')
}

export async function submitPostHireFeedbackAction(
  submissionId: string,
  _prevState: CandidateActionState,
  formData: FormData
): Promise<CandidateActionState> {
  const ctx = await requireVisible(submissionId)
  if (!ctx) return { error: 'Candidate not found.' }

  const rating = Number(formData.get('howIsItGoingRating'))
  const wouldHireAgain = formData.get('wouldHireAgain') === 'yes'
  const notes = (formData.get('notes') as string | null) ?? ''

  const result = await submitPostHireFeedback(submissionId, ctx.hiringManager.id, { howIsItGoingRating: rating, wouldHireAgain, notes })
  if (result.error) return { error: result.error }

  captureServerEvent(ctx.hiringManager.id, 'hiring_post_hire_feedback_submitted', { submissionId, rating, wouldHireAgain })
  revalidatePath(`/hiring/candidates/${submissionId}`)
  return {}
}
