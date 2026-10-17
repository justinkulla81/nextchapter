'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { hiddenFromShown, parseSectors } from '@/lib/jobs/employer-sector'

export type SaveSectorsResult = { ok: true } | { ok: false; error: string }

/**
 * Saves which employer sectors the member wants to see (government, nonprofit,
 * academia, private). The board and every job email leave the others out
 * (board-shortlist.ts reads hiddenEmployerSectors). The PostHog event
 * (employer_sector_filter_changed) is fired by the control that called this.
 */
export async function saveEmployerSectors(shown: string[]): Promise<SaveSectorsResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You need to be logged in to do this.' }
  const profile = await getOrCreateCandidateProfile(user.id)
  const visible = parseSectors(shown)
  if (visible.length === 0) return { ok: false, error: 'Keep at least one sector on, or you will see no jobs.' }
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { hiddenEmployerSectors: hiddenFromShown(visible) },
  })
  revalidatePath('/dashboard/find-my-job')
  revalidatePath('/dashboard/search-strategy')
  return { ok: true }
}
