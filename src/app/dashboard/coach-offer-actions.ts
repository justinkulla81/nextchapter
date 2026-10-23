'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { captureServerEvent } from '@/lib/posthog/server'
import { COACH_OFFER_ORDER, COACH_OFFER_SNOOZE_DAYS, type CoachOfferReason } from '@/lib/coach/offer'
import type { Prisma } from '@prisma/client'

// Any answer to the coach offer (Not now, or opening the coach page) quiets it for 30 days, for every
// reason. It lives in journeyDetails.coachOffer, so it needs no new column and survives journey changes
// (applyJourneyChange merges details).
export async function answerCoachOffer(reason: string, answer: 'snoozed' | 'opened'): Promise<{ error?: string }> {
  if (!COACH_OFFER_ORDER.includes(reason as CoachOfferReason) || (answer !== 'snoozed' && answer !== 'opened')) return { error: 'Not a valid answer.' }
  const user = await getCurrentUser()
  if (!user) return { error: 'Your session ended. Sign in again.' }
  const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true, journeyDetails: true } })
  if (!profile) return { error: 'Finish setting up your account first.' }

  const now = new Date()
  const snoozedUntil = new Date(now.getTime() + COACH_OFFER_SNOOZE_DAYS * 86_400_000).toISOString()
  const details = (profile.journeyDetails as Record<string, unknown> | null) ?? {}
  const previous = (details.coachOffer as Record<string, unknown> | undefined) ?? {}
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { journeyDetails: { ...details, coachOffer: { ...previous, snoozedUntil, lastAnswer: answer, lastReason: reason, answeredAt: now.toISOString() } } as Prisma.InputJsonValue },
  })
  captureServerEvent(profile.id, answer === 'opened' ? 'coach_offer_accepted' : 'coach_offer_snoozed', { reason, snoozeDays: COACH_OFFER_SNOOZE_DAYS })
  revalidatePath('/dashboard')
  return {}
}
