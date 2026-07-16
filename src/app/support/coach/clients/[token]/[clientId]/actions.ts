'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

export async function markSessionComplete(token: string, clientId: string) {
  const coach = await prisma.coach.findUnique({ where: { accessToken: token } })
  if (!coach) return

  const candidate = await prisma.candidateProfile.findFirst({ where: { id: clientId, coachId: coach.id } })
  if (!candidate) return

  await prisma.coachSession.create({ data: { candidateId: candidate.id, coachId: coach.id } })

  captureServerEvent(coach.id, 'coach_session_marked_complete', { candidateId: candidate.id })

  revalidatePath(`/support/coach/clients/${token}/${clientId}`)
}
