'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { changeMessage } from '@/lib/journey/change-message'
import { applyJourneyChange } from '@/lib/journey/apply'
import { CHECK_IN_ANSWERS, changeForAnswer, effectiveJourney, effectiveStage, type CheckInAnswer } from '@/lib/journey/journey'

// The dashboard's "Has anything changed?" Every answer takes effect at once
// (src/lib/journey/apply.ts); "landed" and "offer" also point the member to
// the next useful step.
export async function answerJourneyCheckIn(answer: string): Promise<{ error?: string; message?: string; next?: { href: string; label: string } }> {
  if (!CHECK_IN_ANSWERS.some((a) => a.key === answer)) return { error: 'Pick one of the answers.' }
  const user = await getCurrentUser()
  if (!user) return { error: 'Your session ended. Sign in again.' }
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, journey: true, journeyStage: true, currentJobStatus: true },
  })
  if (!profile) return { error: 'Finish setting up your account first.' }

  const a = answer as CheckInAnswer
  const change = changeForAnswer(a, { journey: effectiveJourney(profile), stage: effectiveStage(profile) })
  const result = await applyJourneyChange(profile.id, { ...change, source: 'CHECK_IN', isCheckIn: true })
  revalidatePath('/dashboard')
  const message = changeMessage(result) ?? undefined

  if (a === 'landed') return { message, next: { href: '/dashboard/got-hired', label: 'Tell us about the new job (and claim your Offer Bonus)' } }
  if (a === 'offer') return { message, next: { href: '/dashboard/search-strategy', label: 'Get help negotiating the offer' } }
  return { message }
}
