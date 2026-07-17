'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCoachByToken, getCoachClient } from '@/lib/coach/access'
import { captureServerEvent } from '@/lib/posthog/server'

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

  await prisma.coachSession.create({
    data: {
      candidateId: candidate.id,
      coachId: coach.id,
      durationMinutes: durationMinutes && !Number.isNaN(durationMinutes) ? durationMinutes : null,
      notes,
      directives,
    },
  })

  captureServerEvent(coach.id, 'coach_session_logged', {
    candidateId: candidate.id,
    hasNotes: !!notes,
    hasDirectives: !!directives,
  })

  revalidatePath(`/support/coach/clients/${token}/${clientId}`)
  revalidatePath(`/support/coach/clients/${token}/${clientId}/full`)
}
