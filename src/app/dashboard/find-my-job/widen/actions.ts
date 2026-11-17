'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import type { Prisma } from '@prisma/client'

/**
 * Finishes the Widen your search strategy: remembers that it was built (so the board's Broader switch works directly
 * from now on) and sets the board to Broader, which reads the places, industries and roles the member switched on.
 * The picks themselves were saved one by one (setSearchExpansion). The event is sent from the button.
 */
export async function finishWidenStrategy(): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: 'You need to be logged in to do this.' }
  const p = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true, journeyDetails: true } })
  if (!p) return { ok: false, error: 'We could not find your profile. Refresh and try again.' }
  const details = (p.journeyDetails as Record<string, unknown> | null) ?? {}
  await prisma.candidateProfile.update({
    where: { id: p.id },
    data: { journeyDetails: { ...details, searchScope: 'broader', widenStrategy: { at: new Date().toISOString() } } as Prisma.InputJsonValue },
  })
  revalidatePath('/dashboard', 'layout')
  return { ok: true }
}
