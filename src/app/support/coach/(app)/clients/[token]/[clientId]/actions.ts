'use server'

import { revalidatePath } from 'next/cache'
import type { CoachSessionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCoachByToken, getCoachClient } from '@/lib/coach/access'
import { captureServerEvent } from '@/lib/posthog/server'
import { applyDirectiveResolvedRewrite } from '@/lib/scoring/rewrite-actions'
import { CATEGORY_ORDER, type CategoryKey } from '@/lib/scoring/grade'
import { COACH_SESSION_TYPES, getApplicableRateCents } from '@/lib/admin/coaching-rate-card'
import { parseDimensionFormValues, countConcerningDimensions, readAllDimensions } from '@/lib/coach/session-dimensions'
import { pushDirectivesToActionPlan } from '@/lib/coach/directive-action-plan'
import { requestReassignment } from '@/lib/coach/reassignment'

export type LogSessionFormState = { error?: string } | undefined

export async function logCoachSession(
  token: string,
  clientId: string,
  _prevState: LogSessionFormState,
  formData: FormData
): Promise<LogSessionFormState> {
  const coach = await getCoachByToken(token)
  if (!coach) return { error: 'This link isn’t valid.' }

  const candidate = await getCoachClient(coach.id, clientId)
  if (!candidate) return { error: 'This link isn’t valid.' }

  const durationRaw = (formData.get('durationMinutes') as string | null)?.trim()
  const durationMinutes = durationRaw ? parseInt(durationRaw, 10) : null
  const notes = (formData.get('notes') as string | null)?.trim() || null
  const directives = (formData.get('directives') as string | null)?.trim() || null
  const focusNote = (formData.get('focusNote') as string | null)?.trim() || null
  const sessionTypeRaw = (formData.get('sessionType') as string | null) ?? 'STANDARD'
  const sessionType: CoachSessionType = COACH_SESSION_TYPES.includes(sessionTypeRaw as CoachSessionType)
    ? (sessionTypeRaw as CoachSessionType)
    : 'STANDARD'

  // Rate LOCKED IN at assignment (this create), per Master Build Script
  // §A2.5 — never a live join to CoachRateCard, so a later rate-card change
  // can never retroactively change what this session paid. Falls back to
  // null (not an error) if no rate has been seeded for this sessionType yet
  // — logging the session still succeeds; historical reporting just treats
  // that session as unpriced rather than blocking the coach's workflow on
  // an admin-config gap.
  const rateSnapshotCents = await getApplicableRateCents(sessionType, coach.id)
  const dimensionValues = parseDimensionFormValues(formData)

  const session = await prisma.coachSession.create({
    data: {
      candidateId: candidate.id,
      coachId: coach.id,
      durationMinutes: durationMinutes && !Number.isNaN(durationMinutes) ? durationMinutes : null,
      notes,
      directives,
      focusNote,
      sessionType,
      rateSnapshotCents,
      ...dimensionValues,
    },
  })

  // §A5.2 — push each directive line onto the client's Search Action Plan
  // (current-week WeeklySprint.committedActions) so it's a real, trackable
  // item the candidate sees, not just text sitting in the coach's own view.
  const directiveLinesPushed = directives ? await pushDirectivesToActionPlan(candidate.id, directives, session.id) : 0

  const concerningCount = countConcerningDimensions(readAllDimensions(session))

  captureServerEvent(coach.id, 'coach_session_logged', {
    candidateId: candidate.id,
    hasNotes: !!notes,
    hasDirectives: !!directives,
    directiveLinesPushed,
    hasFocusNote: !!focusNote,
    sessionType,
    rateSnapshotCents,
    concerningDimensionCount: concerningCount,
  })

  revalidatePath(`/support/coach/clients/${token}/${clientId}`)
  revalidatePath(`/support/coach/clients/${token}/${clientId}/full`)
  revalidatePath(`/support/coach/caseload/${token}`)
}

export type ResolveDirectiveFormState = { error?: string } | undefined

// Lets a coach mark a session's directives as actually followed through on
// by the candidate, and which category the follow-through was in — the
// strongest available evidence for that category, since it's a real human
// watching progress happen over time rather than a self-report or a single
// point-in-time reference. See applyDirectiveResolvedRewrite.
export async function resolveSessionDirective(
  token: string,
  clientId: string,
  sessionId: string,
  _prevState: ResolveDirectiveFormState,
  formData: FormData
): Promise<ResolveDirectiveFormState> {
  const coach = await getCoachByToken(token)
  if (!coach) return { error: 'This link isn’t valid.' }

  const candidate = await getCoachClient(coach.id, clientId)
  if (!candidate) return { error: 'This link isn’t valid.' }

  const category = formData.get('category') as CategoryKey | null
  if (!category || !CATEGORY_ORDER.includes(category)) {
    return { error: 'Please choose which category this follow-through applies to.' }
  }

  const session = await prisma.coachSession.findFirst({
    where: { id: sessionId, candidateId: candidate.id, coachId: coach.id },
  })
  if (!session || !session.directives || session.directivesResolvedAt) {
    return { error: 'This session can’t be marked resolved.' }
  }

  await prisma.coachSession.update({
    where: { id: sessionId },
    data: { directivesResolvedAt: new Date(), directivesResolvedCategory: category },
  })

  try {
    await applyDirectiveResolvedRewrite(candidate.id, category)
  } catch (error) {
    console.error('Failed to apply directive-resolved baseline rewrite:', error)
  }

  captureServerEvent(coach.id, 'coach_directive_resolved', {
    candidateId: candidate.id,
    sessionId,
    category,
  })

  revalidatePath(`/support/coach/clients/${token}/${clientId}`)
  revalidatePath(`/support/coach/clients/${token}/${clientId}/full`)
}

export type ReassignmentRequestFormState = { error?: string; success?: boolean } | undefined

// §A5.4 one-tap reassignment request, coach side — no-blame by design: the
// coach states a reason but nothing here judges it, and nothing reassigns
// automatically. Always lands PENDING for admin to route (see
// requestReassignment).
export async function requestClientReassignment(
  token: string,
  clientId: string,
  _prevState: ReassignmentRequestFormState,
  formData: FormData
): Promise<ReassignmentRequestFormState> {
  const coach = await getCoachByToken(token)
  if (!coach) return { error: 'This link isn’t valid.' }

  const candidate = await getCoachClient(coach.id, clientId)
  if (!candidate) return { error: 'This link isn’t valid.' }

  const reason = (formData.get('reason') as string | null)?.trim() || null

  await requestReassignment({
    candidateId: candidate.id,
    requestedBy: 'COACH',
    fromCoachId: coach.id,
    reason,
  })

  revalidatePath(`/support/coach/clients/${token}/${clientId}/full`)
  return { success: true }
}
