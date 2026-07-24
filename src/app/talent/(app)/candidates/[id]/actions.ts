'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import type { OutcomeWindow } from '@/lib/talent/outcome-ratings'

async function getEmployer() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.employerProfile.findUnique({ where: { userId: user.id } })
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
