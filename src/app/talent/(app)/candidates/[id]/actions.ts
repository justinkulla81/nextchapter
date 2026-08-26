'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { resolveEmployerForUserId } from '@/lib/talent/get-employer-for-user'
import { getOrCreateThread } from '@/lib/messaging/threads'
import type { OutcomeWindow } from '@/lib/talent/outcome-ratings'
import { assertSubmissionVisibleToEmployer } from '@/lib/talent/submission-match'
import { generateInterviewGuide } from '@/lib/talent/generate-interview-guide'
import { createPanel, type PanelistInput } from '@/lib/talent/panels'
import type { PanelSetupActionState } from '@/components/talent/PanelSetupForm'

async function getEmployer() {
  const supabase = await createClient('talent')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return resolveEmployerForUserId(user.id)
}

export async function markCandidateHired(candidateId: string) {
  const employer = await getEmployer()
  if (!employer) return

  const existing = await prisma.candidateInteraction.findUnique({
    where: { employerId_candidateId: { employerId: employer.id, candidateId } },
  })
  if (!existing || existing.hiredAt) return

  await prisma.candidateInteraction.update({
    where: { employerId_candidateId: { employerId: employer.id, candidateId } },
    data: { status: 'HIRED', hiredAt: new Date() },
  })

  captureServerEvent(employer.id, 'candidate_marked_hired', { employerId: employer.id, candidateId })

  revalidatePath(`/talent/candidates/${candidateId}`)
  revalidatePath('/talent/candidates')
  revalidatePath('/talent/analytics')
}

const RATING_FIELD: Record<OutcomeWindow, 'thirtyDayRating' | 'ninetyDayRating' | 'sixMonthRating'> = {
  thirtyDay: 'thirtyDayRating',
  ninetyDay: 'ninetyDayRating',
  sixMonth: 'sixMonthRating',
}

export async function submitOutcomeRating(candidateId: string, window: OutcomeWindow, formData: FormData) {
  const employer = await getEmployer()
  if (!employer) return

  const rating = Number(formData.get('rating'))
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return

  const existing = await prisma.candidateInteraction.findUnique({
    where: { employerId_candidateId: { employerId: employer.id, candidateId } },
  })
  if (!existing || !existing.hiredAt) return

  await prisma.candidateInteraction.update({
    where: { employerId_candidateId: { employerId: employer.id, candidateId } },
    data: { [RATING_FIELD[window]]: rating },
  })

  captureServerEvent(employer.id, 'hiring_outcome_rated', { employerId: employer.id, candidateId, window, rating })

  revalidatePath(`/talent/candidates/${candidateId}`)
  revalidatePath('/talent/analytics')
}

export async function startMessagingCandidate(candidateId: string) {
  const employer = await getEmployer()
  if (!employer) return

  const thread = await getOrCreateThread(candidateId, 'EMPLOYER', employer.id)
  redirect(`/talent/messages/${thread.id}`)
}

// Interview panel / scorecard setup — ported from the retired Hiring
// Manager portal (src/lib/talent/panels.ts, generate-interview-guide.ts)
// as part of the /hiring -> /talent consolidation. Every action below
// re-derives and re-checks eligibility itself (defense in depth, same
// convention the old portal's requireVisible used) — never trusts that the
// page that rendered the form already checked.
async function requireVisibleSubmission(candidateId: string, submissionId: string) {
  const employer = await getEmployer()
  if (!employer) return null
  const submission = await assertSubmissionVisibleToEmployer(employer.id, submissionId)
  if (!submission || submission.candidateId !== candidateId) return null
  return { employer, submission }
}

export async function generateInterviewGuideAction(candidateId: string, submissionId: string): Promise<void> {
  const ctx = await requireVisibleSubmission(candidateId, submissionId)
  if (!ctx) return

  await generateInterviewGuide(submissionId)
  captureServerEvent(ctx.employer.id, 'talent_interview_guide_generated', { employerId: ctx.employer.id, submissionId })
  revalidatePath(`/talent/candidates/${candidateId}`)
}

export async function createPanelAction(
  candidateId: string,
  submissionId: string,
  _prevState: PanelSetupActionState,
  formData: FormData
): Promise<PanelSetupActionState> {
  const ctx = await requireVisibleSubmission(candidateId, submissionId)
  if (!ctx) return { error: 'Candidate not found.' }

  const names = formData.getAll('panelistName') as string[]
  const emails = formData.getAll('panelistEmail') as string[]
  const panelists: PanelistInput[] = names.map((name, i) => ({ name, email: emails[i] ?? '' }))

  const result = await createPanel(submissionId, ctx.employer.id, panelists)
  if (result.error) return { error: result.error }

  captureServerEvent(ctx.employer.id, 'talent_interview_panel_created', {
    employerId: ctx.employer.id,
    submissionId,
    panelId: result.panelId,
    panelistCount: panelists.length,
  })
  revalidatePath(`/talent/candidates/${candidateId}`)
  return {}
}
