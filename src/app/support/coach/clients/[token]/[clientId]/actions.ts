'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCoachByToken, getCoachClient } from '@/lib/coach/access'
import { captureServerEvent } from '@/lib/posthog/server'
import { applyDirectiveResolvedRewrite } from '@/lib/scoring/rewrite-actions'
import { CATEGORY_ORDER, type CategoryKey } from '@/lib/scoring/grade'

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

  await prisma.coachSession.create({
    data: {
      candidateId: candidate.id,
      coachId: coach.id,
      durationMinutes: durationMinutes && !Number.isNaN(durationMinutes) ? durationMinutes : null,
      notes,
      directives,
      focusNote,
    },
  })

  captureServerEvent(coach.id, 'coach_session_logged', {
    candidateId: candidate.id,
    hasNotes: !!notes,
    hasDirectives: !!directives,
    hasFocusNote: !!focusNote,
  })

  revalidatePath(`/support/coach/clients/${token}/${clientId}`)
  revalidatePath(`/support/coach/clients/${token}/${clientId}/full`)
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
