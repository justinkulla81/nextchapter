'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { captureServerEvent } from '@/lib/posthog/server'
import { BOARD_EXPERIENCE_OPTIONS } from '@/lib/network/advisory-boards'

// Saves where the member is with boards (and, optionally, the sectors they would serve) in journeyDetails, the same
// two answers the Planning the next act journey asks, so the plan reads them wherever they were given.
export async function saveBoardAnswers(experience: string, sectors: string): Promise<{ error?: string }> {
  if (!BOARD_EXPERIENCE_OPTIONS.some((o) => o.value === experience)) return { error: 'Pick one of the answers.' }
  const user = await getCurrentUser()
  if (!user) return { error: 'Your session ended. Sign in again.' }
  const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true, journeyDetails: true } })
  if (!profile) return { error: 'Finish setting up your account first.' }
  const details = (profile.journeyDetails as Record<string, unknown> | null) ?? {}
  const cleanSectors = sectors.trim().slice(0, 120)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { journeyDetails: { ...details, boardExperience: experience, ...(cleanSectors ? { boardSectors: cleanSectors } : {}) } as Prisma.InputJsonValue },
  })
  captureServerEvent(profile.id, 'board_experience_saved', { experience, hasSectors: !!cleanSectors })
  revalidatePath('/dashboard/network/advisory-boards')
  return {}
}
